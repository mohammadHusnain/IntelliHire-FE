"""Communities, membership, join requests and invitations (FR-64 to FR-69). Every membership change recomputes the cached count in the same transaction."""
import secrets
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.text import slugify

from apps.common.choices import CompanyStatus, MemberRole, UserRole, UserStatus
from apps.common.errors import ApiError
from apps.common.mail import send_email_on_commit
from apps.Module2_CompanyManagement.models import CompanyMember
from apps.Module5_Foundation.events import log_event
from apps.Module5_Foundation.notifications import notify, notify_many, notify_platform_admins, preference_enabled_user_ids

from ..models import (
    Community,
    CommunityInvitation,
    CommunityJoinRequest,
    CommunityMembership,
    CommunityStatus,
    InvitationStatus,
    JoinMode,
    MembershipSource,
    MembershipStatus,
    RequestStatus,
)
from .eligibility import check_eligibility

INVITATION_DAYS = 14
MANAGE_ROLES = (MemberRole.ADMIN, MemberRole.HR_MANAGER)


def candidate_link(community):
    return f"/candidate/communities/{community.pk}"


def staff_link(community):
    return f"/company/communities/{community.pk}"


def is_visible(community):
    """Readable by its members: not removed, and the company is still approved."""
    return community.status != CommunityStatus.REMOVED and community.company.status == CompanyStatus.APPROVED


def staff_of(community):
    """The users who manage a community: the company's admins and HR managers."""
    return list(
        CompanyMember.objects.filter(company_id=community.company_id, is_active=True, role__in=MANAGE_ROLES, user__status=UserStatus.ACTIVE).values_list("user_id", flat=True)
    )


def recount(community):
    count = CommunityMembership.objects.filter(community=community, status=MembershipStatus.ACTIVE).count()
    Community.objects.filter(pk=community.pk).update(member_count=count)
    community.member_count = count
    return count


def _community_notice_ids(user_ids):
    return preference_enabled_user_ids(user_ids, "in_app_communities", default=True)


def _community_email_ids(user_ids):
    return preference_enabled_user_ids(user_ids, "email_communities", default=False)


# --- Communities -------------------------------------------------------------------------------------------------
def create(company, user, data):
    if company.status != CompanyStatus.APPROVED:
        raise ApiError("Your company must be approved first.", "company_not_approved", 403)
    slug = f"{slugify(data['name'])[:140] or 'community'}-{secrets.token_hex(3)}"
    try:
        with transaction.atomic():
            community = Community.objects.create(company=company, created_by=user, slug=slug, **data)
    except IntegrityError:
        from rest_framework import serializers

        raise serializers.ValidationError({"name": ["Your company already has a community with this name."]}) from None
    log_event("community.created", actor=user, company=company, target=community, summary="Community created", metadata={"join_mode": community.join_mode})
    return community


def update(community, user, data):
    if community.status == CommunityStatus.REMOVED:
        raise ApiError("This community was removed.", "community_removed", 409)
    from rest_framework import serializers

    try:
        with transaction.atomic():
            for key, value in data.items():
                setattr(community, key, value)
            community.save()
    except IntegrityError:
        raise serializers.ValidationError({"name": ["Your company already has a community with this name."]}) from None
    return community


def archive(community, user):
    if community.status != CommunityStatus.ACTIVE:
        raise ApiError("Only an active community can be archived.", "not_active", 409)
    Community.objects.filter(pk=community.pk).update(status=CommunityStatus.ARCHIVED)
    community.status = CommunityStatus.ARCHIVED
    log_event("community.archived", actor=user, company=community.company_id, target=community, summary="Community archived")
    return community


def remove(community, user, reason):
    """Mark removed (nothing is deleted, so the audit trail stays) and tell every active member once."""
    with transaction.atomic():
        if Community.objects.filter(pk=community.pk, status=CommunityStatus.REMOVED).exists():
            raise ApiError("This community was already removed.", "community_removed", 409)
        Community.objects.filter(pk=community.pk).update(status=CommunityStatus.REMOVED, removed_reason=reason[:500])
        community.status = CommunityStatus.REMOVED
        members = list(CommunityMembership.objects.filter(community=community, status=MembershipStatus.ACTIVE).select_related("user"))
        CommunityInvitation.objects.filter(community=community, status=InvitationStatus.PENDING).update(status=InvitationStatus.REVOKED, responded_at=timezone.now())
        CommunityJoinRequest.objects.filter(community=community, status="pending").update(status=RequestStatus.REJECTED, reviewed_at=timezone.now(), decision_reason="This community was removed.")
        member_ids = [m.user_id for m in members]
        notify_many(_community_notice_ids(member_ids), "community_removed", f"{community.name} is no longer available", "", payload={"community_id": str(community.pk)})
        email_ids = _community_email_ids(member_ids)
        for member in members:
            if member.user_id in email_ids:
                send_email_on_commit(
                    to=member.user.email, subject=f"{community.name} is no longer available",
                    body=f"Hello {member.user.full_name},\n\nThe community {community.name} by {community.company.name} has been closed and is no longer available.\n", kind="community_removed",
                )
        log_event("community.removed", actor=user, company=community.company_id, target=community, summary="Community removed", metadata={"members": len(members)})


# --- Membership --------------------------------------------------------------------------------------------------
def add_member(community, user, source):
    """Make `user` an active member (a former member comes back), close anything else open for them, recount."""
    with transaction.atomic():
        locked = Community.objects.select_for_update().get(pk=community.pk)
        membership, created = CommunityMembership.objects.get_or_create(community=locked, user=user, defaults={"source": source})
        if not created and membership.status != MembershipStatus.ACTIVE:
            membership.status, membership.source, membership.removed_by, membership.removed_at, membership.removed_reason = MembershipStatus.ACTIVE, source, None, None, ""
            membership.save()
        now = timezone.now()
        CommunityInvitation.objects.filter(community=locked, user=user, status=InvitationStatus.PENDING).update(
            status=InvitationStatus.ACCEPTED if source == MembershipSource.INVITATION else InvitationStatus.REVOKED, responded_at=now
        )
        CommunityJoinRequest.objects.filter(community=locked, user=user, status=RequestStatus.PENDING).update(
            status=RequestStatus.APPROVED, reviewed_at=now, decision_reason="Became a member" if source == MembershipSource.INVITATION else ""
        )
        recount(locked)
        log_event("community.member_added", company=locked.company_id, target=locked, summary="Member joined", metadata={"source": source})
    return membership


def remove_member(community, user_id, staff, reason):
    with transaction.atomic():
        membership = CommunityMembership.objects.select_for_update().filter(community=community, user_id=user_id, status=MembershipStatus.ACTIVE).select_related("user").first()
        if membership is None:
            raise ApiError("Member not found.", "not_found", 404)
        membership.status, membership.removed_by, membership.removed_at, membership.removed_reason = MembershipStatus.REMOVED, staff, timezone.now(), reason[:500]
        membership.save()
        recount(community)
        if membership.user_id in _community_notice_ids([membership.user_id]):
            notify(membership.user, "community_member_removed", f"You were removed from {community.name}", reason[:500], payload={"community_id": str(community.pk)})
        if membership.user_id in _community_email_ids([membership.user_id]):
            send_email_on_commit(
                to=membership.user.email, subject=f"You were removed from {community.name}",
                body=f"Hello {membership.user.full_name},\n\nYou are no longer a member of {community.name} by {community.company.name}.\nReason: {reason}\n", kind="community_member_removed",
            )
        log_event("community.member_removed", actor=staff, company=community.company_id, target=community, summary="Member removed")


def leave(community, user):
    with transaction.atomic():
        membership = CommunityMembership.objects.select_for_update().filter(community=community, user=user, status=MembershipStatus.ACTIVE).first()
        if membership is None:
            raise ApiError("You are not a member of this community.", "not_found", 404)
        membership.status = MembershipStatus.LEFT
        membership.save()
        recount(community)


# --- Join requests -----------------------------------------------------------------------------------------------
def join(community, user, message=""):
    """FR-67: an ineligible candidate gets an auto-rejected request with the reasons (200); an eligible one waits for staff."""
    if CommunityMembership.objects.filter(community=community, user=user, status=MembershipStatus.ACTIVE).exists():
        raise ApiError("You are already a member.", "already_member", 409)
    invited = CommunityInvitation.objects.filter(community=community, user=user, status=InvitationStatus.PENDING, expires_at__gt=timezone.now()).exists()
    if community.join_mode == JoinMode.INVITE_ONLY:
        if not invited:
            from rest_framework.exceptions import NotFound

            raise NotFound("Community not found.")
        raise ApiError("You have been invited: accept the invitation instead.", "accept_invitation", 409)
    result = check_eligibility(user, community)
    if not result["eligible"]:
        return CommunityJoinRequest.objects.create(community=community, user=user, message=message[:500], status=RequestStatus.AUTO_REJECTED, eligibility=result), False
    try:
        with transaction.atomic():
            request = CommunityJoinRequest.objects.create(community=community, user=user, message=message[:500], eligibility=result)
    except IntegrityError:
        raise ApiError("You already have a request waiting for review.", "request_pending", 409) from None
    notify_many(staff_of(community), "community_join_request", f"New join request: {community.name}", f"{user.full_name} asked to join.", link=staff_link(community), payload={"community_id": str(community.pk)})
    notify_platform_admins(
        "community_join_request", f"New join request: {community.name}", f"{user.full_name} asked to join {community.name}.",
        link="/admin/communities", payload={"community_id": str(community.pk), "request_id": str(request.pk)},
    )
    return request, True


def approve(request, staff):
    with transaction.atomic():
        won = CommunityJoinRequest.objects.filter(pk=request.pk, status=RequestStatus.PENDING).update(status=RequestStatus.APPROVED, reviewed_by=staff, reviewed_at=timezone.now())
        if not won:
            raise ApiError("This request was already decided.", "already_decided", 409)
        community = request.community
        add_member(community, request.user, MembershipSource.REQUEST)
        CommunityJoinRequest.objects.filter(pk=request.pk).update(reviewed_by=staff)
        if request.user_id in _community_notice_ids([request.user_id]):
            notify(request.user, "community_join_approved", f"You joined {community.name}", link=candidate_link(community), payload={"community_id": str(community.pk)})
        if request.user_id in _community_email_ids([request.user_id]):
            send_email_on_commit(
                to=request.user.email, subject=f"Welcome to {community.name}",
                body=f"Hello {request.user.full_name},\n\nYour request to join {community.name} by {community.company.name} was approved.\n", kind="community_join_approved",
            )
        log_event("community.request_approved", actor=staff, company=community.company_id, target=community, summary="Join request approved")


def reject(request, staff, reason):
    won = CommunityJoinRequest.objects.filter(pk=request.pk, status=RequestStatus.PENDING).update(
        status=RequestStatus.REJECTED, reviewed_by=staff, reviewed_at=timezone.now(), decision_reason=reason[:500]
    )
    if not won:
        raise ApiError("This request was already decided.", "already_decided", 409)
    community = request.community
    if request.user_id in _community_notice_ids([request.user_id]):
        notify(request.user, "community_join_rejected", f"Your request to join {community.name} was not approved", reason[:500], payload={"community_id": str(community.pk)})
    log_event("community.request_rejected", actor=staff, company=community.company_id, target=community, summary="Join request rejected")


# --- Invitations -------------------------------------------------------------------------------------------------
def invite(community, staff, user, message=""):
    """FR-66. Staff chose this candidate on purpose, so failing the filters is allowed: the preview carries a warning."""
    if user.role != UserRole.CANDIDATE or user.status != UserStatus.ACTIVE or not user.email_verified:
        raise ApiError("Candidate not found.", "not_found", 404)
    profile = getattr(user, "candidate_profile", None)
    if profile is None or not profile.discoverable:
        raise ApiError("Candidate not found.", "not_found", 404)
    if CommunityMembership.objects.filter(community=community, user=user, status=MembershipStatus.ACTIVE).exists():
        raise ApiError("This candidate is already a member.", "already_member", 409)
    try:
        with transaction.atomic():
            invitation = CommunityInvitation.objects.create(
                community=community, user=user, invited_by=staff, message=message[:500], expires_at=timezone.now() + timedelta(days=INVITATION_DAYS)
            )
    except IntegrityError:
        raise ApiError("This candidate already has a pending invitation.", "already_invited", 409) from None
    if user.pk in _community_notice_ids([user.pk]):
        notify(user, "community_invitation", f"You are invited to {community.name}", message[:500], link=candidate_link(community), payload={"community_id": str(community.pk), "invitation_id": str(invitation.pk)})
    if user.pk in _community_email_ids([user.pk]):
        send_email_on_commit(
            to=user.email, subject=f"You are invited to join {community.name}",
            body=f"Hello {user.full_name},\n\n{community.company.name} invited you to join the community {community.name}.\n{message}\n\nThe invitation is valid for {INVITATION_DAYS} days.\n", kind="community_invitation",
        )
    log_event("community.invited", actor=staff, company=community.company_id, target=community, summary="Candidate invited")
    return invitation, check_eligibility(user, community)


def _expire_if_due(invitation):
    if invitation.status == InvitationStatus.PENDING and invitation.expires_at <= timezone.now():
        CommunityInvitation.objects.filter(pk=invitation.pk, status=InvitationStatus.PENDING).update(status=InvitationStatus.EXPIRED, responded_at=timezone.now())
        invitation.status = InvitationStatus.EXPIRED
    return invitation


def accept(invitation):
    _expire_if_due(invitation)
    if invitation.status == InvitationStatus.EXPIRED:
        raise ApiError("This invitation has expired.", "invitation_expired", 410)
    if invitation.status != InvitationStatus.PENDING:
        raise ApiError("This invitation is no longer open.", "invitation_closed", 409)
    community = invitation.community
    if community.status != CommunityStatus.ACTIVE or not is_visible(community):
        raise ApiError("This community is not accepting members.", "community_unavailable", 410)
    return add_member(community, invitation.user, MembershipSource.INVITATION)


def decline(invitation):
    _expire_if_due(invitation)
    won = CommunityInvitation.objects.filter(pk=invitation.pk, status=InvitationStatus.PENDING).update(status=InvitationStatus.DECLINED, responded_at=timezone.now())
    if not won:
        raise ApiError("This invitation is no longer open.", "invitation_closed", 409)


def revoke(invitation):
    won = CommunityInvitation.objects.filter(pk=invitation.pk, status=InvitationStatus.PENDING).update(status=InvitationStatus.REVOKED, responded_at=timezone.now())
    if not won:
        raise ApiError("This invitation is no longer open.", "invitation_closed", 409)


def expire_due():
    return CommunityInvitation.objects.filter(status=InvitationStatus.PENDING, expires_at__lte=timezone.now()).update(status=InvitationStatus.EXPIRED, responded_at=timezone.now())

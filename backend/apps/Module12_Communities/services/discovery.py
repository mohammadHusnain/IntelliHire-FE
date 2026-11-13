"""What a candidate can discover (FR-67) and what staff can search (FR-66). Staff never see email, phone or CV."""
from django.db.models import Q
from django.utils import timezone

from apps.common.choices import CompanyStatus, UserRole, UserStatus
from apps.Module1_Authentication.models import User

from ..models import Community, CommunityInvitation, CommunityJoinRequest, CommunityMembership, CommunityStatus, InvitationStatus, JoinMode, MembershipStatus, RequestStatus
from .eligibility import check_eligibility

SEARCH_CAP = 500


def states_for(user, community_ids):
    """none, pending_request, invited or member, for each community id."""
    states = {pk: "none" for pk in community_ids}
    now = timezone.now()
    for pk in CommunityJoinRequest.objects.filter(user=user, community_id__in=community_ids, status=RequestStatus.PENDING).values_list("community_id", flat=True):
        states[pk] = "pending_request"
    for pk in CommunityInvitation.objects.filter(user=user, community_id__in=community_ids, status=InvitationStatus.PENDING, expires_at__gt=now).values_list("community_id", flat=True):
        states[pk] = "invited"
    for pk in CommunityMembership.objects.filter(user=user, community_id__in=community_ids, status=MembershipStatus.ACTIVE).values_list("community_id", flat=True):
        states[pk] = "member"
    return states


def discoverable(user, q="", company=None):
    """Active communities of approved companies: request mode, plus any the candidate has a pending invitation for."""
    invited = CommunityInvitation.objects.filter(user=user, status=InvitationStatus.PENDING, expires_at__gt=timezone.now()).values("community_id")
    queryset = Community.objects.filter(company__status=CompanyStatus.APPROVED, status=CommunityStatus.ACTIVE).filter(Q(join_mode=JoinMode.REQUEST) | Q(pk__in=invited)).select_related("company")
    if q:
        queryset = queryset.filter(Q(name__icontains=q) | Q(description__icontains=q) | Q(company__name__icontains=q))
    if company:
        queryset = queryset.filter(company_id=company)
    return queryset.order_by("name", "id")


def reachable(user, community_id):
    """One community the candidate may open (discoverable, invited to, or a member of); None otherwise."""
    community = Community.objects.select_related("company").filter(pk=community_id).first()
    if community is None or community.status == CommunityStatus.REMOVED or community.company.status != CompanyStatus.APPROVED:
        return None
    if CommunityMembership.objects.filter(community=community, user=user, status=MembershipStatus.ACTIVE).exists():
        return community
    if community.status != CommunityStatus.ACTIVE:
        return None
    if community.join_mode == JoinMode.REQUEST:
        return community
    invited = CommunityInvitation.objects.filter(community=community, user=user, status=InvitationStatus.PENDING, expires_at__gt=timezone.now()).exists()
    return community if invited else None


def profile_summary(user):
    profile = getattr(user, "candidate_profile", None)
    latest = next(iter(profile.education.all()), None) if profile else None
    return {
        "id": user.pk, "full_name": user.full_name, "headline": profile.headline if profile else "",
        "institution": latest.institution if latest else "", "degree": latest.degree if latest else "", "skills": (profile.skills if profile else [])[:15],
    }  # fmt: skip


def search_candidates(community, q="", university="", skill="", grad_year=None, eligible_only=False):
    """Discoverable, verified, active candidates who are not already members, matching the text filters (capped)."""
    members = CommunityMembership.objects.filter(community=community, status=MembershipStatus.ACTIVE).values("user_id")
    queryset = (
        User.objects.filter(role=UserRole.CANDIDATE, status=UserStatus.ACTIVE, email_verified=True, candidate_profile__discoverable=True)
        .exclude(pk__in=members)
        .select_related("candidate_profile")
        .prefetch_related("candidate_profile__education")
        .order_by("full_name", "id")
    )
    if q:
        queryset = queryset.filter(
            Q(full_name__icontains=q) | Q(candidate_profile__headline__icontains=q) | Q(candidate_profile__education__institution__icontains=q)
            | Q(candidate_profile__education__degree__icontains=q) | Q(candidate_profile__skills__icontains=q)
        )
    if university:
        queryset = queryset.filter(candidate_profile__education__institution__icontains=university)
    if grad_year:
        queryset = queryset.filter(candidate_profile__education__end_year=grad_year)
    rows = []
    for user in queryset.distinct()[:SEARCH_CAP]:
        if skill and skill.lower() not in [s.lower() for s in user.candidate_profile.skills]:
            continue
        result = check_eligibility(user, community)
        if eligible_only and not result["eligible"]:
            continue
        rows.append({**profile_summary(user), "eligible": result["eligible"], "reasons": result["reasons"]})
    return rows

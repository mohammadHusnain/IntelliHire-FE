import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import NotFound

from apps.Module1_Authentication.models import User
from apps.Module1_Authentication.validators import check_password_strength
from apps.common.choices import CompanyStatus, MemberRole, UserRole, UserStatus
from apps.common.errors import ApiError, violated_constraint

from .. import emails
from ..models import CompanyMember, InvitationStatus, StaffInvitation

EMAIL_HAS_ACCOUNT = "This email already has an IntelliHire account."
ALREADY_INVITED = "An invitation is already pending for this email."


def hash_token(raw_token):
    return hashlib.sha256(raw_token.encode()).hexdigest()


def _new_token():
    return secrets.token_urlsafe(32)


def _expiry():
    return timezone.now() + timedelta(days=settings.STAFF_INVITE_EXPIRY_DAYS)


def expire_stale(company, email=None):
    """Mark pending invitations past their expiry as expired (frees the one-pending-per-email slot)."""
    stale = StaffInvitation.objects.filter(
        company=company, status=InvitationStatus.PENDING, expires_at__lte=timezone.now()
    )
    if email is not None:
        stale = stale.filter(email=email)
    stale.update(status=InvitationStatus.EXPIRED)


def invitations_of(company, status=None):
    expire_stale(company)
    queryset = StaffInvitation.objects.filter(company=company).order_by("-created_at", "-pk")
    return queryset.filter(status=status) if status else queryset


def create_invitation(*, company, inviter, email, full_name, role, job_title=""):
    try:
        with transaction.atomic():
            expire_stale(company, email)
            if User.objects.filter(email=email).exists():
                raise serializers.ValidationError({"email": [EMAIL_HAS_ACCOUNT]})
            if StaffInvitation.objects.filter(company=company, email=email, status=InvitationStatus.PENDING).exists():
                raise serializers.ValidationError({"email": [ALREADY_INVITED]})
            raw_token = _new_token()
            invitation = StaffInvitation.objects.create(
                company=company,
                email=email,
                full_name=full_name,
                role=role,
                job_title=job_title,
                token_hash=hash_token(raw_token),
                invited_by=inviter,
                expires_at=_expiry(),
            )
            emails.send_invitation_email(invitation, raw_token)
    except IntegrityError as exc:
        if "pending" in violated_constraint(exc):
            raise serializers.ValidationError({"email": [ALREADY_INVITED]})
        raise
    return invitation


def _own_invitation_locked(company, invitation_id):
    try:
        return StaffInvitation.objects.select_for_update().select_related("company").get(
            pk=invitation_id, company=company
        )
    except StaffInvitation.DoesNotExist:
        raise NotFound("Invitation not found.")


def resend_invitation(*, company, invitation_id):
    """New token and expiry; the old link stops working. Only for pending or expired invitations."""
    with transaction.atomic():
        invitation = _own_invitation_locked(company, invitation_id)
        expire_stale(company, invitation.email)
        invitation.refresh_from_db()
        if invitation.status not in (InvitationStatus.PENDING, InvitationStatus.EXPIRED):
            raise ApiError("Only pending or expired invitations can be resent.", "invalid_state", 409)
        if invitation.status == InvitationStatus.EXPIRED and StaffInvitation.objects.filter(
            company=company, email=invitation.email, status=InvitationStatus.PENDING
        ).exists():
            raise ApiError("A newer invitation is pending for this email.", "newer_invitation_pending", 409)
        raw_token = _new_token()
        invitation.token_hash = hash_token(raw_token)
        invitation.expires_at = _expiry()
        invitation.status = InvitationStatus.PENDING
        invitation.save(update_fields=["token_hash", "expires_at", "status"])
        emails.send_invitation_email(invitation, raw_token)
    return invitation


def revoke_invitation(*, company, invitation_id):
    with transaction.atomic():
        invitation = _own_invitation_locked(company, invitation_id)
        expire_stale(company, invitation.email)
        invitation.refresh_from_db()
        if invitation.status != InvitationStatus.PENDING:
            raise ApiError("Only pending invitations can be revoked.", "invalid_state", 409)
        invitation.status = InvitationStatus.REVOKED
        invitation.save(update_fields=["status"])
    return invitation


INVALID_STATES = {
    InvitationStatus.REVOKED: ("This invitation has been revoked.", "revoked"),
    InvitationStatus.ACCEPTED: ("This invitation has already been used.", "already_used"),
    InvitationStatus.EXPIRED: ("This invitation has expired.", "expired"),
}


def _usable(invitation):
    """Raise a specific error unless the invitation can still be accepted."""
    if invitation.status == InvitationStatus.PENDING and invitation.expires_at <= timezone.now():
        invitation.status = InvitationStatus.EXPIRED
    if invitation.status in INVALID_STATES:
        message, code = INVALID_STATES[invitation.status]
        raise ApiError(message, code)
    if invitation.company.status != CompanyStatus.APPROVED:
        raise ApiError("This company is not accepting new members.", "company_unavailable")


def invitation_for_token(raw_token, *, lock=False):
    queryset = StaffInvitation.objects.select_related("company")
    if lock:
        queryset = queryset.select_for_update(of=("self",))
    try:
        invitation = queryset.get(token_hash=hash_token(raw_token))
    except StaffInvitation.DoesNotExist:
        raise ApiError("Invitation not found or invalid.", "invalid_invitation")
    _usable(invitation)
    return invitation


def accept_invitation(*, raw_token, full_name, password):
    """Create the active, email-verified user and membership, and close the invitation."""
    try:
        with transaction.atomic():
            invitation = invitation_for_token(raw_token, lock=True)
            if User.objects.filter(email=invitation.email).exists():
                raise ApiError(EMAIL_HAS_ACCOUNT, "email_taken")
            try:
                check_password_strength(password, User(email=invitation.email, full_name=full_name))
            except serializers.ValidationError as exc:
                raise serializers.ValidationError({"password": exc.detail})
            user = User.objects.create_user(
                invitation.email,
                password,
                full_name=full_name,
                role=UserRole.COMPANY_ADMIN if invitation.role == MemberRole.ADMIN else UserRole.HR,
                status=UserStatus.ACTIVE,
                email_verified=True,
            )
            CompanyMember.objects.create(
                company=invitation.company,
                user=user,
                role=invitation.role,
                job_title=invitation.job_title,
                invited_by=invitation.invited_by,
            )
            invitation.status = InvitationStatus.ACCEPTED
            invitation.accepted_at = timezone.now()
            invitation.save(update_fields=["status", "accepted_at"])
    except IntegrityError as exc:
        if "email" in violated_constraint(exc):
            raise ApiError(EMAIL_HAS_ACCOUNT, "email_taken")
        raise
    return user

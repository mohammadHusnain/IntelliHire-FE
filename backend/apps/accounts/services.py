from pathlib import Path

from django.contrib.auth.models import update_last_login
from django.db import IntegrityError, transaction
from rest_framework import serializers
from rest_framework.exceptions import NotFound

from apps.common.choices import CompanyStatus, UserRole, UserStatus
from apps.common.errors import ApiError, violated_constraint
from apps.common.permissions import get_membership
from apps.common.storage import private_storage

from . import auth_tokens, emails, tokens
from .auth_tokens import InvalidRefreshToken
from .models import CandidateProfile, User
from .resume import extract_resume_text
from .validators import EMAIL_TAKEN, check_password_strength, normalize_email

INVALID_CREDENTIALS = "Invalid email or password."
INACTIVE_MESSAGES = {
    UserStatus.PENDING_VERIFICATION: "Please verify your email before logging in.",
    UserStatus.PENDING_APPROVAL: "Your company account is awaiting administrator approval.",
    UserStatus.REJECTED: "Your company registration was not approved.",
    UserStatus.SUSPENDED: "Your account has been suspended.",
}
INVALID_RESET_LINK = "Reset link is invalid or has expired."
COMPANY_ROLES = (UserRole.COMPANY_ADMIN, UserRole.HR)


def derive_status(user):
    """The status an account should have, from its verification state and company."""
    if not user.email_verified:
        return UserStatus.PENDING_VERIFICATION
    if user.role in COMPANY_ROLES:
        membership = get_membership(user)
        if membership is None or membership.company.status == CompanyStatus.PENDING:
            return UserStatus.PENDING_APPROVAL
        if membership.company.status == CompanyStatus.REJECTED:
            return UserStatus.REJECTED
    return UserStatus.ACTIVE


def register_candidate(*, full_name, email, password):
    try:
        with transaction.atomic():
            user = User.objects.create_user(
                email,
                password,
                full_name=full_name,
                role=UserRole.CANDIDATE,
                status=UserStatus.PENDING_VERIFICATION,
            )
            CandidateProfile.objects.create(user=user)
            emails.send_verification_email(user)
    except IntegrityError as exc:
        if "email" in violated_constraint(exc):
            raise serializers.ValidationError({"email": [EMAIL_TAKEN]})
        raise
    return user


def verify_email(token):
    payload = tokens.read_verification_token(token)
    with transaction.atomic():
        try:
            user = User.objects.select_for_update().get(pk=payload["uid"], email=payload["email"])
        except (User.DoesNotExist, KeyError, ValueError):
            raise ApiError("Invalid verification link.", "invalid_token")
        if not user.email_verified:
            user.email_verified = True
            if user.status == UserStatus.PENDING_VERIFICATION:
                user.status = derive_status(user)
            user.save(update_fields=["email_verified", "status"])
            return user, True
    return user, False


def resend_verification(email):
    user = User.objects.filter(email=normalize_email(email), email_verified=False).first()
    if user:
        emails.send_verification_email(user)


def authenticate_credentials(email, password):
    user = User.objects.select_related("company_membership__company").filter(email=normalize_email(email)).first()
    if user is None:
        User().set_password(password)  # equalise timing with the real-user path
        raise ApiError(INVALID_CREDENTIALS, "invalid_credentials", 401)
    if not user.check_password(password):
        raise ApiError(INVALID_CREDENTIALS, "invalid_credentials", 401)
    if user.status != UserStatus.ACTIVE:
        raise ApiError(INACTIVE_MESSAGES[user.status], user.status, 403)
    return user


def login(email, password):
    user = authenticate_credentials(email, password)
    update_last_login(None, user)
    return user, auth_tokens.issue_tokens(user)


def refresh_tokens(refresh_token):
    try:
        old = auth_tokens.load_refresh_token(refresh_token)
        user = User.objects.select_related("company_membership__company").filter(pk=old["user_id"]).first()
        if user is None or user.status != UserStatus.ACTIVE:
            raise ApiError("Account is not active.", "account_inactive", 401)
        with transaction.atomic():
            auth_tokens.blacklist(old)
            return auth_tokens.issue_tokens(user)
    except InvalidRefreshToken:
        raise ApiError("Token is invalid or expired.", "token_not_valid", 401)


def logout(user, refresh_token):
    try:
        token = auth_tokens.load_refresh_token(refresh_token)
        if str(token["user_id"]) != str(user.pk):
            raise InvalidRefreshToken
        auth_tokens.blacklist(token)
    except InvalidRefreshToken:
        raise ApiError("Invalid token.", "invalid_token", 400)


def forgot_password(email):
    user = User.objects.filter(email=normalize_email(email), email_verified=True).first()
    if user:
        emails.send_password_reset_email(user)


def reset_password(uid, token, new_password):
    user = tokens.user_for_reset(uid, token)
    if user is None:
        raise ApiError(INVALID_RESET_LINK, "invalid_token")
    try:
        check_password_strength(new_password, user)
    except serializers.ValidationError as exc:
        raise serializers.ValidationError({"new_password": exc.detail})
    _set_password_and_logout_everywhere(user, new_password)


def change_password(user, old_password, new_password):
    if not user.check_password(old_password):
        raise serializers.ValidationError({"old_password": ["Current password is incorrect."]})
    try:
        check_password_strength(new_password, user)
    except serializers.ValidationError as exc:
        raise serializers.ValidationError({"new_password": exc.detail})
    _set_password_and_logout_everywhere(user, new_password)


def _set_password_and_logout_everywhere(user, new_password):
    with transaction.atomic():
        user.set_password(new_password)
        user.save(update_fields=["password"])
        auth_tokens.revoke_all_refresh_tokens(user)


def replace_resume(profile, upload):
    """Store a new CV, delete the old file after commit, and refresh the extracted text."""
    storage = private_storage()
    old_name = profile.resume.name
    text = extract_resume_text(upload, Path(upload.name).suffix.lower())
    profile.resume.save(upload.name, upload, save=False)
    new_name = profile.resume.name
    profile.resume_original_name = Path(upload.name).name[:255]
    profile.resume_text = text
    try:
        with transaction.atomic():
            profile.save(update_fields=["resume", "resume_original_name", "resume_text", "updated_at"])
            if old_name:
                transaction.on_commit(lambda: storage.delete(old_name))
    except Exception:
        storage.delete(new_name)
        raise
    return profile


def _locked_user(user_id):
    try:
        return User.objects.select_for_update().get(pk=user_id)
    except (User.DoesNotExist, ValueError):
        raise NotFound("User not found.")


def suspend_user(*, actor, user_id):
    with transaction.atomic():
        target = _locked_user(user_id)
        if target.pk == actor.pk:
            raise ApiError("You cannot suspend your own account.", "cannot_suspend_self")
        if target.role == UserRole.PLATFORM_ADMIN:
            raise ApiError("Platform administrators cannot be suspended.", "cannot_suspend_admin")
        if target.status == UserStatus.SUSPENDED:
            raise ApiError("Account is already suspended.", "already_suspended", 409)
        target.status = UserStatus.SUSPENDED
        target.save(update_fields=["status"])
        auth_tokens.revoke_all_refresh_tokens(target)
    return target


def reactivate_user(*, user_id):
    with transaction.atomic():
        target = _locked_user(user_id)
        if target.status != UserStatus.SUSPENDED:
            raise ApiError("Account is not suspended.", "not_suspended", 409)
        target.status = derive_status(target)
        target.save(update_fields=["status"])
    return target

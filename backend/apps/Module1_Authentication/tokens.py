from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core import signing
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode

from apps.common.errors import ApiError

from .models import User

VERIFICATION_SALT = "accounts.email-verification"


def make_verification_token(user):
    return signing.dumps({"uid": str(user.pk), "email": user.email}, salt=VERIFICATION_SALT)


def read_verification_token(token):
    try:
        return signing.loads(token, salt=VERIFICATION_SALT, max_age=settings.EMAIL_VERIFICATION_MAX_AGE)
    except signing.SignatureExpired:
        raise ApiError("Verification link has expired.", "expired")
    except signing.BadSignature:
        raise ApiError("Invalid verification link.", "invalid_token")


def make_reset_credentials(user):
    return urlsafe_base64_encode(force_bytes(user.pk)), default_token_generator.make_token(user)


def user_for_reset(uid, token):
    """The user a valid reset link belongs to, or None. A used or expired link, or one
    issued before a password change, is invalid."""
    try:
        user = User.objects.get(pk=force_str(urlsafe_base64_decode(uid)))
    except (TypeError, ValueError, OverflowError, User.DoesNotExist, DjangoValidationError):
        return None
    return user if default_token_generator.check_token(user, token) else None

import hashlib
import secrets

from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode

from apps.common.errors import ApiError

from .models import EmailOTP, User

VERIFICATION_PURPOSE = "email_verification"


def _hash_otp(code):
    return hashlib.sha256(code.encode()).hexdigest()


def make_verification_otp(user):
    """A fresh 6-digit code for `user`, replacing any unused one. Returns the raw code (shown once, emailed, never stored)."""
    EmailOTP.objects.filter(user=user, purpose=VERIFICATION_PURPOSE, consumed_at__isnull=True).delete()
    code = f"{secrets.randbelow(1_000_000):06d}"
    EmailOTP.objects.create(
        user=user, purpose=VERIFICATION_PURPOSE, code_hash=_hash_otp(code),
        expires_at=timezone.now() + timezone.timedelta(seconds=settings.EMAIL_OTP_MAX_AGE_SECONDS),
    )  # fmt: skip
    return code


def check_verification_otp(user, code):
    """Consume `user`'s active code if `code` matches. Raises ApiError otherwise; never raises on success.

    Must not be called from inside another `transaction.atomic()` block: the "wrong code" path has to
    commit its attempt count even though it then raises, and a raise out of a *nested* atomic block
    would roll back along with whatever the caller does next.
    """
    left = None
    with transaction.atomic():
        row = (
            EmailOTP.objects.select_for_update()
            .filter(user=user, purpose=VERIFICATION_PURPOSE, consumed_at__isnull=True)
            .order_by("-created_at")
            .first()
        )
        if row is None or row.expires_at < timezone.now():
            raise ApiError("This code has expired. Request a new one.", "expired")
        if row.attempts >= settings.EMAIL_OTP_MAX_ATTEMPTS:
            raise ApiError("Too many incorrect attempts. Request a new code.", "too_many_attempts")
        if secrets.compare_digest(_hash_otp(code), row.code_hash):
            row.consumed_at = timezone.now()
            row.save(update_fields=["consumed_at"])
            return
        row.attempts += 1
        row.save(update_fields=["attempts"])
        left = settings.EMAIL_OTP_MAX_ATTEMPTS - row.attempts
    # The block above already committed the attempt count; only now is it safe to raise.
    if left <= 0:
        raise ApiError("Too many incorrect attempts. Request a new code.", "too_many_attempts")
    raise ApiError(f"Incorrect code. {left} attempt{'s' if left != 1 else ''} left.", "invalid_code")


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

from urllib.parse import urlencode

from django.conf import settings

from apps.common.mail import send_email_on_commit

from . import tokens


def _frontend_link(path, **params):
    return f"{settings.FRONTEND_URL}{path}?{urlencode(params)}"


def send_verification_email(user):
    code = tokens.make_verification_otp(user)
    minutes = settings.EMAIL_OTP_MAX_AGE_SECONDS // 60
    send_email_on_commit(
        to=user.email,
        subject="Your IntelliHire verification code",
        body=(
            f"Hello {user.full_name},\n\n"
            f"Your verification code is:\n\n    {code}\n\n"
            f"Enter it on the verification page to activate your account. It expires in {minutes} minutes "
            "and works once. If you did not create an account, ignore this email.\n"
        ),
        kind="email_verification",
        sensitive=True,
    )


def send_password_reset_email(user):
    uid, token = tokens.make_reset_credentials(user)
    link = _frontend_link("/reset-password", uid=uid, token=token)
    send_email_on_commit(
        to=user.email,
        subject="Reset your IntelliHire password",
        body=(
            f"Hello {user.full_name},\n\n"
            f"Use this link to choose a new password:\n{link}\n\n"
            "The link expires in 1 hour and works once. If you did not ask for this, ignore this email.\n"
        ),
        kind="password_reset",
        sensitive=True,
    )

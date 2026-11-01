from urllib.parse import urlencode

from django.conf import settings

from apps.common.mail import send_email_on_commit

from . import tokens


def _frontend_link(path, **params):
    return f"{settings.FRONTEND_URL}{path}?{urlencode(params)}"


def send_verification_email(user):
    link = _frontend_link("/verify-email", token=tokens.make_verification_token(user))
    send_email_on_commit(
        to=user.email,
        subject="Verify your IntelliHire email",
        body=(
            f"Hello {user.full_name},\n\n"
            f"Confirm your email address to continue with your IntelliHire account:\n{link}\n\n"
            "This link expires in 24 hours. If you did not create an account, ignore this email.\n"
        ),
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
    )

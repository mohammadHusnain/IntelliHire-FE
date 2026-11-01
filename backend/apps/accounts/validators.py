from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import User

EMAIL_TAKEN = "Email already registered."
PASSWORD_MISMATCH = "Passwords do not match."


def normalize_email(value):
    return value.strip().lower()


def ensure_email_available(email):
    if User.objects.filter(email=email).exists():
        raise serializers.ValidationError(EMAIL_TAKEN)


def check_password_strength(password, user=None):
    try:
        validate_password(password, user=user)
    except DjangoValidationError as exc:
        raise serializers.ValidationError(list(exc.messages))

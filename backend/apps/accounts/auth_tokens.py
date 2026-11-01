from django.db import transaction
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken


class InvalidRefreshToken(Exception):
    pass


def issue_tokens(user):
    """A new access/refresh pair. `role` and `full_name` are copied into the access token."""
    refresh = RefreshToken.for_user(user)
    refresh["role"] = user.role
    refresh["full_name"] = user.full_name
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


def load_refresh_token(token):
    try:
        return RefreshToken(token)
    except TokenError:
        raise InvalidRefreshToken


def blacklist(refresh):
    """Blacklist a refresh token exactly once, even under concurrent requests."""
    with transaction.atomic():
        try:
            outstanding = OutstandingToken.objects.select_for_update().get(jti=refresh[api_settings.JTI_CLAIM])
        except OutstandingToken.DoesNotExist:
            raise InvalidRefreshToken
        _, created = BlacklistedToken.objects.get_or_create(token=outstanding)
        if not created:
            raise InvalidRefreshToken


def revoke_all_refresh_tokens(user):
    outstanding = OutstandingToken.objects.filter(user=user, blacklistedtoken__isnull=True)
    BlacklistedToken.objects.bulk_create([BlacklistedToken(token=t) for t in outstanding], ignore_conflicts=True)

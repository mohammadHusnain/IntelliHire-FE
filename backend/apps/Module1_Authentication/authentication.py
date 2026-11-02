from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.settings import api_settings

from apps.common.choices import UserStatus

from .models import User


class StatusAwareJWTAuthentication(JWTAuthentication):
    """Loads the user from the database on every request and rejects any account
    that is not active, so suspension takes effect before the token expires."""

    def get_user(self, validated_token):
        try:
            user_id = validated_token[api_settings.USER_ID_CLAIM]
        except KeyError:
            raise InvalidToken("Token contained no recognizable user identification.")
        try:
            user = User.objects.select_related("company_membership__company").get(
                **{api_settings.USER_ID_FIELD: user_id}
            )
        except (User.DoesNotExist, DjangoValidationError, ValueError):
            raise AuthenticationFailed("User not found.", code="user_not_found")
        if user.status != UserStatus.ACTIVE:
            raise AuthenticationFailed("Account is not active.", code="account_inactive")
        return user

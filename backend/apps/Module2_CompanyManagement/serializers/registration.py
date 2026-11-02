from django.conf import settings
from rest_framework import serializers

from apps.Module1_Authentication.serializers import PasswordPairSerializer
from apps.Module1_Authentication.validators import ensure_email_available, normalize_email
from apps.common.validators import validate_phone

from ..models import Company


class CompanyRegistrationSerializer(PasswordPairSerializer):
    company_name = serializers.CharField(max_length=200)
    industry = serializers.CharField(max_length=100)
    official_email = serializers.EmailField(max_length=254)
    admin_full_name = serializers.CharField(max_length=150)
    admin_phone = serializers.CharField(max_length=20, validators=[validate_phone])

    def validate_company_name(self, value):
        if Company.objects.filter(name__iexact=value).exists():
            raise serializers.ValidationError("A company with this name is already registered.")
        return value

    def validate_official_email(self, value):
        email = normalize_email(value)
        ensure_email_available(email)
        if email.rsplit("@", 1)[-1] in settings.COMPANY_EMAIL_BLOCKED_DOMAINS:
            raise serializers.ValidationError("Please use your company email address.")
        return email

    def validate(self, attrs):
        self.check_passwords(attrs, email=attrs["official_email"], full_name=attrs["admin_full_name"])
        return attrs


class CompanyResubmitSerializer(serializers.Serializer):
    official_email = serializers.CharField(max_length=254)
    password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=128)
    company_name = serializers.CharField(max_length=200)
    industry = serializers.CharField(max_length=100)
    admin_full_name = serializers.CharField(max_length=150)
    admin_phone = serializers.CharField(max_length=20, validators=[validate_phone])


class CompanyResubmitResponseSerializer(serializers.Serializer):
    detail = serializers.CharField()
    status = serializers.CharField()

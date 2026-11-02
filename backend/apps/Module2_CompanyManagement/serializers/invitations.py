from django.utils import timezone
from rest_framework import serializers

from apps.Module1_Authentication.serializers import PasswordPairSerializer
from apps.Module1_Authentication.validators import normalize_email
from apps.common.choices import MemberRole

from ..models import InvitationStatus, StaffInvitation


class InvitationSerializer(serializers.ModelSerializer):
    status = serializers.SerializerMethodField()

    class Meta:
        model = StaffInvitation
        fields = ["id", "email", "full_name", "role", "job_title", "status", "created_at", "expires_at", "accepted_at"]
        read_only_fields = fields

    def get_status(self, invitation) -> str:
        if invitation.status == InvitationStatus.PENDING and invitation.expires_at <= timezone.now():
            return InvitationStatus.EXPIRED.value
        return invitation.status


class InvitationCreateSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    full_name = serializers.CharField(max_length=150)
    role = serializers.ChoiceField(choices=MemberRole.choices)
    job_title = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")

    def validate_email(self, value):
        return normalize_email(value)


class InvitationCompanySerializer(serializers.Serializer):
    name = serializers.CharField()
    logo = serializers.CharField(allow_null=True)


class InvitationDetailsSerializer(serializers.Serializer):
    company = InvitationCompanySerializer()
    role = serializers.CharField()
    email = serializers.EmailField()
    full_name = serializers.CharField()


class InvitationAcceptSerializer(PasswordPairSerializer):
    full_name = serializers.CharField(max_length=150)

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": ["Passwords do not match."]})
        return attrs


class InvitationAcceptResponseSerializer(serializers.Serializer):
    email = serializers.EmailField()
    status = serializers.CharField()

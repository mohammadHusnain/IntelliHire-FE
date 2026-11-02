from rest_framework import serializers

from apps.common.choices import MemberRole

from ..models import CompanyMember


class MemberSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source="user.full_name", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    last_login = serializers.DateTimeField(source="user.last_login", read_only=True)

    class Meta:
        model = CompanyMember
        fields = ["id", "full_name", "email", "role", "job_title", "joined_at", "is_active", "last_login"]
        read_only_fields = fields


class MemberUpdateSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=MemberRole.choices, required=False)
    job_title = serializers.CharField(max_length=100, required=False, allow_blank=True)
    is_active = serializers.BooleanField(required=False)

from rest_framework import serializers

from apps.common.choices import UserRole

from .models import Notification, NotificationPreference


class NotificationSerializer(serializers.ModelSerializer):
    read = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = ["id", "kind", "title", "body", "link", "payload", "read", "read_at", "created_at"]
        read_only_fields = fields

    def get_read(self, obj) -> bool:
        return obj.read_at is not None


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = ["email_communities", "in_app_reminders", "in_app_communities", "notify_applicants"]

    def role_fields(self):
        request = self.context.get("request")
        role = getattr(getattr(request, "user", None), "role", None)
        if role == UserRole.CANDIDATE:
            return {"email_communities", "in_app_reminders", "in_app_communities"}
        if role in (UserRole.COMPANY_ADMIN, UserRole.HR):
            return {"notify_applicants"}
        return set(self.Meta.fields)

    def get_fields(self):
        fields = super().get_fields()
        allowed = self.role_fields()
        return {name: field for name, field in fields.items() if name in allowed}

    def to_internal_value(self, data):
        unsupported = set(data) - self.role_fields()
        if unsupported:
            from rest_framework import serializers

            raise serializers.ValidationError({name: ["This preference is not available for your account type."] for name in unsupported})
        return super().to_internal_value(data)


class CountSerializer(serializers.Serializer):
    count = serializers.IntegerField()


class ErrorSerializer(serializers.Serializer):
    """The error body every endpoint returns: a readable message and a stable code."""

    detail = serializers.CharField(help_text="A message that is safe to show to the user.")
    code = serializers.CharField(help_text="A stable machine-readable code, for example invalid_filter or not_found.")

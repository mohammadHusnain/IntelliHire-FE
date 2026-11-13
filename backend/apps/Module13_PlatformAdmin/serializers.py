from rest_framework import serializers

from apps.Module5_Foundation.models import AISettings, PromptTemplate

from .models import FlagTarget


class FlagInputSerializer(serializers.Serializer):
    target_type = serializers.ChoiceField(choices=FlagTarget.choices)
    target_id = serializers.UUIDField()
    reason = serializers.CharField(max_length=1000, trim_whitespace=True)


class ReportInputSerializer(serializers.Serializer):
    target_type = serializers.ChoiceField(choices=[(v, v) for v in ("job", "community", "community_post")])
    target_id = serializers.UUIDField()
    reason = serializers.CharField(max_length=1000, trim_whitespace=True)


class PublicReportSerializer(serializers.Serializer):
    form_slug = serializers.CharField(max_length=40)
    reason = serializers.CharField(max_length=1000, trim_whitespace=True)


class ResolveSerializer(serializers.Serializer):
    note = serializers.CharField(max_length=1000, trim_whitespace=True)
    action = serializers.ChoiceField(choices=[("dismiss", "dismiss"), ("act", "act")], default="dismiss")


class AdminReasonSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=1000, trim_whitespace=True)


class AISettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = AISettings
        fields = [
            "provider", "chat_model", "eval_model", "embed_model", "stt_model", "fallback_provider", "fallback_chat_model",
            "temperature_questions", "temperature_evaluation", "max_tokens", "timeout_seconds", "screening_min_score",
            "screening_questions", "technical_questions", "mock_questions", "updated_at",
        ]  # fmt: skip
        read_only_fields = ["updated_at"]
        extra_kwargs = {field: {"required": False} for field in fields if field != "updated_at"}


class PromptVersionSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()

    class Meta:
        model = PromptTemplate
        fields = ["key", "version", "model_role", "system_text", "user_text", "output_schema", "is_active", "created_by", "created_at"]
        read_only_fields = fields

    def get_created_by(self, template) -> str:
        return template.created_by.full_name if template.created_by_id else ""


class PromptInputSerializer(serializers.Serializer):
    system_text = serializers.CharField()
    user_text = serializers.CharField()
    output_schema = serializers.JSONField(required=False)
    model_role = serializers.ChoiceField(choices=[("chat", "chat"), ("eval", "eval")], required=False)


class RollbackSerializer(serializers.Serializer):
    version = serializers.IntegerField(min_value=1)


def flag_row(flag, target=None):
    return {
        "id": flag.pk, "target_type": flag.target_type, "target_id": flag.target_id, "target": target, "reason": flag.reason,
        "source": flag.source, "status": flag.status, "reported_by": flag.reported_by.full_name if flag.reported_by_id else "",
        "resolution_note": flag.resolution_note, "action_taken": flag.action_taken,
        "resolved_by": flag.resolved_by.full_name if flag.resolved_by_id else "", "created_at": flag.created_at, "resolved_at": flag.resolved_at,
    }  # fmt: skip


def alert_row(alert):
    return {
        "id": alert.pk, "kind": alert.kind, "severity": alert.severity, "message": alert.message, "is_active": alert.is_active,
        "created_at": alert.created_at, "acknowledged_at": alert.acknowledged_at, "resolved_at": alert.resolved_at,
    }  # fmt: skip

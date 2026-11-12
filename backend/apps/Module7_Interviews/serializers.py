from rest_framework import serializers

from .models import InterviewSession, InterviewTurn, SessionKind
from .services.notices import AI_DISCLAIMER


# --- Company side -----------------------------------------------------------------------------------------------
class InviteSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=SessionKind.choices[:2], default=SessionKind.SCREENING, help_text="`screening` today; `technical` arrives with Module 8.")
    expires_in_days = serializers.IntegerField(required=False, min_value=1, max_value=14, help_text="Days the link stays valid (default 7, at most 14).")
    override = serializers.BooleanField(default=False, help_text="Invite although the application is not shortlisted. Needs a note.")
    note = serializers.CharField(required=False, allow_blank=True, max_length=500, help_text="Why, when `override` is true. Kept in the status history.")


class ExtendSerializer(serializers.Serializer):
    days = serializers.IntegerField(min_value=1, max_value=14)


class _UserSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    full_name = serializers.CharField()


class _ApplicationRefSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    reference = serializers.CharField()
    full_name = serializers.CharField()


class InterviewSessionSerializer(serializers.ModelSerializer):
    answered_count = serializers.SerializerMethodField()
    overall_score = serializers.SerializerMethodField()
    created_by = serializers.SerializerMethodField()
    application = _ApplicationRefSerializer(read_only=True)

    class Meta:
        model = InterviewSession
        fields = [
            "id", "kind", "status", "role_title", "question_target", "answered_count", "overall_score", "recommendation",
            "invited_at", "expires_at", "started_at", "completed_at", "created_by", "application",
        ]  # fmt: skip
        read_only_fields = fields

    def get_answered_count(self, session) -> int:
        count = getattr(session, "answered", None)
        return count if count is not None else session.turns.filter(answered_at__isnull=False).count()

    def get_overall_score(self, session) -> float | None:
        return float(session.overall_score) if session.overall_score is not None else None

    def get_created_by(self, session) -> dict | None:
        user = session.created_by
        return {"id": str(user.pk), "full_name": user.full_name} if user else None


class InterviewTurnSerializer(serializers.ModelSerializer):
    topic = serializers.SerializerMethodField()
    competency = serializers.SerializerMethodField()
    difficulty = serializers.SerializerMethodField()
    is_follow_up = serializers.SerializerMethodField()
    from_bank = serializers.SerializerMethodField()
    score = serializers.SerializerMethodField()
    feedback = serializers.SerializerMethodField()
    criteria = serializers.SerializerMethodField()
    flags = serializers.SerializerMethodField()

    class Meta:
        model = InterviewTurn
        fields = [
            "index", "question_text", "topic", "competency", "difficulty", "is_follow_up", "from_bank", "asked_at",
            "answer_text", "answer_source", "answered_at", "score", "feedback", "criteria", "flags",
        ]  # fmt: skip
        read_only_fields = fields

    def get_topic(self, turn) -> str:
        return turn.question_meta.get("topic", "")

    def get_competency(self, turn) -> str:
        return turn.question_meta.get("competency", "")

    def get_difficulty(self, turn) -> str:
        return turn.question_meta.get("difficulty", "")

    def get_is_follow_up(self, turn) -> bool:
        return bool(turn.question_meta.get("is_follow_up"))

    def get_from_bank(self, turn) -> bool:
        return bool(turn.question_meta.get("from_bank"))

    def get_score(self, turn) -> float | None:
        return float(turn.score) if turn.score is not None else None

    def get_feedback(self, turn) -> str:
        return turn.evaluation.get("feedback", "")

    def get_criteria(self, turn) -> dict:
        return turn.evaluation.get("criteria", {})

    def get_flags(self, turn) -> list:
        return turn.evaluation.get("flags", [])


class InviteResponseSerializer(InterviewSessionSerializer):
    warnings = serializers.SerializerMethodField(help_text="Things HR should know about this invitation, for example a job with no required skills.")

    class Meta(InterviewSessionSerializer.Meta):
        fields = InterviewSessionSerializer.Meta.fields + ["warnings"]
        read_only_fields = fields

    def get_warnings(self, session) -> list:
        return list(getattr(session, "invite_warnings", []))


class InterviewDetailSerializer(InterviewSessionSerializer):
    turns = InterviewTurnSerializer(many=True, read_only=True)
    ai_disclaimer = serializers.SerializerMethodField()
    report_message = serializers.SerializerMethodField(help_text="Why the report is empty, when it is.")

    class Meta(InterviewSessionSerializer.Meta):
        fields = InterviewSessionSerializer.Meta.fields + ["report", "report_message", "turns", "ai_disclaimer"]
        read_only_fields = fields

    def get_report_message(self, session) -> str:
        if session.report or session.status not in ("completed", "incomplete", "evaluating", "evaluated", "evaluation_failed"):
            return ""
        return "Report not available yet"

    def get_ai_disclaimer(self, session) -> str:
        return AI_DISCLAIMER


class ExpiryResponseSerializer(serializers.Serializer):
    expires_at = serializers.DateTimeField()


# --- Candidate side (public) ------------------------------------------------------------------------------------
class PublicTurnSerializer(serializers.Serializer):
    index = serializers.IntegerField()
    question_text = serializers.CharField()
    asked_at = serializers.DateTimeField()
    is_follow_up = serializers.BooleanField(help_text="True when this question follows up a weak answer (technical interviews).")


class PublicSummarySerializer(serializers.Serializer):
    company_name = serializers.CharField()
    role_title = serializers.CharField()
    kind = serializers.CharField()
    status = serializers.CharField()
    instructions = serializers.CharField()
    question_count = serializers.IntegerField()
    answered_count = serializers.IntegerField()
    estimated_minutes = serializers.IntegerField()
    expires_at = serializers.DateTimeField()
    seconds_left_to_start = serializers.IntegerField(allow_null=True, help_text="Null once the interview has been started.")
    voice_available = serializers.BooleanField(help_text="Show the record button only when true.")
    ai_disclaimer = serializers.CharField()
    current_turn = PublicTurnSerializer(allow_null=True)


class PublicProgressSerializer(serializers.Serializer):
    done = serializers.BooleanField()
    turn = PublicTurnSerializer(allow_null=True, help_text="The question to show next; null when `done`.")
    answered_count = serializers.IntegerField()
    question_count = serializers.IntegerField()


class AnswerSerializer(serializers.Serializer):
    turn_index = serializers.IntegerField(min_value=1)
    answer_text = serializers.CharField(required=False, allow_blank=True, trim_whitespace=False)
    audio = serializers.FileField(required=False)

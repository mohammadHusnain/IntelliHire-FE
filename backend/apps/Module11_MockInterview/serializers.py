from rest_framework import serializers

from .models import InterviewRole, InterviewType


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = InterviewRole
        fields = ["id", "slug", "title", "category", "description", "focus_skills"]
        read_only_fields = fields


class CreateMockSerializer(serializers.Serializer):
    interview_type = serializers.ChoiceField(choices=InterviewType.choices)
    role_id = serializers.UUIDField(required=False, help_text="Required for a role-specific interview; ignored for a general one.")
    use_cv = serializers.BooleanField(default=False, help_text="Let the questions be conditioned on your CV text (a profile CV is needed).")
    question_count = serializers.IntegerField(required=False, help_text="8 to 10 (default 8).")


class MockRowSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    date = serializers.DateTimeField()
    role_title = serializers.CharField()
    interview_type = serializers.CharField()
    overall_score = serializers.FloatField(allow_null=True, help_text="0 to 100; empty until the feedback is ready.")
    status = serializers.CharField()
    feedback_status = serializers.ChoiceField(choices=["none", "generating", "ready", "partial", "failed"])
    answered_count = serializers.IntegerField()
    question_count = serializers.IntegerField()


class _TurnSerializer(serializers.Serializer):
    index = serializers.IntegerField()
    question_text = serializers.CharField()
    asked_at = serializers.DateTimeField()
    is_follow_up = serializers.BooleanField()


class _TranscriptSerializer(serializers.Serializer):
    index = serializers.IntegerField()
    question = serializers.CharField()
    answer = serializers.CharField()
    answer_source = serializers.CharField()
    score = serializers.FloatField(allow_null=True)
    feedback = serializers.CharField(allow_blank=True)
    criteria = serializers.DictField(child=serializers.FloatField())


class MockDetailSerializer(MockRowSerializer):
    use_cv = serializers.BooleanField()
    target_role = serializers.DictField(allow_null=True)
    started_at = serializers.DateTimeField(allow_null=True)
    completed_at = serializers.DateTimeField(allow_null=True)
    feedback_message = serializers.CharField(allow_blank=True, help_text="What to tell the candidate about the feedback right now.")
    voice_available = serializers.BooleanField(help_text="Show the record button only when true.")
    disclaimer = serializers.CharField()
    current_turn = _TurnSerializer(allow_null=True, help_text="The question waiting for an answer while the session is open.")
    report = serializers.JSONField(allow_null=True, help_text="summary, strengths, weaknesses, suggestions, dimension_comments and the computed rubric_averages, once feedback exists.")
    transcript = _TranscriptSerializer(many=True)


class DimensionAveragesSerializer(serializers.DictField):
    child = serializers.FloatField()


class ScorePointSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    date = serializers.DateTimeField()
    score = serializers.FloatField()


class MockProgressSerializer(serializers.Serializer):
    scored_sessions = serializers.IntegerField()
    scores_over_time = ScorePointSerializer(many=True)
    dimension_averages = DimensionAveragesSerializer(help_text="Average 0 to 10 per rubric dimension over the last 10 scored sessions.")
    best_score = serializers.FloatField(allow_null=True)
    latest_score = serializers.FloatField(allow_null=True)
    trend = serializers.ChoiceField(choices=["improving", "flat", "declining"], allow_null=True, help_text="Last 3 scores against the 3 before; null below 4 scored sessions.")

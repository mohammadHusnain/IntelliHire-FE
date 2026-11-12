from rest_framework import serializers

from .models import Decision, EvaluationWeights, MissingStagePolicy
from .services.decision import NOTE_MAX
from .services.report import DISCLAIMER


class WeightsSerializer(serializers.ModelSerializer):
    class Meta:
        model = EvaluationWeights
        fields = ["weight_cv", "weight_screening", "weight_technical", "missing_stage_policy", "updated_at"]
        read_only_fields = ["updated_at"]
        extra_kwargs = {
            "weight_cv": {"required": False, "min_value": 0, "max_value": 100},
            "weight_screening": {"required": False, "min_value": 0, "max_value": 100},
            "weight_technical": {"required": False, "min_value": 0, "max_value": 100},
            "missing_stage_policy": {"required": False},
        }

    def validate(self, data):
        current = self.instance
        merged = {key: data.get(key, getattr(current, key)) for key in ("weight_cv", "weight_screening", "weight_technical")}
        if sum(merged.values()) != 100:
            raise serializers.ValidationError({"weights": [f"The three weights must add up to 100 (they add up to {sum(merged.values())})."]})
        return data


class _PersonSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    full_name = serializers.CharField()


class DecisionSerializer(serializers.ModelSerializer):
    decided_by = serializers.SerializerMethodField()

    class Meta:
        from .models import HRDecision

        model = HRDecision
        fields = ["id", "decision", "decided_by", "decided_at", "note", "ai_recommendation", "overrode_ai", "notified_candidate"]
        read_only_fields = fields

    def get_decided_by(self, row) -> dict:
        return {"id": str(row.decided_by_id), "full_name": row.decided_by.full_name}


class DecisionInputSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=Decision.choices)
    note = serializers.CharField(required=False, allow_blank=True, max_length=NOTE_MAX, trim_whitespace=True)
    notify = serializers.BooleanField(default=True, help_text="Email the candidate (and notify their account). Default true.")


class OpeningsHintSerializer(serializers.Serializer):
    openings = serializers.IntegerField()
    selected = serializers.IntegerField()
    filled = serializers.BooleanField()


class DecisionResponseSerializer(serializers.Serializer):
    decision = DecisionSerializer()
    status = serializers.CharField(help_text="The application's new status.")
    hint = OpeningsHintSerializer(help_text="For HR only: whether the job's openings are now filled. Selecting never closes the job.")


class ScoresSerializer(serializers.Serializer):
    cv = serializers.FloatField(allow_null=True)
    screening = serializers.FloatField(allow_null=True)
    technical = serializers.FloatField(allow_null=True)
    composite = serializers.FloatField()


def _f(value):
    return None if value is None else float(value)


def scores_of(evaluation):
    return {"cv": _f(evaluation.cv_score), "screening": _f(evaluation.screening_score), "technical": _f(evaluation.technical_score), "composite": _f(evaluation.composite_score)}


class EvaluationRankingRowSerializer(serializers.Serializer):
    rank = serializers.IntegerField()
    application_id = serializers.UUIDField()
    reference = serializers.CharField()
    full_name = serializers.CharField()
    email = serializers.EmailField()
    status = serializers.CharField()
    submitted_at = serializers.DateTimeField()
    cv_score = serializers.FloatField(allow_null=True)
    screening_score = serializers.FloatField(allow_null=True)
    technical_score = serializers.FloatField(allow_null=True)
    composite_score = serializers.FloatField()
    is_partial = serializers.BooleanField()
    missing_stages = serializers.ListField(child=serializers.CharField())
    report_status = serializers.CharField()
    recommendation = serializers.CharField(help_text="The report's recommendation, or empty until a report is ready.")
    decision = serializers.CharField(allow_null=True, help_text="HR's current decision, if any.")


def ranking_row(evaluation):
    a = evaluation.application
    return {
        "rank": evaluation.rank, "application_id": a.pk, "reference": a.reference, "full_name": a.full_name, "email": a.email,
        "status": a.status, "submitted_at": a.submitted_at, "cv_score": _f(evaluation.cv_score), "screening_score": _f(evaluation.screening_score),
        "technical_score": _f(evaluation.technical_score), "composite_score": _f(evaluation.composite_score), "is_partial": evaluation.is_partial,
        "missing_stages": evaluation.missing_stages, "report_status": evaluation.report_status,
        "recommendation": evaluation.report.get("recommendation", "") if evaluation.report_status == "ready" else "",
        "decision": evaluation.current_decision,
    }  # fmt: skip


class CompareItemSerializer(serializers.Serializer):
    application_id = serializers.UUIDField()
    reference = serializers.CharField()
    full_name = serializers.CharField()
    status = serializers.CharField()
    scores = ScoresSerializer(allow_null=True)
    is_partial = serializers.BooleanField()
    missing_stages = serializers.ListField(child=serializers.CharField())
    strengths = serializers.ListField(child=serializers.CharField())
    weaknesses = serializers.ListField(child=serializers.CharField())
    matched_skills = serializers.ListField(child=serializers.CharField())
    missing_skills = serializers.ListField(child=serializers.CharField())
    recommendation = serializers.CharField()


class CompareSerializer(serializers.Serializer):
    applications = CompareItemSerializer(many=True)


def compare_item(application):
    evaluation = getattr(application, "evaluation", None)
    match = getattr(application, "cv_match", None)
    report = evaluation.report if evaluation and evaluation.report_status == "ready" else {}
    return {
        "application_id": application.pk, "reference": application.reference, "full_name": application.full_name, "status": application.status,
        "scores": scores_of(evaluation) if evaluation else None, "is_partial": evaluation.is_partial if evaluation else True,
        "missing_stages": evaluation.missing_stages if evaluation else ["cv", "screening", "technical"],
        "strengths": report.get("strengths", []), "weaknesses": report.get("weaknesses", []),
        "matched_skills": match.matched_skills if match else [], "missing_skills": match.missing_skills if match else [],
        "recommendation": report.get("recommendation", ""),
    }  # fmt: skip


class EvaluationDetailSerializer(serializers.Serializer):
    application_id = serializers.UUIDField()
    scores = ScoresSerializer()
    is_partial = serializers.BooleanField()
    missing_stages = serializers.ListField(child=serializers.CharField())
    weights_used = serializers.JSONField(help_text="The weights and policy behind the composite; a later change shows as recalculated.")
    report_status = serializers.CharField()
    report = serializers.JSONField(help_text="summary, strengths, weaknesses, stage_summaries, recommendation, ai_disclaimer. Empty until ready.")
    generated_at = serializers.DateTimeField(allow_null=True)
    ai_disclaimer = serializers.CharField()
    current_decision = DecisionSerializer(allow_null=True)
    decisions = DecisionSerializer(many=True)


def evaluation_detail(evaluation, decisions):
    return {
        "application_id": evaluation.application_id, "scores": scores_of(evaluation), "is_partial": evaluation.is_partial,
        "missing_stages": evaluation.missing_stages, "weights_used": evaluation.weights_used, "report_status": evaluation.report_status,
        "report": evaluation.report, "generated_at": evaluation.generated_at, "ai_disclaimer": DISCLAIMER,
        "current_decision": DecisionSerializer(decisions[0]).data if decisions else None,
        "decisions": DecisionSerializer(decisions, many=True).data,
    }  # fmt: skip

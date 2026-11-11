from rest_framework import serializers

from .labels import cv_label
from .models import CVAnalysis, CVMatch, JobScreeningConfig
from .services.scoring import job_signature

WEIGHT_FIELDS = ("weight_skills", "weight_experience", "weight_education", "weight_semantic")


class ScreeningConfigSerializer(serializers.ModelSerializer):
    warnings = serializers.SerializerMethodField()

    class Meta:
        model = JobScreeningConfig
        fields = [
            "auto_analyse", "shortlist_threshold", "auto_shortlist", "invite_on_shortlist",
            *WEIGHT_FIELDS, "updated_at", "warnings",
        ]  # fmt: skip
        read_only_fields = ["updated_at", "warnings"]
        extra_kwargs = {
            "shortlist_threshold": {"min_value": 0, "max_value": 100},
            **{name: {"min_value": 0, "max_value": 100} for name in WEIGHT_FIELDS},
        }

    def get_warnings(self, config) -> list:
        warnings = []
        if not config.job.required_skills:
            warnings.append("This job lists no required skills, so every CV gets full marks for skills.")
        return warnings

    def validate(self, attrs):
        weights = {name: attrs.get(name, getattr(self.instance, name)) for name in WEIGHT_FIELDS}
        if sum(weights.values()) != 100:
            raise serializers.ValidationError({"weights": ["The four weights must add up to 100."]})
        return attrs


class RunSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(choices=["missing", "rescore", "full"], default="missing")


class RunResponseSerializer(serializers.Serializer):
    mode = serializers.CharField()
    queued = serializers.IntegerField()


class ProgressSerializer(serializers.Serializer):
    total_applications = serializers.IntegerField()
    not_analysed = serializers.IntegerField()
    queued = serializers.IntegerField()
    processing = serializers.IntegerField()
    completed = serializers.IntegerField()
    failed = serializers.IntegerField()
    manual_review = serializers.IntegerField()
    paused = serializers.IntegerField(help_text="Queued analyses waiting for the daily limit or for the company to be active again.")
    stale_scores = serializers.IntegerField(help_text="Scores computed before the job's requirements or weights last changed.")
    in_progress = serializers.BooleanField()
    percent_done = serializers.IntegerField()


class ThresholdSerializer(serializers.Serializer):
    threshold = serializers.IntegerField(min_value=0, max_value=100, required=False)
    dry_run = serializers.BooleanField(default=False)


class ThresholdResponseSerializer(serializers.Serializer):
    threshold = serializers.IntegerField()
    shortlisted = serializers.IntegerField(required=False)
    would_shortlist = serializers.IntegerField(required=False)
    at_or_above = serializers.IntegerField(required=False)
    below = serializers.IntegerField(required=False)
    scored = serializers.IntegerField(required=False)


class RankingRowSerializer(serializers.Serializer):
    rank = serializers.IntegerField()
    id = serializers.UUIDField()
    reference = serializers.CharField()
    full_name = serializers.CharField()
    email = serializers.EmailField()
    status = serializers.CharField()
    submitted_at = serializers.DateTimeField()
    score = serializers.FloatField(allow_null=True)
    skills_score = serializers.FloatField(allow_null=True)
    experience_score = serializers.FloatField(allow_null=True)
    education_score = serializers.FloatField(allow_null=True)
    semantic_score = serializers.FloatField(allow_null=True)
    cv_label = serializers.CharField(allow_null=True)
    analysis_status = serializers.CharField(allow_null=True)
    stale = serializers.BooleanField()


def ranking_row(application, rank, signature):
    match = getattr(application, "cv_match", None)
    analysis = getattr(application, "cv_analysis", None)

    def part(name):
        return float(getattr(match, name)) if match else None

    return {
        "rank": rank,
        "id": application.pk,
        "reference": application.reference,
        "full_name": application.full_name,
        "email": application.email,
        "status": application.status,
        "submitted_at": application.submitted_at,
        "score": part("score"),
        "skills_score": part("skills_score"),
        "experience_score": part("experience_score"),
        "education_score": part("education_score"),
        "semantic_score": part("semantic_score"),
        "cv_label": cv_label(application),
        "analysis_status": analysis.status if analysis else None,
        "stale": bool(match and match.job_signature != signature),
    }


class MatchSerializer(serializers.ModelSerializer):
    stale = serializers.SerializerMethodField()
    explanation_is_ai_generated = serializers.SerializerMethodField()

    class Meta:
        model = CVMatch
        fields = [
            "score", "skills_score", "experience_score", "education_score", "semantic_score", "matched_skills",
            "missing_skills", "experience_years", "weights_used", "explanation", "explanation_is_ai_generated",
            "stale", "computed_at",
        ]  # fmt: skip
        read_only_fields = fields

    def get_stale(self, match) -> bool:
        job = match.application.job
        config = getattr(job, "screening_config", None)
        return bool(config) and match.job_signature != job_signature(job, config.weights)

    def get_explanation_is_ai_generated(self, match) -> bool:
        return bool(match.explanation)


class CVAnalysisSerializer(serializers.ModelSerializer):
    match = serializers.SerializerMethodField()
    cv_label = serializers.SerializerMethodField()
    notice = serializers.SerializerMethodField()

    class Meta:
        model = CVAnalysis
        fields = ["status", "failure_reason", "flags", "parsed", "attempts", "analysed_at", "cv_label", "match", "notice"]
        read_only_fields = fields

    def get_match(self, analysis) -> dict | None:
        match = getattr(analysis.application, "cv_match", None)
        return MatchSerializer(match).data if match else None

    def get_cv_label(self, analysis) -> str | None:
        return cv_label(analysis.application)

    def get_notice(self, analysis) -> str:
        return "Scores and the explanation are generated automatically to support, not replace, a person's review."

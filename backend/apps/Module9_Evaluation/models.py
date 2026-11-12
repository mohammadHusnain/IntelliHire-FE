import uuid

from django.conf import settings
from django.db import models
from django.db.models import F, Q
from django.db.models.functions import Length
from django.db.models.lookups import LessThanOrEqual
from django.utils import timezone

from apps.common.constraints import enum_check

DEFAULT_WEIGHTS = {"cv": 30, "screening": 30, "technical": 40}


class MissingStagePolicy(models.TextChoices):
    RENORMALISE = "renormalise", "Ignore missing stages and rescale the others"
    ZERO = "zero", "A missing stage counts as 0"


class ReportStatus(models.TextChoices):
    NONE = "none", "None"
    GENERATING = "generating", "Generating"
    READY = "ready", "Ready"
    FAILED = "failed", "Failed"


class Decision(models.TextChoices):
    SELECTED = "selected", "Selected"
    REJECTED = "rejected", "Rejected"
    ON_HOLD = "on_hold", "On hold"


class Recommendation(models.TextChoices):
    STRONG_YES = "strong_yes", "Strong yes"
    YES = "yes", "Yes"
    MAYBE = "maybe", "Maybe"
    NO = "no", "No"


class EvaluationWeights(models.Model):
    """How one job combines its three stage scores. Created with the defaults the first time it is needed."""

    job = models.OneToOneField("jobs.JobPosting", on_delete=models.CASCADE, related_name="evaluation_weights")
    weight_cv = models.PositiveSmallIntegerField(default=DEFAULT_WEIGHTS["cv"])
    weight_screening = models.PositiveSmallIntegerField(default=DEFAULT_WEIGHTS["screening"])
    weight_technical = models.PositiveSmallIntegerField(default=DEFAULT_WEIGHTS["technical"])
    missing_stage_policy = models.CharField(max_length=12, choices=MissingStagePolicy.choices, default=MissingStagePolicy.RENORMALISE)
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "evaluation weights"
        constraints = [
            models.CheckConstraint(
                condition=Q(weight_cv=100 - F("weight_screening") - F("weight_technical")), name="evalweights_sum_100"
            ),
            enum_check("missing_stage_policy", MissingStagePolicy, "evalweights_policy_valid"),
        ]

    @property
    def weights(self):
        return {"cv": self.weight_cv, "screening": self.weight_screening, "technical": self.weight_technical}

    def __str__(self):
        return f"Evaluation weights for {self.job_id}"


class CandidateEvaluation(models.Model):
    """One application's stage scores, composite score and AI-assisted report."""

    application = models.OneToOneField("applications.Application", on_delete=models.CASCADE, related_name="evaluation")
    job = models.ForeignKey("jobs.JobPosting", on_delete=models.CASCADE, related_name="+")  # denormalised for ranking
    cv_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    screening_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    technical_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    composite_score = models.DecimalField(max_digits=5, decimal_places=2)
    is_partial = models.BooleanField(default=False)
    missing_stages = models.JSONField(default=list, blank=True)
    # Snapshot of the weights and policy behind composite_score, so a later change shows up as "recalculated".
    weights_used = models.JSONField(default=dict)
    report = models.JSONField(default=dict, blank=True)
    report_status = models.CharField(max_length=12, choices=ReportStatus.choices, default=ReportStatus.NONE)
    # Report bookkeeping: the row is the source of truth, a claim makes duplicates harmless, the sweep re-queues.
    report_attempts = models.PositiveSmallIntegerField(default=0)
    next_report_at = models.DateTimeField(null=True, blank=True)
    report_claimed_at = models.DateTimeField(null=True, blank=True)
    generated_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["job", "-composite_score"], name="evaluation_job_score_idx"),
            models.Index(fields=["report_status", "next_report_at"], name="evaluation_report_due_idx"),
        ]
        constraints = [
            enum_check("report_status", ReportStatus, "evaluation_report_status_valid"),
            models.CheckConstraint(
                condition=Q(composite_score__gte=0, composite_score__lte=100)
                & (Q(cv_score__isnull=True) | Q(cv_score__gte=0, cv_score__lte=100))
                & (Q(screening_score__isnull=True) | Q(screening_score__gte=0, screening_score__lte=100))
                & (Q(technical_score__isnull=True) | Q(technical_score__gte=0, technical_score__lte=100)),
                name="evaluation_scores_range",
            ),
        ]

    def __str__(self):
        return f"Evaluation of {self.application_id}: {self.composite_score}"


class AppendOnlyError(Exception):
    """A recorded HR decision can never be changed or removed (FR-58)."""


class HRDecision(models.Model):
    """The permanent record of what HR decided. Append-only: the newest row is the current decision."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application = models.ForeignKey("applications.Application", on_delete=models.PROTECT, related_name="decisions")
    job = models.ForeignKey("jobs.JobPosting", on_delete=models.PROTECT, related_name="+")  # FR-58: the job opening id, no join
    decision = models.CharField(max_length=10, choices=Decision.choices)
    decided_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    decided_at = models.DateTimeField(default=timezone.now)
    note = models.TextField(blank=True)
    ai_recommendation = models.CharField(max_length=12, blank=True)
    overrode_ai = models.BooleanField(default=False)
    notified_candidate = models.BooleanField(default=False)

    class Meta:
        ordering = ["-decided_at", "-id"]
        indexes = [models.Index(fields=["application", "-decided_at"], name="hrdecision_app_time_idx")]
        constraints = [
            enum_check("decision", Decision, "hrdecision_decision_valid"),
            enum_check("ai_recommendation", Recommendation, "hrdecision_recommendation_valid", allow_blank=True),
            models.CheckConstraint(condition=LessThanOrEqual(Length("note"), 1000), name="hrdecision_note_length"),
        ]

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise AppendOnlyError("A recorded decision cannot be changed.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise AppendOnlyError("A recorded decision cannot be deleted.")

    def __str__(self):
        return f"{self.decision} for {self.application_id}"

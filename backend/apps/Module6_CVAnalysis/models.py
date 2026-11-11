from django.conf import settings
from django.core.validators import MaxValueValidator
from django.db import models
from django.db.models import F, Q
from django.utils import timezone

from apps.common.constraints import enum_check

DEFAULT_THRESHOLD = 70
DEFAULT_WEIGHTS = {"skills": 50, "experience": 25, "education": 15, "semantic": 10}


class JobScreeningConfig(models.Model):
    """How one job's CVs are analysed and shortlisted. Created with defaults the first time it is needed."""

    job = models.OneToOneField("jobs.JobPosting", on_delete=models.CASCADE, related_name="screening_config")
    auto_analyse = models.BooleanField(default=True)
    shortlist_threshold = models.PositiveSmallIntegerField(default=DEFAULT_THRESHOLD, validators=[MaxValueValidator(100)])
    auto_shortlist = models.BooleanField(default=False)
    invite_on_shortlist = models.BooleanField(default=False)
    weight_skills = models.PositiveSmallIntegerField(default=DEFAULT_WEIGHTS["skills"])
    weight_experience = models.PositiveSmallIntegerField(default=DEFAULT_WEIGHTS["experience"])
    weight_education = models.PositiveSmallIntegerField(default=DEFAULT_WEIGHTS["education"])
    weight_semantic = models.PositiveSmallIntegerField(default=DEFAULT_WEIGHTS["semantic"])
    # The job's own embedding, kept so it is paid for once per job text and embedding model.
    job_embedding = models.JSONField(null=True, blank=True)
    job_embedding_key = models.CharField(max_length=80, blank=True)
    # Set when HR starts a run; cleared when the "screening complete" notice goes out.
    run_requested_at = models.DateTimeField(null=True, blank=True)
    completion_notified_at = models.DateTimeField(null=True, blank=True)
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(shortlist_threshold__lte=100), name="screening_threshold_range"),
            models.CheckConstraint(
                condition=Q(weight_skills=100 - F("weight_experience") - F("weight_education") - F("weight_semantic")),
                name="screening_weights_sum_100",
            ),
        ]

    @property
    def weights(self):
        return {
            "skills": self.weight_skills,
            "experience": self.weight_experience,
            "education": self.weight_education,
            "semantic": self.weight_semantic,
        }

    def __str__(self):
        return f"Screening config for {self.job_id}"


class AnalysisStatus(models.TextChoices):
    QUEUED = "queued", "Queued"
    PROCESSING = "processing", "Processing"
    COMPLETED = "completed", "Completed"
    FAILED = "failed", "Failed"
    MANUAL_REVIEW = "manual_review", "Manual review required"


class CVAnalysis(models.Model):
    """The structured reading of one application's CV. `queued` also covers "waiting for its next retry"."""

    application = models.OneToOneField("applications.Application", on_delete=models.CASCADE, related_name="cv_analysis")
    status = models.CharField(max_length=15, choices=AnalysisStatus.choices, default=AnalysisStatus.QUEUED)
    parsed = models.JSONField(default=dict, blank=True)
    flags = models.JSONField(default=list, blank=True)
    text_chars = models.PositiveIntegerField(default=0)
    embedding = models.JSONField(null=True, blank=True)
    embedding_model = models.CharField(max_length=80, blank=True)
    parser_version = models.CharField(max_length=20, blank=True)
    failure_reason = models.CharField(max_length=200, blank=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    next_attempt_at = models.DateTimeField(default=timezone.now)
    claimed_at = models.DateTimeField(null=True, blank=True)
    analysed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "CV analyses"
        indexes = [
            models.Index(fields=["status", "next_attempt_at"], name="cvanalysis_status_due_idx"),
            models.Index(fields=["analysed_at"], name="cvanalysis_analysed_idx"),
        ]
        constraints = [enum_check("status", AnalysisStatus, "cvanalysis_status_valid")]

    def __str__(self):
        return f"CV analysis of {self.application_id} ({self.status})"


class CVMatch(models.Model):
    """How well one CV fits its job: the four part scores, the weighted total and what was (not) found."""

    application = models.OneToOneField("applications.Application", on_delete=models.CASCADE, related_name="cv_match")
    score = models.DecimalField(max_digits=5, decimal_places=2)
    skills_score = models.DecimalField(max_digits=5, decimal_places=2)
    experience_score = models.DecimalField(max_digits=5, decimal_places=2)
    education_score = models.DecimalField(max_digits=5, decimal_places=2)
    semantic_score = models.DecimalField(max_digits=5, decimal_places=2)
    matched_skills = models.JSONField(default=list, blank=True)
    missing_skills = models.JSONField(default=list, blank=True)
    experience_years = models.DecimalField(max_digits=4, decimal_places=1, default=0)
    weights_used = models.JSONField(default=dict)
    # Fingerprint of the job requirements and weights the score was computed with; a different current
    # fingerprint means the score is out of date.
    job_signature = models.CharField(max_length=64)
    explanation = models.TextField(blank=True)
    computed_at = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name_plural = "CV matches"
        indexes = [models.Index(fields=["-score"], name="cvmatch_score_idx")]
        constraints = [
            models.CheckConstraint(
                condition=Q(score__gte=0, score__lte=100)
                & Q(skills_score__gte=0, skills_score__lte=100)
                & Q(experience_score__gte=0, experience_score__lte=100)
                & Q(education_score__gte=0, education_score__lte=100)
                & Q(semantic_score__gte=0, semantic_score__lte=100),
                name="cvmatch_scores_range",
            )
        ]

    def __str__(self):
        return f"CV match of {self.application_id}: {self.score}"

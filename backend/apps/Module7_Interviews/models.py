import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.common.constraints import enum_check


class SessionKind(models.TextChoices):
    SCREENING = "screening", "Screening"
    TECHNICAL = "technical", "Technical"
    MOCK = "mock", "Mock"


class SessionStatus(models.TextChoices):
    INVITED = "invited", "Invited"
    IN_PROGRESS = "in_progress", "In progress"
    COMPLETED = "completed", "Completed"
    EVALUATING = "evaluating", "Evaluating"
    EVALUATED = "evaluated", "Evaluated"
    EXPIRED = "expired", "Expired"
    INTERRUPTED = "interrupted", "Interrupted"
    CANCELLED = "cancelled", "Cancelled"
    EVALUATION_FAILED = "evaluation_failed", "Evaluation failed"
    INCOMPLETE = "incomplete", "Finished early"


# A link that can still be used (or resumed) by the candidate. At most one such session per application and kind.
OPEN_STATUSES = (SessionStatus.INVITED, SessionStatus.IN_PROGRESS, SessionStatus.INTERRUPTED)
# The candidate is done; what remains is evaluation.
FINISHED_STATUSES = (
    SessionStatus.COMPLETED, SessionStatus.INCOMPLETE, SessionStatus.EVALUATING,
    SessionStatus.EVALUATED, SessionStatus.EVALUATION_FAILED,
)  # fmt: skip


class Recommendation(models.TextChoices):
    ADVANCE = "advance", "Advance"
    HOLD = "hold", "Hold"
    NOT_RECOMMENDED = "not_recommended", "Not recommended"


class AnswerSource(models.TextChoices):
    TYPED = "typed", "Typed"
    VOICE = "voice", "Voice"


class Difficulty(models.TextChoices):
    EASY = "easy", "Easy"
    MEDIUM = "medium", "Medium"
    HARD = "hard", "Hard"


class InterviewSession(models.Model):
    Kind = SessionKind
    Status = SessionStatus

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    kind = models.CharField(max_length=10, choices=SessionKind.choices)
    application = models.ForeignKey(
        "applications.Application", on_delete=models.CASCADE, null=True, blank=True, related_name="interviews"
    )
    candidate_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    # SHA-256 of the private link token. The raw token only ever appears in the invitation email.
    token_hash = models.CharField(max_length=64, unique=True)
    status = models.CharField(max_length=20, choices=SessionStatus.choices, default=SessionStatus.INVITED)
    role_title = models.CharField(max_length=150)
    # Fixed at invite time, so editing the job later never changes an interview in flight. No contact details.
    context = models.JSONField(default=dict, blank=True)
    question_target = models.PositiveSmallIntegerField()
    invited_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    last_activity_at = models.DateTimeField(null=True, blank=True)
    overall_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    recommendation = models.CharField(max_length=20, choices=Recommendation.choices, null=True, blank=True)
    report = models.JSONField(default=dict, blank=True)
    ai_disclaimer = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    # Evaluation bookkeeping: the row is the source of truth, the sweep re-queues anything stuck or due.
    evaluation_attempts = models.PositiveSmallIntegerField(default=0)
    next_evaluation_at = models.DateTimeField(null=True, blank=True)
    evaluation_claimed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-invited_at"]
        indexes = [
            models.Index(fields=["application", "kind", "-invited_at"], name="interview_app_kind_idx"),
            models.Index(fields=["status", "expires_at"], name="interview_status_expiry_idx"),
            models.Index(fields=["status", "last_activity_at"], name="interview_status_activity_idx"),
            models.Index(fields=["next_evaluation_at"], name="interview_next_eval_idx"),
        ]
        constraints = [
            enum_check("kind", SessionKind, "interview_kind_valid"),
            enum_check("status", SessionStatus, "interview_status_valid"),
            models.CheckConstraint(
                condition=Q(recommendation__isnull=True) | Q(recommendation__in=Recommendation.values),
                name="interview_recommendation_valid",
            ),
            models.CheckConstraint(
                condition=Q(overall_score__isnull=True) | Q(overall_score__gte=0, overall_score__lte=100),
                name="interview_score_range",
            ),
            models.CheckConstraint(condition=Q(question_target__gte=1), name="interview_target_positive"),
            models.CheckConstraint(condition=Q(ai_disclaimer=True), name="interview_disclaimer_always"),
            models.CheckConstraint(
                condition=Q(kind=SessionKind.MOCK) | Q(application__isnull=False), name="interview_company_kinds_have_application"
            ),
            models.UniqueConstraint(
                fields=["application", "kind"],
                condition=Q(status__in=[s.value for s in OPEN_STATUSES]) & Q(application__isnull=False),
                name="interview_one_open_per_application_kind",
            ),
        ]

    def __str__(self):
        return f"{self.kind} interview {self.pk} ({self.status})"


class InterviewTurn(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(InterviewSession, on_delete=models.CASCADE, related_name="turns")
    index = models.PositiveSmallIntegerField()
    question_text = models.TextField()
    # topic, competency, difficulty, is_follow_up, follow_up_of, from_bank (+ bank_id)
    question_meta = models.JSONField(default=dict, blank=True)
    asked_at = models.DateTimeField(auto_now_add=True)
    answer_text = models.TextField(blank=True)
    answer_source = models.CharField(max_length=10, choices=AnswerSource.choices, blank=True)
    answered_at = models.DateTimeField(null=True, blank=True)
    evaluation = models.JSONField(default=dict, blank=True)
    score = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)

    class Meta:
        ordering = ["session", "index"]
        constraints = [
            models.UniqueConstraint(fields=["session", "index"], name="interview_turn_unique_index"),
            models.CheckConstraint(condition=Q(index__gte=1), name="interview_turn_index_positive"),
            models.CheckConstraint(
                condition=Q(score__isnull=True) | Q(score__gte=0, score__lte=10), name="interview_turn_score_range"
            ),
            enum_check("answer_source", AnswerSource, "interview_turn_source_valid", allow_blank=True),
            # An answer always has its time, source and text together.
            models.CheckConstraint(
                condition=Q(answered_at__isnull=True, answer_text="", answer_source="")
                | (Q(answered_at__isnull=False) & ~Q(answer_text="") & ~Q(answer_source="")),
                name="interview_turn_answer_complete",
            ),
        ]

    def __str__(self):
        return f"Turn {self.index} of {self.session_id}"


class InterviewQuestionBank(models.Model):
    """Where questions come from until the LLM hook is merged, and the fallback afterwards."""

    kind = models.CharField(max_length=10, choices=SessionKind.choices)
    role_category = models.CharField(max_length=40, blank=True)  # blank = general
    skills = models.JSONField(default=list, blank=True)
    competency = models.CharField(max_length=40)
    text = models.TextField()
    difficulty = models.CharField(max_length=10, choices=Difficulty.choices, default=Difficulty.MEDIUM)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "interview question"
        indexes = [models.Index(fields=["kind", "is_active", "role_category"], name="iqbank_lookup_idx")]
        constraints = [
            enum_check("kind", SessionKind, "iqbank_kind_valid"),
            enum_check("difficulty", Difficulty, "iqbank_difficulty_valid"),
            models.UniqueConstraint(fields=["kind", "text"], name="iqbank_unique_text"),
        ]

    def __str__(self):
        return f"[{self.kind}/{self.competency}] {self.text[:60]}"

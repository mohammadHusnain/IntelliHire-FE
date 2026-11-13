import string
import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.common.constraints import enum_check


class ImmutableRecordError(Exception):
    """Raised when code tries to change or delete an append-only record."""


# --- Notifications ----------------------------------------------------------------------------------------------
class Notification(models.Model):
    """An in-app message for one user. Plain text only; `link` is always a path inside the frontend."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    kind = models.CharField(max_length=50)
    title = models.CharField(max_length=200)
    body = models.TextField(blank=True)
    link = models.CharField(max_length=300, blank=True)
    payload = models.JSONField(default=dict, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["user", "-created_at"], name="notification_user_time_idx"),
            models.Index(
                fields=["user", "-created_at"], condition=Q(read_at__isnull=True), name="notification_user_unread_idx"
            ),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(link="") | (Q(link__startswith="/") & ~Q(link__startswith="//")),
                name="notification_link_is_local_path",
            )
        ]

    def __str__(self):
        return f"{self.kind} -> {self.user_id}"


class NotificationPreference(models.Model):
    """Supported notification controls for one authenticated candidate or company user."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notification_preferences")
    email_communities = models.BooleanField(default=False)
    in_app_reminders = models.BooleanField(default=True)
    in_app_communities = models.BooleanField(default=True)
    notify_applicants = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Notification preferences for {self.user_id}"


# --- Email outbox -----------------------------------------------------------------------------------------------
class EmailStatus(models.TextChoices):
    QUEUED = "queued", "Queued"
    SENDING = "sending", "Sending"
    SENT = "sent", "Sent"
    FAILED = "failed", "Failed"


class OutboundEmail(models.Model):
    """One email to one recipient. `queued` also covers "waiting for its next retry"; `failed` is final."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    to_email = models.EmailField()
    subject = models.CharField(max_length=255)
    body_text = models.TextField(blank=True)
    body_html = models.TextField(blank=True)
    kind = models.CharField(max_length=50, default="general")
    # Sensitive emails carry a credential link (verify, reset, invite, interview): the body is wiped once it is no
    # longer needed.
    sensitive = models.BooleanField(default=False)
    body_purged = models.BooleanField(default=False)
    status = models.CharField(max_length=10, choices=EmailStatus.choices, default=EmailStatus.QUEUED)
    attempts = models.PositiveSmallIntegerField(default=0)
    next_attempt_at = models.DateTimeField(default=timezone.now)
    claimed_at = models.DateTimeField(null=True, blank=True)
    last_error = models.CharField(max_length=300, blank=True)
    related_type = models.CharField(max_length=50, blank=True)
    related_id = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["created_at", "id"]
        indexes = [
            models.Index(fields=["status", "next_attempt_at"], name="email_status_due_idx"),
            models.Index(fields=["created_at"], name="email_created_idx"),
        ]
        constraints = [enum_check("status", EmailStatus, "email_status_valid")]

    def __str__(self):
        return f"{self.kind} ({self.status})"


# --- Activity log -----------------------------------------------------------------------------------------------
class _AppendOnlyQuerySet(models.QuerySet):
    def update(self, **kwargs):
        raise ImmutableRecordError("Activity events cannot be changed.")

    def delete(self):
        raise ImmutableRecordError("Activity events cannot be deleted.")


class ActivityEvent(models.Model):
    """Append-only audit trail (FR-76). Written only through `events.log_event`."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event_type = models.CharField(max_length=60)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    company = models.ForeignKey("companies.Company", on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    target_type = models.CharField(max_length=50, blank=True)
    target_id = models.UUIDField(null=True, blank=True)
    summary = models.CharField(max_length=300)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    objects = _AppendOnlyQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["event_type", "-created_at"], name="activity_type_time_idx"),
            models.Index(fields=["company", "-created_at"], name="activity_company_time_idx"),
            models.Index(fields=["actor", "-created_at"], name="activity_actor_time_idx"),
            models.Index(fields=["target_type", "target_id"], name="activity_target_idx"),
        ]

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ImmutableRecordError("Activity events cannot be changed.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ImmutableRecordError("Activity events cannot be deleted.")

    def __str__(self):
        return f"{self.event_type}: {self.summary}"


# --- AI --------------------------------------------------------------------------------------------------------
class AIRequestStatus(models.TextChoices):
    OK = "ok", "OK"
    RETRIED = "retried", "Succeeded after a retry"
    FAILED = "failed", "Failed"
    FALLBACK_USED = "fallback_used", "Succeeded on the fallback provider"
    POLICY_BLOCKED = "policy_blocked", "Blocked by the provider's content policy"


class AIRequestLog(models.Model):
    """One row per logical AI call (LLM, embedding or speech). Never stores a prompt, an answer or a CV."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    feature = models.CharField(max_length=60)
    provider = models.CharField(max_length=30)
    model = models.CharField(max_length=80, blank=True)
    status = models.CharField(max_length=20, choices=AIRequestStatus.choices)
    attempts = models.PositiveSmallIntegerField(default=1)
    prompt_tokens = models.PositiveIntegerField(default=0)
    completion_tokens = models.PositiveIntegerField(default=0)
    latency_ms = models.PositiveIntegerField(default=0)
    error = models.CharField(max_length=300, blank=True)
    related_type = models.CharField(max_length=50, blank=True)
    related_id = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["created_at", "status"], name="airequest_time_status_idx"),
            models.Index(fields=["feature", "created_at"], name="airequest_feature_time_idx"),
        ]
        constraints = [enum_check("status", AIRequestStatus, "airequest_status_valid")]

    def __str__(self):
        return f"{self.feature} ({self.status})"


class ModelRole(models.TextChoices):
    CHAT = "chat", "Chat"
    EVAL = "eval", "Evaluation"


class PromptTemplate(models.Model):
    """A versioned prompt. Exactly one version per key is active; saving a new version never edits an old one."""

    key = models.CharField(max_length=100)
    version = models.PositiveIntegerField()
    model_role = models.CharField(max_length=10, choices=ModelRole.choices, default=ModelRole.CHAT)
    system_text = models.TextField()
    user_text = models.TextField()
    output_schema = models.JSONField(default=dict)
    is_active = models.BooleanField(default=False)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["key", "-version"]
        constraints = [
            models.UniqueConstraint(fields=["key", "version"], name="prompt_key_version_unique"),
            models.UniqueConstraint(fields=["key"], condition=Q(is_active=True), name="prompt_one_active_per_key"),
            models.CheckConstraint(condition=Q(version__gte=1), name="prompt_version_positive"),
            enum_check("model_role", ModelRole, "prompt_model_role_valid"),
        ]

    def placeholders(self):
        """Every field name used in the texts, exactly as written (so "a.b" or "0" can be spotted and refused)."""
        names = set()
        for text in (self.system_text, self.user_text):
            names.update(name for _, name, _, _ in string.Formatter().parse(text) if name is not None)
        return names

    def __str__(self):
        return f"{self.key} v{self.version}{' (active)' if self.is_active else ''}"


class AISettings(models.Model):
    """The single settings row platform admins edit. Blank or empty values fall back to Django settings."""

    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    provider = models.CharField(max_length=30, blank=True)
    chat_model = models.CharField(max_length=80, blank=True)
    eval_model = models.CharField(max_length=80, blank=True)
    embed_model = models.CharField(max_length=80, blank=True)
    stt_model = models.CharField(max_length=80, blank=True)
    fallback_provider = models.CharField(max_length=30, blank=True)
    fallback_chat_model = models.CharField(max_length=80, blank=True)
    temperature_questions = models.FloatField(default=0.7)
    temperature_evaluation = models.FloatField(default=0.2)
    max_tokens = models.JSONField(default=dict, blank=True)
    timeout_seconds = models.PositiveSmallIntegerField(null=True, blank=True)
    screening_min_score = models.PositiveSmallIntegerField(default=60)
    screening_questions = models.PositiveSmallIntegerField(default=6)
    technical_questions = models.PositiveSmallIntegerField(default=8)
    mock_questions = models.PositiveSmallIntegerField(default=8)
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "AI settings"
        constraints = [
            models.CheckConstraint(condition=Q(id=1), name="aisettings_single_row"),
            models.CheckConstraint(
                condition=Q(temperature_questions__gte=0, temperature_questions__lte=2), name="aisettings_temp_q_range"
            ),
            models.CheckConstraint(
                condition=Q(temperature_evaluation__gte=0, temperature_evaluation__lte=2), name="aisettings_temp_e_range"
            ),
            models.CheckConstraint(condition=Q(screening_min_score__lte=100), name="aisettings_min_score_range"),
            models.CheckConstraint(
                condition=Q(screening_questions__gte=3, screening_questions__lte=15)
                & Q(technical_questions__gte=3, technical_questions__lte=15)
                & Q(mock_questions__gte=3, mock_questions__lte=15),
                name="aisettings_question_counts_range",
            ),
        ]

    def clean(self):
        errors = {}
        allowed = set(settings.AI_ALLOWED_MODELS)
        for field in ("chat_model", "eval_model", "embed_model", "stt_model", "fallback_chat_model"):
            value = getattr(self, field)
            if value and value not in allowed:
                errors[field] = f"Unknown model. Allowed: {', '.join(sorted(allowed))}."
        if self.timeout_seconds is not None and not 5 <= self.timeout_seconds <= 120:
            errors["timeout_seconds"] = "Must be between 5 and 120 seconds."
        if not isinstance(self.max_tokens, dict) or any(
            not isinstance(v, int) or isinstance(v, bool) or not 1 <= v <= 8000 for v in self.max_tokens.values()
        ):
            errors["max_tokens"] = "Must map a feature name to a number between 1 and 8000."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.id = 1
        # The primary key has a default, so Django would force an INSERT for a new instance and collide with the
        # existing row; saving a fresh instance must update the single row instead.
        if self._state.adding and not kwargs.get("force_insert") and AISettings.objects.filter(pk=1).exists():
            self._state.adding = False
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ImmutableRecordError("The AI settings row cannot be deleted.")

    @classmethod
    def load(cls):
        return cls.objects.get_or_create(pk=1)[0]

    def __str__(self):
        return "AI settings"


# --- System alerts ----------------------------------------------------------------------------------------------
class AlertKind(models.TextChoices):
    AI_FAILURE_RATE = "ai_failure_rate", "AI failure rate"
    EMAIL_QUEUE_BACKLOG = "email_queue_backlog", "Email queue backlog"
    WORKER_DOWN = "worker_down", "Background worker down"
    BACKUP_MISSING = "backup_missing", "Backup missing"


class AlertSeverity(models.TextChoices):
    WARNING = "warning", "Warning"
    CRITICAL = "critical", "Critical"


class SystemAlert(models.Model):
    """At most one active alert per kind; the check job opens, updates and resolves it."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    kind = models.CharField(max_length=30, choices=AlertKind.choices)
    severity = models.CharField(max_length=10, choices=AlertSeverity.choices)
    message = models.CharField(max_length=300)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    resolved_at = models.DateTimeField(null=True, blank=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    acknowledged_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(fields=["kind"], condition=Q(is_active=True), name="alert_one_active_per_kind"),
            enum_check("kind", AlertKind, "alert_kind_valid"),
            enum_check("severity", AlertSeverity, "alert_severity_valid"),
        ]

    def __str__(self):
        return f"{self.kind} ({self.severity})"

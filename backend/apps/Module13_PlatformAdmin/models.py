import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.common.constraints import enum_check


class FlagTarget(models.TextChoices):
    USER = "user", "User"
    COMPANY = "company", "Company"
    JOB = "job", "Job"
    COMMUNITY = "community", "Community"
    POST = "community_post", "Community post"


class FlagSource(models.TextChoices):
    REPORTED = "reported", "Reported by a user"
    ADMIN = "admin", "Raised by a platform admin"
    SYSTEM = "system", "Raised by the system"


class FlagStatus(models.TextChoices):
    OPEN = "open", "Open"
    REVIEWING = "reviewing", "Reviewing"
    DISMISSED = "dismissed", "Dismissed"
    ACTIONED = "actioned", "Actioned"


class FlagAction(models.TextChoices):
    NONE = "none", "No action"
    SUSPEND_USER = "suspended_user", "User suspended"
    SUSPEND_COMPANY = "suspended_company", "Company suspended"
    CLOSE_JOB = "closed_job", "Job closed"
    REMOVE_COMMUNITY = "removed_community", "Community removed"
    REMOVE_POST = "removed_post", "Post removed"


class ModerationFlag(models.Model):
    """Something a person or the system asked a platform admin to look at (FR-76)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    target_type = models.CharField(max_length=15, choices=FlagTarget.choices)
    target_id = models.UUIDField()
    reason = models.CharField(max_length=1000)
    source = models.CharField(max_length=10, choices=FlagSource.choices)
    reported_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    # SHA-256 of the reporter's address for anonymous reports, so the same visitor cannot pile up duplicates.
    reporter_fingerprint = models.CharField(max_length=64, blank=True)
    status = models.CharField(max_length=10, choices=FlagStatus.choices, default=FlagStatus.OPEN)
    resolved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    resolution_note = models.CharField(max_length=1000, blank=True)
    action_taken = models.CharField(max_length=20, choices=FlagAction.choices, default=FlagAction.NONE)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["status", "-created_at"], name="flag_status_time_idx"),
            models.Index(fields=["target_type", "target_id"], name="flag_target_idx"),
        ]
        constraints = [
            enum_check("target_type", FlagTarget, "flag_target_type_valid"),
            enum_check("source", FlagSource, "flag_source_valid"),
            enum_check("status", FlagStatus, "flag_status_valid"),
            enum_check("action_taken", FlagAction, "flag_action_valid"),
            models.CheckConstraint(
                condition=Q(status__in=["open", "reviewing"]) | ~Q(resolution_note=""), name="flag_resolution_needs_note"
            ),
        ]

    def __str__(self):
        return f"{self.target_type} flag ({self.status})"


class BackupStatus(models.TextChoices):
    SUCCESS = "success", "Success"
    FAILED = "failed", "Failed"


class BackupRecord(models.Model):
    """Written by the deployment's backup job through `manage.py record_backup`; the platform only reads it."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    started_at = models.DateTimeField()
    finished_at = models.DateTimeField()
    status = models.CharField(max_length=10, choices=BackupStatus.choices)
    size_bytes = models.PositiveBigIntegerField(default=0)
    location = models.CharField(max_length=300, blank=True)
    notes = models.CharField(max_length=500, blank=True)

    class Meta:
        ordering = ["-finished_at", "-id"]
        constraints = [enum_check("status", BackupStatus, "backup_status_valid")]

    def __str__(self):
        return f"Backup {self.finished_at:%Y-%m-%d %H:%M} ({self.status})"

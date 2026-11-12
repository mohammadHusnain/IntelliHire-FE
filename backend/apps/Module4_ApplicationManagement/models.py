import hashlib
import secrets
import uuid
from pathlib import Path

from django.conf import settings
from django.db import models
from django.db.models.functions import Lower

from apps.Module3_JobPosting.models import EducationLevel
from apps.common.constraints import enum_check
from apps.common.storage import private_storage
from apps.common.validators import validate_cv_file


class ApplicationStatus(models.TextChoices):
    SUBMITTED = "submitted", "Applied"
    UNDER_REVIEW = "under_review", "Under review"
    SHORTLISTED = "shortlisted", "Shortlisted"
    INTERVIEW = "interview", "Interview"
    SELECTED = "selected", "Selected"
    REJECTED = "rejected", "Rejected"
    ON_HOLD = "on_hold", "On hold"


def application_upload_path(instance, filename):
    """applications/<job_id>/<random>.<ext>: never the candidate's own file name."""
    application = getattr(instance, "application", instance)
    return f"applications/{application.job_id}/{uuid.uuid4().hex}{Path(filename).suffix.lower()}"


def random_tracking_hash():
    """A hash nobody knows the token of: the default for an application created without one (tests, admin, imports)."""
    return hashlib.sha256(secrets.token_urlsafe(24).encode()).hexdigest()


class Application(models.Model):
    Status = ApplicationStatus

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference = models.CharField(max_length=20, unique=True)
    job = models.ForeignKey("jobs.JobPosting", on_delete=models.PROTECT, related_name="applications")
    candidate_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    full_name = models.CharField(max_length=150)
    email = models.EmailField()
    phone = models.CharField(max_length=20)
    education_level = models.CharField(max_length=20, choices=EducationLevel.choices)
    institution = models.CharField(max_length=200)
    graduation_year = models.PositiveSmallIntegerField()
    resume = models.FileField(
        upload_to=application_upload_path, storage=private_storage, validators=[validate_cv_file], max_length=255
    )
    resume_original_name = models.CharField(max_length=255)
    answers = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=ApplicationStatus.choices, default=ApplicationStatus.SUBMITTED)
    # SHA-256 of the private tracking link (never shown to company users). Raw token: confirmation and lost-link emails only.
    tracking_token_hash = models.CharField(max_length=64, unique=True, editable=False, default=random_tracking_hash)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["job", "status"], name="application_job_status_idx"),
            models.Index(fields=["job", "submitted_at"], name="application_job_submitted_idx"),
        ]
        constraints = [
            models.UniqueConstraint(fields=["job", "email"], name="application_one_per_job_email"),
            models.CheckConstraint(condition=models.Q(email=Lower("email")), name="application_email_lowercase"),
            models.CheckConstraint(
                condition=models.Q(graduation_year__gte=1970, graduation_year__lte=2100),
                name="application_graduation_year_range",
            ),
            enum_check("status", ApplicationStatus, "application_status_valid"),
            enum_check("education_level", EducationLevel, "application_education_level_valid"),
        ]

    def __str__(self):
        return self.reference


class ApplicationFile(models.Model):
    """The answer to a custom field of type `file`."""

    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name="files")
    field_key = models.SlugField(max_length=150)
    file = models.FileField(
        upload_to=application_upload_path, storage=private_storage, validators=[validate_cv_file], max_length=255
    )
    original_name = models.CharField(max_length=255)
    size = models.PositiveIntegerField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["application", "field_key"], name="application_file_one_per_field")
        ]

    def __str__(self):
        return f"{self.application.reference}:{self.field_key}"


class StatusChangeSource(models.TextChoices):
    HR = "hr", "A company user"
    SYSTEM = "system", "Automatic"


class ApplicationStatusChange(models.Model):
    """Audit trail of status changes; automatic rows (the first one included) have no `changed_by`."""

    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name="status_history")
    from_status = models.CharField(max_length=20, blank=True)
    to_status = models.CharField(max_length=20)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    note = models.TextField(blank=True)
    source = models.CharField(max_length=10, choices=StatusChangeSource.choices, default=StatusChangeSource.HR)
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["changed_at", "id"]
        indexes = [models.Index(fields=["application", "changed_at"], name="status_change_app_time_idx")]
        constraints = [
            enum_check("from_status", ApplicationStatus, "status_change_from_valid", allow_blank=True),
            enum_check("to_status", ApplicationStatus, "status_change_to_valid"),
            enum_check("source", StatusChangeSource, "status_change_source_valid"),
        ]

    def __str__(self):
        return f"{self.application.reference}: {self.from_status or '-'} -> {self.to_status}"


class ApplicationNote(models.Model):
    """A free note a company teammate leaves on an application. Notes are never edited or deleted (audit trail)."""

    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name="notes")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["application", "created_at"], name="app_note_app_time_idx")]
        constraints = [models.CheckConstraint(condition=~models.Q(text=""), name="app_note_text_not_empty")]

    def __str__(self):
        return f"{self.application.reference}: {self.text[:40]}"

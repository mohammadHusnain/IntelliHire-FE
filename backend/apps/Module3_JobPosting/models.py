import uuid

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from apps.common.choices import CompanyStatus
from apps.common.constraints import enum_check


class EmploymentType(models.TextChoices):
    FULL_TIME = "full_time", "Full time"
    PART_TIME = "part_time", "Part time"
    INTERNSHIP = "internship", "Internship"
    CONTRACT = "contract", "Contract"


class WorkMode(models.TextChoices):
    ONSITE = "onsite", "On-site"
    REMOTE = "remote", "Remote"
    HYBRID = "hybrid", "Hybrid"


class EducationLevel(models.TextChoices):
    NONE = "none", "None"
    INTERMEDIATE = "intermediate", "Intermediate"
    BACHELOR = "bachelor", "Bachelor's degree"
    MASTER = "master", "Master's degree"
    PHD = "phd", "PhD"


class JobStatus(models.TextChoices):
    DRAFT = "draft"
    OPEN = "open"
    CLOSED = "closed"


class CloseReason(models.TextChoices):
    MANUAL = "manual"
    DEADLINE = "deadline"


class FieldType(models.TextChoices):
    SHORT_TEXT = "short_text"
    LONG_TEXT = "long_text"
    NUMBER = "number"
    EMAIL = "email"
    URL = "url"
    DATE = "date"
    SINGLE_CHOICE = "single_choice"
    MULTIPLE_CHOICE = "multiple_choice"
    FILE = "file"


CHOICE_TYPES = (FieldType.SINGLE_CHOICE, FieldType.MULTIPLE_CHOICE)
TEXT_TYPES = (FieldType.SHORT_TEXT, FieldType.LONG_TEXT)


class JobPosting(models.Model):
    Status = JobStatus

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT, related_name="jobs")
    title = models.CharField(max_length=150)
    department = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    responsibilities = models.TextField(blank=True)
    employment_type = models.CharField(max_length=20, choices=EmploymentType.choices, blank=True)
    work_mode = models.CharField(max_length=10, choices=WorkMode.choices, blank=True)
    location = models.CharField(max_length=200, blank=True)
    required_skills = models.JSONField(default=list, blank=True)
    soft_skills = models.JSONField(default=list, blank=True)
    min_experience_years = models.PositiveSmallIntegerField(
        default=0, validators=[MinValueValidator(0), MaxValueValidator(30)]
    )
    education_level = models.CharField(max_length=20, choices=EducationLevel.choices, default=EducationLevel.NONE)
    salary_min = models.PositiveIntegerField(null=True, blank=True)
    salary_max = models.PositiveIntegerField(null=True, blank=True)
    salary_currency = models.CharField(max_length=10, blank=True)
    show_salary = models.BooleanField(default=False)
    openings = models.PositiveSmallIntegerField(default=1)
    deadline = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=JobStatus.choices, default=JobStatus.DRAFT)
    form_slug = models.CharField(max_length=32, unique=True, null=True, blank=True)
    close_reason = models.CharField(max_length=10, choices=CloseReason.choices, null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["company", "status"], name="job_company_status_idx"),
            models.Index(fields=["status", "deadline"], name="job_status_deadline_idx"),
        ]
        constraints = [
            enum_check("status", JobStatus, "job_status_valid"),
            enum_check("employment_type", EmploymentType, "job_employment_type_valid", allow_blank=True),
            enum_check("work_mode", WorkMode, "job_work_mode_valid", allow_blank=True),
            enum_check("education_level", EducationLevel, "job_education_level_valid"),
            models.CheckConstraint(
                condition=models.Q(close_reason__isnull=True) | models.Q(close_reason__in=CloseReason.values),
                name="job_close_reason_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(min_experience_years__gte=0, min_experience_years__lte=30),
                name="job_experience_range",
            ),
            models.CheckConstraint(condition=models.Q(openings__gte=1), name="job_openings_positive"),
            models.CheckConstraint(
                condition=models.Q(salary_min__isnull=True)
                | models.Q(salary_max__isnull=True)
                | models.Q(salary_max__gte=models.F("salary_min")),
                name="job_salary_range",
            ),
            models.CheckConstraint(
                condition=~models.Q(status="draft") | models.Q(form_slug__isnull=True),
                name="job_draft_has_no_slug",
            ),
            models.CheckConstraint(
                condition=~models.Q(status="open")
                | (
                    models.Q(form_slug__isnull=False)
                    & models.Q(published_at__isnull=False)
                    & models.Q(deadline__isnull=False)
                ),
                name="job_open_is_published",
            ),
            models.CheckConstraint(
                condition=~models.Q(status="closed")
                | (
                    models.Q(form_slug__isnull=False)
                    & models.Q(published_at__isnull=False)
                    & models.Q(closed_at__isnull=False)
                    & models.Q(close_reason__isnull=False)
                ),
                name="job_closed_has_close_info",
            ),
            models.CheckConstraint(
                condition=models.Q(status="closed")
                | (models.Q(close_reason__isnull=True) & models.Q(closed_at__isnull=True)),
                name="job_only_closed_has_close_info",
            ),
        ]

    @property
    def is_accepting_applications(self):
        """Open, before the deadline and the company is approved. Every public check uses this."""
        return bool(
            self.status == JobStatus.OPEN
            and self.deadline is not None
            and self.deadline > timezone.now()
            and self.company.status == CompanyStatus.APPROVED
        )

    @property
    def share_url(self):
        if not self.form_slug:
            return ""
        return f"{settings.FRONTEND_URL.rstrip('/')}/apply/{self.form_slug}"

    def __str__(self):
        return self.title


class ApplicationField(models.Model):
    FieldType = FieldType

    job = models.ForeignKey(JobPosting, on_delete=models.CASCADE, related_name="custom_fields")
    label = models.CharField(max_length=150)
    key = models.SlugField(max_length=150)
    field_type = models.CharField(max_length=20, choices=FieldType.choices)
    required = models.BooleanField(default=False)
    options = models.JSONField(default=list, blank=True)
    help_text = models.CharField(max_length=500, blank=True)
    max_length = models.PositiveIntegerField(null=True, blank=True)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]
        indexes = [models.Index(fields=["job", "order"], name="field_job_order_idx")]
        constraints = [
            models.UniqueConstraint(fields=["job", "key"], name="field_key_unique_per_job"),
            enum_check("field_type", FieldType, "field_type_valid"),
            models.CheckConstraint(
                condition=models.Q(max_length__isnull=True) | models.Q(max_length__gte=1),
                name="field_max_length_positive",
            ),
        ]

    def __str__(self):
        return f"{self.label} ({self.key})"

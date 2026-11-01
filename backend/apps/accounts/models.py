import uuid

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone

from apps.common.constraints import enum_check
from apps.common.storage import RandomUploadPath, private_storage
from apps.common.validators import validate_cv_file, validate_profile_image

from .managers import UserManager


class UserRole(models.TextChoices):
    CANDIDATE = "candidate"
    COMPANY_ADMIN = "company_admin"
    HR = "hr"
    PLATFORM_ADMIN = "platform_admin"


class UserStatus(models.TextChoices):
    PENDING_VERIFICATION = "pending_verification"
    PENDING_APPROVAL = "pending_approval"
    ACTIVE = "active"
    REJECTED = "rejected"
    SUSPENDED = "suspended"


class User(AbstractBaseUser, PermissionsMixin):
    Role = UserRole
    Status = UserStatus

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=150)
    role = models.CharField(max_length=20, choices=Role.choices)
    status = models.CharField(max_length=24, choices=Status.choices)
    email_verified = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]

    class Meta:
        indexes = [models.Index(fields=["role", "status"], name="user_role_status_idx")]
        constraints = [
            models.CheckConstraint(condition=models.Q(email=Lower("email")), name="user_email_lowercase"),
            enum_check("role", UserRole, "user_role_valid"),
            enum_check("status", UserStatus, "user_status_valid"),
        ]

    def save(self, *args, **kwargs):
        self.email = self.email.strip().lower()
        super().save(*args, **kwargs)

    @property
    def is_active(self):
        return self.status == self.Status.ACTIVE

    def __str__(self):
        return self.email


class CandidateProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="candidate_profile")
    phone = models.CharField(max_length=20, blank=True)
    headline = models.CharField(max_length=150, blank=True)
    location = models.CharField(max_length=150, blank=True)
    avatar = models.ImageField(
        upload_to=RandomUploadPath("avatars"), blank=True, validators=[validate_profile_image]
    )
    linkedin_url = models.URLField(max_length=300, blank=True)
    github_url = models.URLField(max_length=300, blank=True)
    skills = models.JSONField(default=list, blank=True)
    resume = models.FileField(
        upload_to=RandomUploadPath("resumes"),
        storage=private_storage,
        blank=True,
        validators=[validate_cv_file],
    )
    resume_text = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Profile of {self.user.email}"


class Education(models.Model):
    profile = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name="education")
    institution = models.CharField(max_length=200)
    degree = models.CharField(max_length=150)
    field_of_study = models.CharField(max_length=150)
    start_year = models.PositiveSmallIntegerField()
    end_year = models.PositiveSmallIntegerField(null=True, blank=True)
    grade = models.CharField(max_length=50, blank=True)

    class Meta:
        ordering = ["-start_year", "-id"]
        verbose_name_plural = "education"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(end_year__isnull=True) | models.Q(end_year__gte=models.F("start_year")),
                name="education_end_not_before_start",
            ),
        ]

    def __str__(self):
        return f"{self.degree}, {self.institution}"


class Experience(models.Model):
    profile = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name="experience")
    company = models.CharField(max_length=200)
    position = models.CharField(max_length=150)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    is_current = models.BooleanField(default=False)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["-start_date", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(is_current=True, end_date__isnull=True)
                    | models.Q(is_current=False, end_date__isnull=False, end_date__gt=models.F("start_date"))
                ),
                name="experience_dates_consistent",
            ),
        ]

    def __str__(self):
        return f"{self.position}, {self.company}"


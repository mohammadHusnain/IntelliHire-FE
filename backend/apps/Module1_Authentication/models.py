import uuid

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone

from apps.common.choices import UserRole, UserStatus
from apps.common.constraints import enum_check
from apps.common.storage import RandomUploadPath, private_storage
from apps.common.validators import validate_cv_file, validate_profile_image

from .managers import UserManager


class ExperienceLevel(models.TextChoices):
    ENTRY = "entry"
    MID = "mid"
    SENIOR = "senior"


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
    bio = models.CharField(max_length=400, blank=True)
    target_role = models.CharField(max_length=100, blank=True)
    experience_level = models.CharField(max_length=10, choices=ExperienceLevel.choices, blank=True)
    avatar = models.ImageField(
        upload_to=RandomUploadPath("avatars"), blank=True, validators=[validate_profile_image]
    )
    linkedin_url = models.URLField(max_length=300, blank=True)
    github_url = models.URLField(max_length=300, blank=True)
    portfolio_url = models.URLField(max_length=300, blank=True)
    skills = models.JSONField(default=list, blank=True)
    resume = models.FileField(
        upload_to=RandomUploadPath("resumes"),
        storage=private_storage,
        blank=True,
        validators=[validate_cv_file],
    )
    resume_original_name = models.CharField(max_length=255, blank=True)
    resume_text = models.TextField(blank=True)
    # Companies can find this candidate for communities only if they opted in (P2-9).
    discoverable = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            enum_check("experience_level", ExperienceLevel, "profile_experience_level_valid", allow_blank=True),
        ]

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



class EmailOTP(models.Model):
    """A one-time code emailed to prove the user controls the address. Only its hash is stored.

    Generating a new code (register again before verifying, or resend) deletes any unconsumed one
    for the same user and purpose, so only the latest code ever works.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="email_otps")
    purpose = models.CharField(max_length=30, default="email_verification")
    code_hash = models.CharField(max_length=64)
    attempts = models.PositiveSmallIntegerField(default=0)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["user", "purpose", "consumed_at"], name="email_otp_lookup_idx")]

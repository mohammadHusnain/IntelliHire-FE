import uuid

from django.conf import settings
from django.db import models
from django.db.models.functions import Lower
from django.utils.text import slugify

from apps.common.choices import CompanyStatus, MemberRole
from apps.common.constraints import enum_check
from apps.common.storage import RandomUploadPath
from apps.common.validators import validate_profile_image


class CompanySize(models.TextChoices):
    SIZE_1_10 = "1-10"
    SIZE_11_50 = "11-50"
    SIZE_51_200 = "51-200"
    SIZE_201_1000 = "201-1000"
    SIZE_1000_PLUS = "1000+"


class InvitationStatus(models.TextChoices):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REVOKED = "revoked"
    EXPIRED = "expired"


class Company(models.Model):
    Status = CompanyStatus
    Size = CompanySize

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True, blank=True)
    industry = models.CharField(max_length=100)
    official_email = models.EmailField()
    contact_phone = models.CharField(max_length=20)
    website = models.URLField(max_length=300, blank=True)
    description = models.TextField(blank=True)
    headquarters = models.CharField(max_length=200, blank=True)
    logo = models.ImageField(
        upload_to=RandomUploadPath("company_logos"), blank=True, validators=[validate_profile_image]
    )
    company_size = models.CharField(max_length=10, choices=CompanySize.choices, blank=True)
    status = models.CharField(max_length=20, choices=CompanyStatus.choices, default=CompanyStatus.PENDING)
    rejection_reason = models.TextField(blank=True)
    suspension_reason = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_companies",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_companies"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "companies"
        indexes = [models.Index(fields=["status"], name="company_status_idx")]
        constraints = [
            models.UniqueConstraint(Lower("name"), name="company_name_ci_unique"),
            models.CheckConstraint(
                condition=~models.Q(status="rejected") | ~models.Q(rejection_reason=""),
                name="company_rejected_has_reason",
            ),
            models.CheckConstraint(
                condition=~models.Q(status="suspended") | ~models.Q(suspension_reason=""),
                name="company_suspended_has_reason",
            ),
            enum_check("status", CompanyStatus, "company_status_valid"),
            enum_check("company_size", CompanySize, "company_size_valid", allow_blank=True),
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = self._unique_slug()
        super().save(*args, **kwargs)

    def _unique_slug(self):
        base = slugify(self.name)[:200] or "company"
        candidate, suffix = base, 1
        while Company.objects.filter(slug=candidate).exclude(pk=self.pk).exists():
            suffix += 1
            candidate = f"{base}-{suffix}"
        return candidate

    def __str__(self):
        return self.name


class CompanyMember(models.Model):
    Role = MemberRole

    company = models.ForeignKey(Company, on_delete=models.PROTECT, related_name="members")
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="company_membership"
    )
    role = models.CharField(max_length=20, choices=MemberRole.choices)
    job_title = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True)
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["company", "role"], name="member_company_role_idx")]
        constraints = [enum_check("role", MemberRole, "member_role_valid")]

    def __str__(self):
        return f"{self.user.email} ({self.role}) at {self.company.name}"


class StaffInvitation(models.Model):
    Role = MemberRole
    Status = InvitationStatus

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(Company, on_delete=models.PROTECT, related_name="invitations")
    email = models.EmailField()
    full_name = models.CharField(max_length=150)
    role = models.CharField(max_length=20, choices=MemberRole.choices)
    job_title = models.CharField(max_length=100, blank=True)
    token_hash = models.CharField(max_length=64, unique=True)
    status = models.CharField(
        max_length=20, choices=InvitationStatus.choices, default=InvitationStatus.PENDING
    )
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["company", "status"], name="invitation_company_status_idx"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "email"],
                condition=models.Q(status="pending"),
                name="invitation_one_pending_per_email",
            ),
            models.CheckConstraint(condition=models.Q(email=Lower("email")), name="invitation_email_lowercase"),
            enum_check("role", MemberRole, "invitation_role_valid"),
            enum_check("status", InvitationStatus, "invitation_status_valid"),
        ]

    def save(self, *args, **kwargs):
        self.email = self.email.strip().lower()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Invitation for {self.email} to {self.company.name} ({self.status})"

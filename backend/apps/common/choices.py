from django.db import models


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


class CompanyStatus(models.TextChoices):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    SUSPENDED = "suspended"


class MemberRole(models.TextChoices):
    ADMIN = "admin"
    HR_MANAGER = "hr_manager"
    RECRUITER = "recruiter"
    VIEWER = "viewer"

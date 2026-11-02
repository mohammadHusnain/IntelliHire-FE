from django.db import IntegrityError, transaction
from rest_framework import serializers

from apps.Module1_Authentication import emails as account_emails
from apps.Module1_Authentication.models import User
from apps.Module1_Authentication.services import authenticate_password, derive_status
from apps.Module1_Authentication.validators import EMAIL_TAKEN
from apps.common.choices import CompanyStatus, MemberRole, UserRole, UserStatus
from apps.common.errors import ApiError, violated_constraint

from .. import emails
from ..models import Company, CompanyMember

NAME_TAKEN = "A company with this name is already registered."


def register_company_admin(*, company_name, industry, official_email, admin_full_name, admin_phone, password):
    """Create the admin user, the pending company and the admin membership in one transaction."""
    try:
        with transaction.atomic():
            user = User.objects.create_user(
                official_email,
                password,
                full_name=admin_full_name,
                role=UserRole.COMPANY_ADMIN,
                status=UserStatus.PENDING_VERIFICATION,
            )
            company = Company.objects.create(
                name=company_name,
                industry=industry,
                official_email=official_email,
                contact_phone=admin_phone,
                created_by=user,
            )
            CompanyMember.objects.create(company=company, user=user, role=MemberRole.ADMIN)
            account_emails.send_verification_email(user)
            emails.send_registration_received_email(user, company)
            emails.send_new_company_to_platform_admins(company)
    except IntegrityError as exc:
        constraint = violated_constraint(exc)
        if "email" in constraint:
            raise serializers.ValidationError({"official_email": [EMAIL_TAKEN]})
        if "name" in constraint or "slug" in constraint:
            raise serializers.ValidationError({"company_name": [NAME_TAKEN]})
        raise
    return user


def resubmit_company(*, official_email, password, company_name, industry, admin_full_name, admin_phone):
    """A rejected company admin corrects the registration; the company returns to `pending`."""
    user = authenticate_password(official_email, password)
    if user is None:
        raise ApiError("Invalid email or password.", "invalid_credentials")
    try:
        with transaction.atomic():
            company = (
                Company.objects.select_for_update(of=("self",))
                .filter(created_by=user, status=CompanyStatus.REJECTED)
                .first()
            )
            if company is None or user.role != UserRole.COMPANY_ADMIN:
                raise ApiError("This registration is not awaiting corrections.", "not_rejected")
            if Company.objects.filter(name__iexact=company_name).exclude(pk=company.pk).exists():
                raise serializers.ValidationError({"company_name": [NAME_TAKEN]})
            if company.name != company_name:
                company.name = company_name
                company.slug = ""
            company.industry = industry
            company.contact_phone = admin_phone
            company.status = CompanyStatus.PENDING
            company.rejection_reason = ""
            company.save()
            # Reload so `derive_status` sees the company's new status, not the one cached on `user`.
            user = User.objects.select_related("company_membership__company").get(pk=user.pk)
            user.full_name = admin_full_name
            user.status = derive_status(user)
            user.save(update_fields=["full_name", "status"])
            emails.send_company_resubmitted_to_platform_admins(company)
    except IntegrityError as exc:
        if "name" in violated_constraint(exc) or "slug" in violated_constraint(exc):
            raise serializers.ValidationError({"company_name": [NAME_TAKEN]})
        raise
    return company

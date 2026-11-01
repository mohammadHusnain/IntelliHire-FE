from django.db import IntegrityError, transaction
from rest_framework import serializers

from apps.accounts import emails as account_emails
from apps.accounts.models import User
from apps.accounts.validators import EMAIL_TAKEN
from apps.common.choices import MemberRole, UserRole, UserStatus
from apps.common.errors import violated_constraint

from . import emails
from .models import Company, CompanyMember


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
    except IntegrityError as exc:
        constraint = violated_constraint(exc)
        if "email" in constraint:
            raise serializers.ValidationError({"official_email": [EMAIL_TAKEN]})
        if "name" in constraint or "slug" in constraint:
            raise serializers.ValidationError(
                {"company_name": ["A company with this name is already registered."]}
            )
        raise
    return user

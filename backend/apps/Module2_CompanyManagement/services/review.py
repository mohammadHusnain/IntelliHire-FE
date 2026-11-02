from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import NotFound

from apps.Module1_Authentication.services import derive_status
from apps.common.choices import CompanyStatus, UserStatus
from apps.common.errors import ApiError

from .. import emails
from ..models import Company

ALREADY_REVIEWED = "Company has already been reviewed."
PENDING_USER_STATUSES = (UserStatus.PENDING_VERIFICATION, UserStatus.PENDING_APPROVAL)


def _locked_company(company_id):
    try:
        return (
            Company.objects.select_for_update(of=("self",)).select_related("created_by").get(pk=company_id)
        )
    except Company.DoesNotExist:
        raise NotFound("Company not found.")


def _require_pending(company):
    if company.status != CompanyStatus.PENDING:
        raise ApiError(ALREADY_REVIEWED, "already_reviewed", 409)


def approve_company(*, company_id, reviewer):
    with transaction.atomic():
        company = _locked_company(company_id)
        _require_pending(company)
        company.status = CompanyStatus.APPROVED
        company.reviewed_by = reviewer
        company.reviewed_at = timezone.now()
        company.save(update_fields=["status", "reviewed_by", "reviewed_at", "updated_at"])
        founder = company.created_by
        if founder.status in PENDING_USER_STATUSES:
            founder.status = derive_status(founder)
            founder.save(update_fields=["status"])
        emails.send_company_approved_email(founder, company)
    return company


def reject_company(*, company_id, reviewer, reason):
    with transaction.atomic():
        company = _locked_company(company_id)
        _require_pending(company)
        company.status = CompanyStatus.REJECTED
        company.rejection_reason = reason
        company.reviewed_by = reviewer
        company.reviewed_at = timezone.now()
        company.save(update_fields=["status", "rejection_reason", "reviewed_by", "reviewed_at", "updated_at"])
        founder = company.created_by
        if founder.status in PENDING_USER_STATUSES:
            founder.status = UserStatus.REJECTED
            founder.save(update_fields=["status"])
        emails.send_company_rejected_email(founder, company)
    return company


def suspend_company(*, company_id, reason):
    with transaction.atomic():
        company = _locked_company(company_id)
        if company.status != CompanyStatus.APPROVED:
            raise ApiError("Only approved companies can be suspended.", "invalid_state", 409)
        company.status = CompanyStatus.SUSPENDED
        company.suspension_reason = reason
        company.save(update_fields=["status", "suspension_reason", "updated_at"])
    return company


def reactivate_company(*, company_id):
    with transaction.atomic():
        company = _locked_company(company_id)
        if company.status != CompanyStatus.SUSPENDED:
            raise ApiError("Only suspended companies can be reactivated.", "invalid_state", 409)
        company.status = CompanyStatus.APPROVED
        company.suspension_reason = ""
        company.save(update_fields=["status", "suspension_reason", "updated_at"])
    return company


def companies_for_review(*, status, search):
    queryset = Company.objects.select_related("created_by").order_by("-created_at", "-pk")
    if status != "all":
        queryset = queryset.filter(status=status)
    if search:
        queryset = queryset.filter(Q(name__icontains=search) | Q(official_email__icontains=search))
    return queryset

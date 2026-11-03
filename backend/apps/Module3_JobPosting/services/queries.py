from rest_framework.exceptions import NotFound

from ..models import JobPosting
from .applications_link import applications_count_expression


def jobs_of(company):
    """Every job of one company, with the application count; the base of every company-side lookup."""
    return (
        JobPosting.objects.filter(company=company)
        .select_related("company", "created_by")
        .annotate(applications_count=applications_count_expression())
    )


def get_job(company, job_id):
    """A job of this company or 404; another company's job is indistinguishable from a missing one."""
    try:
        return jobs_of(company).prefetch_related("custom_fields").get(pk=job_id)
    except JobPosting.DoesNotExist:
        raise NotFound("Job not found.")


def lock_job(company, job_id):
    """The job row locked for a state change; callers must be inside `transaction.atomic()`."""
    try:
        return JobPosting.objects.select_for_update(of=("self",)).select_related("company").get(
            pk=job_id, company=company
        )
    except JobPosting.DoesNotExist:
        raise NotFound("Job not found.")

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


def departments_of(company):
    """The departments this company has used, once each (case-insensitive), sorted A-Z.

    Department is free text, so this is what a filter or a suggestion list is built from. When the same
    department was typed with different capitals, the spelling used by the most jobs wins.
    """
    counts = {}
    for name in JobPosting.objects.filter(company=company).exclude(department="").values_list("department", flat=True):
        spellings = counts.setdefault(name.strip().lower(), {})
        spellings[name.strip()] = spellings.get(name.strip(), 0) + 1
    return sorted((max(spellings, key=lambda spelling: (spellings[spelling], spelling)) for spellings in counts.values()), key=str.lower)

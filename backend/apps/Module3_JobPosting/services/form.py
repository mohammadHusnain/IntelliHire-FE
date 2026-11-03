from django.utils import timezone

from ..builtin_fields import BUILT_IN_FIELDS, BUILT_IN_OPTION_LABELS
from ..models import JobStatus

CLOSED_MESSAGE = "This position is no longer accepting applications."
DRAFT_MESSAGE = "This job has not been published yet."


def _message(job, accepting):
    if accepting:
        return None
    return DRAFT_MESSAGE if job.status == JobStatus.DRAFT else CLOSED_MESSAGE


def _custom_field(field):
    return {
        "key": field.key,
        "label": field.label,
        "type": field.field_type,
        "required": field.required,
        "options": list(field.options),
        "option_labels": None,
        "help_text": field.help_text,
        "max_length": field.max_length,
        "built_in": False,
    }


def _built_in_field(definition):
    return {
        **definition,
        "options": list(definition["options"]),
        "option_labels": BUILT_IN_OPTION_LABELS.get(definition["key"]),
        "built_in": True,
    }


def build_form_schema(job, build_url):
    """The application form of a job: job summary plus ordered fields (built-in first, then custom).

    The HR preview and the public form both use this function, so HR sees exactly what
    candidates see. `build_url` turns a media path into an absolute URL.
    """
    company = job.company
    accepting = job.is_accepting_applications
    salary = None
    if job.show_salary and (job.salary_min is not None or job.salary_max is not None):
        salary = {"min": job.salary_min, "max": job.salary_max, "currency": job.salary_currency}
    return {
        "accepting": accepting,
        "message": _message(job, accepting),
        "job": {
            "title": job.title,
            "company": {"name": company.name, "logo": build_url(company.logo.url) if company.logo else None},
            "department": job.department,
            "location": job.location,
            "work_mode": job.work_mode,
            "employment_type": job.employment_type,
            "description": job.description,
            "responsibilities": job.responsibilities,
            "required_skills": list(job.required_skills),
            "soft_skills": list(job.soft_skills),
            "deadline": job.deadline,
            "salary": salary,
        },
        "fields": [_built_in_field(d) for d in BUILT_IN_FIELDS] + [_custom_field(f) for f in job.custom_fields.all()],
    }


def days_left(job):
    """Whole days until the deadline, rounded up (a job created with a 14-day deadline shows 14).
    None when there is no deadline or the job is closed."""
    if job.deadline is None or job.status == JobStatus.CLOSED:
        return None
    seconds = (job.deadline - timezone.now()).total_seconds()
    return max(0, -int(-seconds // 86400))

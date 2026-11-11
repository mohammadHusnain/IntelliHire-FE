import secrets
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers

from apps.Module5_Foundation.events import log_event, log_events_bulk
from apps.common.errors import ApiError, violated_constraint

from ..models import ApplicationField, CloseReason, JobPosting, JobStatus
from . import errors
from .queries import lock_job
from .rules import deadline_problems, ensure_editable, publish_problems

SLUG_LENGTH = 10
SLUG_ATTEMPTS = 5
COPY_SUFFIX = " (copy)"

# The only fields HR may change on a job that is already open (Doc §3.3, "Edit job").
OPEN_EDITABLE_FIELDS = frozenset(
    {
        "title",
        "description",
        "responsibilities",
        "required_skills",
        "soft_skills",
        "salary_min",
        "salary_max",
        "salary_currency",
        "show_salary",
        "location",
        "deadline",
    }
)


def _new_slug():
    return secrets.token_urlsafe(8)[:SLUG_LENGTH]


def _publish(job, user):
    """Validate, give the job its permanent link and open it. Runs inside the caller's transaction."""
    problems = publish_problems(job)
    if problems:
        raise serializers.ValidationError(problems)
    job.status = JobStatus.OPEN
    job.published_at = timezone.now()
    job.updated_by = user
    for _ in range(SLUG_ATTEMPTS):
        job.form_slug = _new_slug()
        try:
            with transaction.atomic():
                job.save(update_fields=["status", "published_at", "form_slug", "updated_by", "updated_at"])
                log_event("job.published", actor=user, company=job.company_id, target=job, summary=f"Job published: {job.title}")
            return job
        except IntegrityError as exc:
            if "form_slug" not in violated_constraint(exc):
                raise
    job.status, job.published_at, job.form_slug = JobStatus.DRAFT, None, None
    raise ApiError("Could not generate a unique link. Please try again.", "slug_unavailable", 503)


def create_job(*, company, user, data, publish=False):
    """Create a draft owned by the user's company; with `publish` it is validated and opened at once."""
    with transaction.atomic():
        job = JobPosting.objects.create(company=company, created_by=user, updated_by=user, **data)
        if publish:
            _publish(job, user)
    return job


def update_job(*, company, job_id, user, data):
    with transaction.atomic():
        job = lock_job(company, job_id)
        if job.status == JobStatus.CLOSED:
            raise errors.job_closed()
        if job.status == JobStatus.OPEN:
            ensure_editable(job)
            locked = sorted(key for key, value in data.items() if key not in OPEN_EDITABLE_FIELDS and getattr(job, key) != value)
            if locked:
                raise errors.field_locked(
                    f"These fields cannot be changed after publishing: {', '.join(locked)}."
                )
            data = {key: value for key, value in data.items() if key in OPEN_EDITABLE_FIELDS}
        for key, value in data.items():
            setattr(job, key, value)
        if job.status == JobStatus.OPEN:
            problems = publish_problems(job, minimum_lead=timedelta(0))
            if problems:
                raise serializers.ValidationError(problems)
        job.updated_by = user
        job.save()
    return job


def publish_job(*, company, job_id, user):
    with transaction.atomic():
        job = lock_job(company, job_id)
        if job.status != JobStatus.DRAFT:
            raise ApiError("Only draft jobs can be published.", "invalid_state", 409)
        _publish(job, user)
    return job


def close_job(*, company, job_id, user):
    with transaction.atomic():
        job = lock_job(company, job_id)
        if job.status != JobStatus.OPEN:
            raise ApiError("Only open jobs can be closed.", "invalid_state", 409)
        job.status, job.close_reason, job.closed_at = JobStatus.CLOSED, CloseReason.MANUAL, timezone.now()
        job.updated_by = user
        job.save(update_fields=["status", "close_reason", "closed_at", "updated_by", "updated_at"])
        log_event("job.closed", actor=user, company=job.company_id, target=job, summary=f"Job closed: {job.title}", metadata={"reason": CloseReason.MANUAL})
    return job


def reopen_job(*, company, job_id, user, deadline):
    """Same link, status back to open, with a new future deadline."""
    with transaction.atomic():
        job = lock_job(company, job_id)
        if job.status != JobStatus.CLOSED:
            raise ApiError("Only closed jobs can be reopened.", "invalid_state", 409)
        problems = deadline_problems(deadline)
        if problems:
            raise serializers.ValidationError({"deadline": problems})
        job.status, job.deadline = JobStatus.OPEN, deadline
        job.close_reason, job.closed_at = None, None
        job.updated_by = user
        job.save(update_fields=["status", "deadline", "close_reason", "closed_at", "updated_by", "updated_at"])
    return job


def delete_job(*, company, job_id):
    """Only drafts are deleted; published jobs are closed so applications are never orphaned."""
    with transaction.atomic():
        job = lock_job(company, job_id)
        if job.status != JobStatus.DRAFT:
            raise ApiError("Only draft jobs can be deleted.", "invalid_state", 409)
        job.delete()


def duplicate_job(*, company, job_id, user):
    """A new draft with the same content and custom fields: no link, no deadline, "(copy)" in the title."""
    with transaction.atomic():
        source = lock_job(company, job_id)
        copy = JobPosting.objects.create(
            company=company,
            created_by=user,
            updated_by=user,
            title=source.title[: JobPosting._meta.get_field("title").max_length - len(COPY_SUFFIX)] + COPY_SUFFIX,
            department=source.department,
            description=source.description,
            responsibilities=source.responsibilities,
            employment_type=source.employment_type,
            work_mode=source.work_mode,
            location=source.location,
            required_skills=list(source.required_skills),
            soft_skills=list(source.soft_skills),
            min_experience_years=source.min_experience_years,
            education_level=source.education_level,
            salary_min=source.salary_min,
            salary_max=source.salary_max,
            salary_currency=source.salary_currency,
            show_salary=source.show_salary,
            openings=source.openings,
        )
        ApplicationField.objects.bulk_create(
            ApplicationField(
                job=copy,
                label=field.label,
                key=field.key,
                field_type=field.field_type,
                required=field.required,
                options=list(field.options),
                help_text=field.help_text,
                max_length=field.max_length,
                order=field.order,
            )
            for field in source.custom_fields.all()
        )
    return copy


def close_expired_jobs(now=None):
    """Close every open job whose deadline has passed, in one bulk update; returns how many."""
    now = now or timezone.now()
    with transaction.atomic():
        due = list(
            JobPosting.objects.select_for_update(skip_locked=True)
            .filter(status=JobStatus.OPEN, deadline__lte=now)
            .values_list("pk", "company_id", "title")
        )
        closed = JobPosting.objects.filter(pk__in=[pk for pk, _, _ in due]).update(
            status=JobStatus.CLOSED, close_reason=CloseReason.DEADLINE, closed_at=now, updated_at=now
        )
        log_events_bulk(
            "job.closed",
            [
                {"company": company_id, "target_type": "jobposting", "target_id": pk, "summary": f"Job closed: {title}",
                 "metadata": {"reason": CloseReason.DEADLINE}}
                for pk, company_id, title in due
            ],
        )  # fmt: skip
    return closed

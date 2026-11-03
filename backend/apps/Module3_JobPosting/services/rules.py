"""Rules shared by the lifecycle and custom-field services."""

from datetime import timedelta

from django.utils import timezone

from ..models import CHOICE_TYPES, TEXT_TYPES, JobStatus, WorkMode
from . import errors

MIN_PUBLISH_LEAD = timedelta(hours=1)
MAX_DEADLINE_AHEAD = timedelta(days=183)  # "no more than 6 months ahead" (Doc §3.3)
MIN_CHOICE_OPTIONS, MAX_CHOICE_OPTIONS = 2, 20


def ensure_editable(job):
    """Drafts and open jobs before their deadline can be edited; everything else is read-only."""
    if job.status == JobStatus.CLOSED:
        raise errors.job_closed()
    if job.status == JobStatus.OPEN and (job.deadline is None or job.deadline <= timezone.now()):
        raise errors.deadline_passed()


def deadline_problems(deadline, minimum_lead=timedelta(0)):
    now = timezone.now()
    if deadline is None:
        return ["Deadline is required to publish."]
    if deadline <= now:
        return ["Deadline must be in the future."]
    if deadline < now + minimum_lead:
        return ["Deadline must be at least 1 hour from now."]
    if deadline > now + MAX_DEADLINE_AHEAD:
        return ["Deadline cannot be more than 6 months ahead."]
    return []


def field_definition_problems(field_type, options, max_length):
    """Why a custom field definition is invalid, as {"options"|"max_length": [message]}."""
    problems = {}
    if field_type in CHOICE_TYPES:
        if not MIN_CHOICE_OPTIONS <= len(options) <= MAX_CHOICE_OPTIONS:
            problems["options"] = [
                f"Choice fields need between {MIN_CHOICE_OPTIONS} and {MAX_CHOICE_OPTIONS} options."
            ]
        elif len({option.lower() for option in options}) != len(options):
            problems["options"] = ["Options must be unique."]
    elif options:
        problems["options"] = ["Options are only allowed for single and multiple choice fields."]
    if max_length is not None and field_type not in TEXT_TYPES:
        problems["max_length"] = ["A maximum length is only allowed for text fields."]
    return problems


def publish_problems(job, minimum_lead=MIN_PUBLISH_LEAD):
    """Everything that stops a job from being (or staying) published, keyed by field name."""
    problems = {}
    if not job.title.strip():
        problems["title"] = ["Title is required."]
    if not job.department.strip():
        problems["department"] = ["Department is required."]
    if not job.description.strip():
        problems["description"] = ["Description is required to publish."]
    if not job.required_skills:
        problems["required_skills"] = ["Add at least one required skill."]
    if not job.employment_type:
        problems["employment_type"] = ["Employment type is required to publish."]
    if job.work_mode != WorkMode.REMOTE and not job.location.strip():
        problems["location"] = ["Location is required unless the job is remote."]
    deadline = deadline_problems(job.deadline, minimum_lead)
    if deadline:
        problems["deadline"] = deadline
    custom = []
    for field in job.custom_fields.all():
        for message in sum(field_definition_problems(field.field_type, field.options, field.max_length).values(), []):
            custom.append(f"Custom field '{field.label}': {message}")
    if custom:
        problems["custom_fields"] = custom
    return problems

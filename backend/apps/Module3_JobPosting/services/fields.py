from django.db import transaction
from django.db.models import Max
from django.utils.text import slugify
from rest_framework import serializers
from rest_framework.exceptions import NotFound

from apps.common.errors import ApiError

from ..builtin_fields import BUILT_IN_KEYS
from ..models import ApplicationField
from .applications_link import has_applications
from .errors import field_locked
from .queries import get_job, lock_job
from .rules import ensure_editable, field_definition_problems

MAX_CUSTOM_FIELDS = 30
KEY_BASE_LENGTH = 140  # leaves room for a numeric suffix inside the 150-character column


def make_key(job, label):
    """`LinkedIn Profile URL` -> `linkedin_profile_url`; a number suffix avoids clashes with other
    fields of the job and with the built-in keys."""
    base = slugify(label).replace("-", "_")[:KEY_BASE_LENGTH] or "field"
    taken = set(job.custom_fields.values_list("key", flat=True)) | BUILT_IN_KEYS
    key, number = base, 1
    while key in taken:
        number += 1
        key = f"{base}_{number}"
    return key


def _touch(job, user):
    job.updated_by = user
    job.save(update_fields=["updated_by", "updated_at"])


def _check_definition(field_type, options, max_length):
    problems = field_definition_problems(field_type, options, max_length)
    if problems:
        raise serializers.ValidationError(problems)


def get_field(company, job_id, field_id):
    job = get_job(company, job_id)
    for field in job.custom_fields.all():
        if field.pk == field_id:
            return field
    raise NotFound("Field not found.")


def add_field(*, company, job_id, user, data):
    with transaction.atomic():
        job = lock_job(company, job_id)
        ensure_editable(job)
        if job.custom_fields.count() >= MAX_CUSTOM_FIELDS:
            raise ApiError(f"A job can have at most {MAX_CUSTOM_FIELDS} custom fields.", "limit_reached")
        if data.get("required") and has_applications(job):
            raise field_locked("A required field cannot be added after applications were received.")
        _check_definition(data["field_type"], data.get("options", []), data.get("max_length"))
        top = job.custom_fields.aggregate(top=Max("order"))["top"]
        order = 0 if top is None else top + 1
        field = ApplicationField.objects.create(job=job, key=make_key(job, data["label"]), order=order, **data)
        _touch(job, user)
    return field


def _check_locked_change(field, changes):
    if "field_type" in changes and changes["field_type"] != field.field_type:
        raise field_locked("The type of a field cannot be changed after applications were received.")
    if changes.get("required") and not field.required:
        raise field_locked("An optional field cannot become required after applications were received.")
    if "options" in changes and set(field.options) - set(changes["options"]):
        raise field_locked("Options cannot be removed after applications were received.")


def update_field(*, company, job_id, field_id, user, data):
    with transaction.atomic():
        job = lock_job(company, job_id)
        ensure_editable(job)
        try:
            field = job.custom_fields.select_for_update().get(pk=field_id)
        except ApplicationField.DoesNotExist:
            raise NotFound("Field not found.")
        if has_applications(job):
            _check_locked_change(field, data)
        merged = {"field_type": field.field_type, "options": field.options, "max_length": field.max_length, **data}
        _check_definition(merged["field_type"], merged["options"], merged["max_length"])
        for key, value in data.items():
            setattr(field, key, value)
        field.save()
        _touch(job, user)
    return field


def delete_field(*, company, job_id, field_id, user):
    with transaction.atomic():
        job = lock_job(company, job_id)
        ensure_editable(job)
        try:
            field = job.custom_fields.get(pk=field_id)
        except ApplicationField.DoesNotExist:
            raise NotFound("Field not found.")
        if has_applications(job):
            raise field_locked("A field cannot be deleted after applications were received.")
        field.delete()
        _touch(job, user)


def reorder_fields(*, company, job_id, user, field_ids):
    """Rewrite `order` from the full list of this job's field IDs, in one transaction."""
    with transaction.atomic():
        job = lock_job(company, job_id)
        ensure_editable(job)
        fields = {field.pk: field for field in job.custom_fields.select_for_update()}
        if len(field_ids) != len(set(field_ids)) or set(field_ids) != set(fields):
            raise serializers.ValidationError({"field_ids": ["Send every field ID of this job exactly once."]})
        ordered = []
        for position, pk in enumerate(field_ids):
            fields[pk].order = position
            ordered.append(fields[pk])
        ApplicationField.objects.bulk_update(ordered, ["order"])
        _touch(job, user)
    return ordered

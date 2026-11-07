import csv
import re

from django.db import transaction
from django.db.models import Count
from rest_framework import serializers
from rest_framework.exceptions import NotFound

from apps.Module3_JobPosting.models import FieldType

from ..models import Application, ApplicationStatus, ApplicationStatusChange

NOTE_MAX_LENGTH = 1000
_SAFE_NUMBERISH = re.compile(r"[+\-\d\s().]+")


def applications_of(company):
    """Every application for the company's jobs; the base of every company-side lookup."""
    return Application.objects.filter(job__company=company).select_related("job")


def get_application(company, application_id):
    """One application of this company or 404; another company's is indistinguishable from a missing one."""
    try:
        return (
            applications_of(company)
            .prefetch_related("files", "status_history__changed_by", "job__custom_fields")
            .get(pk=application_id)
        )
    except Application.DoesNotExist:
        raise NotFound("Application not found.")


def status_counts(job):
    """How many applications the job has in each status (all statuses present, zeros included)."""
    counts = {status: 0 for status in ApplicationStatus.values}
    rows = Application.objects.filter(job=job).values("status").annotate(total=Count("pk"))
    counts.update({row["status"]: row["total"] for row in rows})
    return {**counts, "total": sum(counts.values())}


def change_status(*, company, application_id, user, new_status, note=""):
    """Write the new status and its history row in one transaction (any status to any other)."""
    with transaction.atomic():
        try:
            application = (
                Application.objects.select_for_update(of=("self",))
                .filter(job__company=company)
                .get(pk=application_id)
            )
        except Application.DoesNotExist:
            raise NotFound("Application not found.")
        if application.status == new_status:
            raise serializers.ValidationError({"status": ["The application already has this status."]})
        ApplicationStatusChange.objects.create(
            application=application,
            from_status=application.status,
            to_status=new_status,
            changed_by=user,
            note=note,
        )
        application.status = new_status
        application.save(update_fields=["status", "updated_at"])
    return application


# --- CSV export -------------------------------------------------------------------------------


def _cell(value):
    """Spreadsheet-safe text: a value that could run as a formula is prefixed with an apostrophe."""
    if not isinstance(value, str):
        return value
    risky = value[:1] in ("=", "@", "\t", "\r") or (value[:1] in ("+", "-") and not _SAFE_NUMBERISH.fullmatch(value))
    return "'" + value if risky else value


def _answer_text(field, application, files):
    if field.field_type == FieldType.FILE:
        record = files.get(field.key)
        return record.original_name if record else ""
    value = application.answers.get(field.key)
    if value is None:
        return ""
    if isinstance(value, list):
        return "; ".join(value)
    return value


class _Echo:
    def write(self, value):
        return value


def export_rows(job):
    """CSV lines (as strings): built-in columns, then one column per custom field in form order."""
    fields = list(job.custom_fields.all())
    writer = csv.writer(_Echo())
    header = ["Reference", "Full name", "Email", "Phone", "Education level", "Institution", "Graduation year", "Status", "Submitted at"]
    yield "﻿" + writer.writerow(header + [_cell(field.label) for field in fields])
    queryset = (
        Application.objects.filter(job=job).prefetch_related("files").order_by("-submitted_at", "-id").iterator(chunk_size=200)
    )
    for application in queryset:
        files = {record.field_key: record for record in application.files.all()}
        row = [
            application.reference,
            application.full_name,
            application.email,
            application.phone,
            application.education_level,
            application.institution,
            application.graduation_year,
            application.status,
            application.submitted_at.isoformat(),
        ] + [_answer_text(field, application, files) for field in fields]
        yield writer.writerow([_cell(value) for value in row])

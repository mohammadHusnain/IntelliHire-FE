import csv
import re

from django.db import transaction
from django.utils import timezone
from decimal import Decimal

from django.db.models import Count, DecimalField, F, Value
from django.db.models.functions import Coalesce
from rest_framework import serializers
from rest_framework.exceptions import NotFound

from apps.Module3_JobPosting.models import FieldType

from apps.common.errors import ApiError
from apps.Module5_Foundation.events import log_event

from ..models import Application, ApplicationNote, ApplicationStatus, ApplicationStatusChange, StatusChangeSource
from ..signals import application_shortlisted

NOTE_MAX_LENGTH = 1000
FREE_NOTE_MAX_LENGTH = 2000
MAX_NOTES_PER_APPLICATION = 100
_SAFE_NUMBERISH = re.compile(r"[+\-\d\s().]+")


def applications_of(company):
    """Every application for the company's jobs; the base of every company-side lookup.

    `cv_score` is the CV match score for sorting and filtering, with -1 for "not scored yet" so unscored
    applications always sort below scored ones.
    """
    return (
        Application.objects.filter(job__company=company)
        .select_related("job", "job__screening_config", "cv_match", "cv_analysis")
        .annotate(cv_score=Coalesce(F("cv_match__score"), Value(Decimal("-1")), output_field=DecimalField()))
    )


def get_application(company, application_id):
    """One application of this company or 404; another company's is indistinguishable from a missing one."""
    try:
        return (
            applications_of(company)
            .prefetch_related("files", "status_history__changed_by", "notes__author", "job__custom_fields")
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
        if new_status in DECISION_STATUSES and decision_recorder is not None:
            # selected, rejected and on_hold are HR decisions: Module 9 records one (without emailing the candidate)
            decision_recorder(application, user=user, new_status=new_status, note=note, company=company)
        else:
            apply_status(application, user=user, new_status=new_status, note=note, company=company)
    return application


DECISION_STATUSES = ("selected", "rejected", "on_hold")
# Set by Module 9 when it is installed: called inside change_status's transaction with the application locked.
decision_recorder = None


def apply_status(application, *, user, new_status, note="", company=None):
    """Write the status change, its history row and the audit event. The caller holds the application's row lock."""
    previous = application.status
    ApplicationStatusChange.objects.create(
        application=application, from_status=previous, to_status=new_status, changed_by=user, note=note, source=StatusChangeSource.HR
    )
    application.status = new_status
    application.save(update_fields=["status", "updated_at"])
    if new_status == ApplicationStatus.SHORTLISTED:
        application_shortlisted.send_robust(sender=Application, application=application)
    log_event(
        "application.status_changed", actor=user, company=company or application.job.company_id, target=application,
        summary=f"Application moved from {previous} to {new_status}",
        metadata={"from": previous, "to": new_status, "reference": application.reference},
    )  # fmt: skip
    return application


def set_status_if(application_id, *, expected, new_status, note="", user=None, source=StatusChangeSource.SYSTEM):
    """Move an application to `new_status` only if it is still in `expected`; returns whether it moved.

    Every automatic move goes through here, so a background job that finishes late can never overwrite a
    status a person has set in the meantime. The update, its history row and the audit event are one transaction.
    """
    with transaction.atomic():
        moved = Application.objects.filter(pk=application_id, status=expected).update(status=new_status, updated_at=timezone.now())
        if not moved:
            return False
        application = Application.objects.select_related("job").get(pk=application_id)
        ApplicationStatusChange.objects.create(
            application=application, from_status=expected, to_status=new_status, changed_by=user, note=note, source=source
        )
        log_event(
            "application.status_changed", actor=user, company=application.job.company_id, target=application,
            summary=f"Application moved from {expected} to {new_status}",
            metadata={"from": expected, "to": new_status, "reference": application.reference, "source": source},
        )  # fmt: skip
        if new_status == ApplicationStatus.SHORTLISTED:
            application_shortlisted.send_robust(sender=Application, application=application)
    return True


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


def list_notes(company, application_id):
    """The notes of one application (newest first); 404 for another company's application."""
    application = get_application(company, application_id)
    return list(application.notes.select_related("author"))


def add_note(*, company, application_id, user, text):
    """Add a free note. Bounded per application so a single record cannot grow without end."""
    with transaction.atomic():
        try:
            application = Application.objects.select_for_update(of=("self",)).filter(job__company=company).get(pk=application_id)
        except Application.DoesNotExist:
            raise NotFound("Application not found.")
        if application.notes.count() >= MAX_NOTES_PER_APPLICATION:
            raise ApiError(f"An application can have at most {MAX_NOTES_PER_APPLICATION} notes.", "limit_reached")
        return ApplicationNote.objects.create(application=application, author=user, text=text)

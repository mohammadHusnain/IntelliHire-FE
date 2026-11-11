import logging
import secrets

from django.db import IntegrityError, OperationalError, transaction
from rest_framework import serializers
from rest_framework.exceptions import NotFound

from apps.Module3_JobPosting.models import JobPosting, JobStatus
from apps.Module3_JobPosting.services.form import CLOSED_MESSAGE
from apps.common.errors import ApiError, violated_constraint
from apps.common.storage import private_storage
from apps.Module5_Foundation.events import log_event

from .. import emails
from ..models import Application, ApplicationFile, ApplicationStatus, ApplicationStatusChange, StatusChangeSource
from ..signals import application_submitted
from .validation import validate_built_in, validate_custom

logger = logging.getLogger(__name__)

DUPLICATE_MESSAGE = "You have already applied for this position with this email."
SAVE_FAILED = "We could not save your application. Please try again."
REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O or 1/I
REFERENCE_LENGTH = 6
REFERENCE_ATTEMPTS = 5
MAX_USER_AGENT = 500


def new_reference():
    return "IH-" + "".join(secrets.choice(REFERENCE_ALPHABET) for _ in range(REFERENCE_LENGTH))


def public_job(form_slug):
    """The job behind a public link; an unknown slug or a draft is 404."""
    try:
        return (
            JobPosting.objects.select_related("company")
            .exclude(status=JobStatus.DRAFT)
            .get(form_slug=form_slug)
        )
    except JobPosting.DoesNotExist:
        raise NotFound("Job not found.")


def _discard(names):
    storage = private_storage()
    for name in names:
        try:
            storage.delete(name)
        except OSError:
            logger.exception("Could not delete an orphaned upload")
    names.clear()


def _store(field_file, upload, written):
    upload.seek(0)
    field_file.save(upload.name, upload, save=False)
    written.append(field_file.name)


def _attempt(job_id, data, files, candidate, ip_address, user_agent, written):
    with transaction.atomic():
        job = JobPosting.objects.select_for_update(of=("self",)).select_related("company").get(pk=job_id)
        if not job.is_accepting_applications:
            raise ApiError(CLOSED_MESSAGE, "job_closed", 410)

        errors = {}
        cleaned = validate_built_in(data, files, errors)
        answers, uploads = validate_custom(list(job.custom_fields.all()), data, files, errors)
        email = cleaned.get("email")
        if email and Application.objects.filter(job=job, email=email).exists():
            errors.setdefault("email", []).append(DUPLICATE_MESSAGE)
        if errors:
            raise serializers.ValidationError(errors)

        cv = cleaned.pop("resume")
        application = Application(
            job=job,
            candidate_user=candidate,
            resume_original_name=cv.name[:255],
            answers=answers,
            ip_address=ip_address,
            user_agent=(user_agent or "")[:MAX_USER_AGENT],
            **cleaned,
        )
        _store(application.resume, cv, written)
        for _ in range(REFERENCE_ATTEMPTS):
            application.reference = new_reference()
            try:
                with transaction.atomic():
                    application.save()
                break
            except IntegrityError as exc:
                constraint = violated_constraint(exc)
                if "email" in constraint:
                    raise serializers.ValidationError({"email": [DUPLICATE_MESSAGE]})
                if "reference" not in constraint:
                    raise
        else:
            raise ApiError(SAVE_FAILED, "save_failed", 503)

        for key, upload in uploads.items():
            record = ApplicationFile(application=application, field_key=key, original_name=upload.name[:255], size=upload.size)
            _store(record.file, upload, written)
            record.save()
        ApplicationStatusChange.objects.create(
            application=application, from_status="", to_status=ApplicationStatus.SUBMITTED, changed_by=None,
            source=StatusChangeSource.SYSTEM,
        )  # fmt: skip
        application_submitted.send_robust(sender=Application, application=application)
        log_event(
            "application.submitted", company=job.company_id, target=application,
            summary=f"Application submitted for {job.title}", metadata={"reference": application.reference},
        )  # fmt: skip
        emails.send_application_received(application)
        return application


def submit_application(*, job, data, files, candidate=None, ip_address=None, user_agent=""):
    """Validate and save one application (all or nothing).

    The job row is locked, files are written under random names and removed again if anything
    fails. A temporary database error is retried once; a second one gives 503 and leaves no
    partial record and no orphan file.
    """
    for attempt in (1, 2):
        written = []
        try:
            return _attempt(job.pk, data, files, candidate, ip_address, user_agent, written)
        except OperationalError:
            _discard(written)
            logger.warning("Temporary database error while saving an application (attempt %d)", attempt)
            if attempt == 2:
                raise ApiError(SAVE_FAILED, "save_failed", 503)
        except BaseException:
            _discard(written)
            raise

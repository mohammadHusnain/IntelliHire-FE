from django.db import transaction
from django.utils import timezone

from apps.Module4_ApplicationManagement.models import (
    Application,
    ApplicationStatus,
    ApplicationStatusChange,
    StatusChangeSource,
)
from apps.Module4_ApplicationManagement.signals import application_shortlisted
from apps.Module5_Foundation.events import log_events_bulk

from ..models import AnalysisStatus, JobScreeningConfig
from .config import config_for


def _eligible(job, threshold):
    """Scored applications still under review at or above the threshold. Nobody else is ever touched."""
    return Application.objects.filter(
        job=job,
        status=ApplicationStatus.UNDER_REVIEW,
        cv_analysis__status=AnalysisStatus.COMPLETED,
        cv_match__score__gte=threshold,
    )


def preview(job, threshold):
    scored = Application.objects.filter(job=job, cv_analysis__status=AnalysisStatus.COMPLETED, cv_match__isnull=False)
    would = _eligible(job, threshold).count()
    return {
        "threshold": threshold,
        "would_shortlist": would,
        "at_or_above": scored.filter(cv_match__score__gte=threshold).count(),
        "below": scored.filter(cv_match__score__lt=threshold).count(),
        "scored": scored.count(),
    }


def apply_threshold(job, threshold, user):
    """Shortlist everyone at or above the threshold who is still under review, in one locked batch.

    The threshold is saved on the job. Applications a person already moved elsewhere are left alone, and
    nobody below the threshold is rejected or changed.
    """
    config = config_for(job)
    with transaction.atomic():
        JobScreeningConfig.objects.filter(pk=config.pk).update(shortlist_threshold=threshold, updated_by=user, updated_at=timezone.now())
        rows = list(
            _eligible(job, threshold).select_for_update(of=("self",)).values_list("pk", "reference", "cv_match__score")
        )
        ids = [pk for pk, _, _ in rows]
        Application.objects.filter(pk__in=ids).update(status=ApplicationStatus.SHORTLISTED, updated_at=timezone.now())
        ApplicationStatusChange.objects.bulk_create(
            [
                ApplicationStatusChange(
                    application_id=pk, from_status=ApplicationStatus.UNDER_REVIEW, to_status=ApplicationStatus.SHORTLISTED,
                    changed_by=user, source=StatusChangeSource.HR,
                    note=f"CV match {score:.0f}% meets the {threshold}% threshold",
                )  # fmt: skip
                for pk, _, score in rows
            ]
        )
        log_events_bulk(
            "application.status_changed",
            [
                {"company": job.company_id, "target_type": "application", "target_id": pk,
                 "summary": "Application moved from under_review to shortlisted",
                 "metadata": {"from": "under_review", "to": "shortlisted", "reference": reference, "source": "threshold"}}
                for pk, reference, _ in rows
            ],
            actor=user,
        )  # fmt: skip
        for application in Application.objects.filter(pk__in=ids).select_related("job", "job__screening_config"):
            application_shortlisted.send_robust(sender=Application, application=application)
    return {"threshold": threshold, "shortlisted": len(ids)}

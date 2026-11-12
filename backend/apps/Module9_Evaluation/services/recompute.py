"""Recomputing every evaluation of a job after its weights change. Background work: nothing here runs inside a request."""
import logging

from django.db import transaction
from django.utils import timezone

from apps.Module4_ApplicationManagement.models import Application

from ..models import CandidateEvaluation, ReportStatus
from .scores import refresh
from .weights import weights_for

logger = logging.getLogger(__name__)
BATCH = 200


def queue_recompute(job_id):
    def send():
        from ..tasks import recompute_job

        try:
            recompute_job.delay(str(job_id))
        except Exception:
            logger.warning("Could not queue an evaluation recompute", exc_info=True)

    transaction.on_commit(send)


def recompute_job(job_id):
    """Scores and composites for every application of the job under the job's current weights.

    Decisions are untouched. Reports that were ready are marked for regeneration; the sweep works through them a few
    at a time, so a weight change never fires thousands of model calls at once. Returns how many evaluations exist.
    """
    applications = Application.objects.filter(job_id=job_id).select_related("job", "cv_match")
    weights = weights_for(applications.first().job) if applications.exists() else None
    if weights is None:
        return 0
    for application in applications.iterator(chunk_size=BATCH):
        refresh(application, weights=weights)  # the newest weights are re-read by the next call if they change again
    CandidateEvaluation.objects.filter(job_id=job_id, report_status=ReportStatus.READY).update(
        report_status=ReportStatus.GENERATING, report_attempts=0, next_report_at=timezone.now(), report_claimed_at=None
    )
    return CandidateEvaluation.objects.filter(job_id=job_id).count()

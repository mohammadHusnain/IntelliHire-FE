from django.db import transaction
from django.utils import timezone

from apps.common.errors import ApiError
from apps.Module4_ApplicationManagement.models import Application

from ..models import AnalysisStatus, CVAnalysis, CVMatch, JobScreeningConfig
from . import pipeline
from .config import config_for
from .scoring import job_signature

TERMINAL = (AnalysisStatus.COMPLETED, AnalysisStatus.FAILED, AnalysisStatus.MANUAL_REVIEW)


def progress(job):
    config = config_for(job)
    total = Application.objects.filter(job=job).count()
    counts = pipeline.summary_of(job)
    analysed = sum(counts.values())
    done = sum(counts[status] for status in TERMINAL)
    pending = counts[AnalysisStatus.QUEUED] + counts[AnalysisStatus.PROCESSING]
    paused = CVAnalysis.objects.filter(
        application__job=job, status=AnalysisStatus.QUEUED, failure_reason__startswith="Waiting"
    ).count()
    stale = CVMatch.objects.filter(application__job=job).exclude(job_signature=job_signature(job, config.weights)).count()
    return {
        "total_applications": total,
        "not_analysed": total - analysed,
        **counts,
        "paused": paused,
        "stale_scores": stale,
        "in_progress": pending > 0,
        "percent_done": 100 if not analysed else int(done * 100 / analysed),
    }


def start_run(job, mode, user):
    """Queue work for a job's CVs. `missing`: not yet analysed or failed. `full`: read every CV again.
    `rescore`: recompute scores from what was already read (no CV is re-read)."""
    if not Application.objects.filter(job=job).exists():
        raise ApiError("This job has no applications yet.", "no_applications", 409)
    config = config_for(job)
    now = timezone.now()
    if mode == "rescore":
        from ..tasks import rescore_job

        count = CVAnalysis.objects.filter(application__job=job, status=AnalysisStatus.COMPLETED).count()
        job_id = str(job.pk)
        transaction.on_commit(lambda: _safely(lambda: rescore_job.delay(job_id)))
        return count
    fresh = {"status": AnalysisStatus.QUEUED, "attempts": 0, "next_attempt_at": now, "claimed_at": None, "failure_reason": ""}
    with transaction.atomic():
        missing = list(Application.objects.filter(job=job, cv_analysis__isnull=True).values_list("pk", flat=True))
        CVAnalysis.objects.bulk_create([CVAnalysis(application_id=pk) for pk in missing], ignore_conflicts=True)
        redo = CVAnalysis.objects.filter(application__job=job).exclude(application_id__in=missing)
        redo = redo.filter(status=AnalysisStatus.FAILED) if mode == "missing" else redo.exclude(status=AnalysisStatus.PROCESSING)
        redo_ids = list(redo.values_list("application_id", flat=True))
        CVAnalysis.objects.filter(application_id__in=redo_ids).exclude(status=AnalysisStatus.PROCESSING).update(**fresh)
        ids = missing + redo_ids
        if ids:
            JobScreeningConfig.objects.filter(pk=config.pk).update(run_requested_at=now, completion_notified_at=None, updated_at=now)
    transaction.on_commit(lambda: pipeline.enqueue(ids))
    return len(ids)


def _safely(call):
    try:
        call()
    except Exception:  # a dead broker: the next manual run or weight change will redo it
        pipeline.logger.warning("Could not queue a re-score", exc_info=True)


def ranking(queryset, *, min_score=None, status=None, analysis_status=None):
    """Scored applications first, best first; ties go to the earlier submission. Unscored ones come last."""
    if min_score is not None:
        queryset = queryset.filter(cv_match__score__gte=min_score)
    if status:
        queryset = queryset.filter(status=status)
    if analysis_status == "none":
        queryset = queryset.filter(cv_analysis__isnull=True)
    elif analysis_status:
        queryset = queryset.filter(cv_analysis__status=analysis_status)
    return queryset.order_by("-cv_score", "submitted_at", "pk")


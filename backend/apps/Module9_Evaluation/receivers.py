import logging

from django.dispatch import receiver

from apps.Module6_CVAnalysis.signals import cv_scored
from apps.Module7_Interviews.models import OPEN_STATUSES, InterviewSession
from apps.Module7_Interviews.signals import interview_evaluated

logger = logging.getLogger(__name__)


@receiver(interview_evaluated, dispatch_uid="evaluation.on_interview_evaluated")
def on_interview_evaluated(sender, session, recommendation, **kwargs):
    """A finished interview changes the scores. The report is refreshed after a technical interview (the normal case) and
    after a screening that is not going on to a technical one (UC-10: no technical planned). Never raises."""
    from .services import report, scores

    if not session.application_id:
        return
    try:
        application = session.application
        evaluation, _ = scores.refresh(application)
        if evaluation is None:
            return
        technical_planned = session.kind == "screening" and (
            recommendation == "advance" or InterviewSession.objects.filter(application=application, kind="technical", status__in=OPEN_STATUSES).exists()
        )
        if session.kind == "technical" or not technical_planned:
            report.request_report(application.pk)
    except Exception:
        logger.exception("Could not update the evaluation after an interview")


@receiver(cv_scored, dispatch_uid="evaluation.on_cv_scored")
def on_cv_scored(sender, application, **kwargs):
    """A new or changed CV score recomputes the composite; an existing report is refreshed. Never raises."""
    from .models import ReportStatus
    from .services import report, scores

    try:
        evaluation, changed = scores.refresh(application)
        if evaluation is not None and changed and evaluation.report_status in (ReportStatus.READY, ReportStatus.FAILED):
            report.request_report(application.pk)
    except Exception:
        logger.exception("Could not update the evaluation after a CV score changed")

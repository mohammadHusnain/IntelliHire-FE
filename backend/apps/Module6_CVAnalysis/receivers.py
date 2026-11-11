import logging

from django.db import transaction
from django.dispatch import receiver

from apps.Module4_ApplicationManagement.signals import application_submitted

logger = logging.getLogger(__name__)


@receiver(application_submitted, dispatch_uid="cv_analysis.queue_on_submit")
def queue_on_submit(sender, application, **kwargs):
    """Queue the CV for analysis as part of the submission, when the job has auto-analyse on.

    Runs in a savepoint and never raises: a problem here must not cost the candidate their application.
    """
    from .services.config import config_for
    from .services.pipeline import queue_analysis

    try:
        with transaction.atomic():
            if config_for(application.job).auto_analyse:
                queue_analysis(application)
    except Exception:
        logger.exception("Could not queue the CV analysis for a new application")

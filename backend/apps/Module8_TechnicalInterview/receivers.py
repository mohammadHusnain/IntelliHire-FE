import logging

from django.db import transaction
from django.dispatch import receiver

from apps.common.errors import ApiError
from apps.Module7_Interviews.signals import interview_evaluated

logger = logging.getLogger(__name__)


@receiver(interview_evaluated, dispatch_uid="technical_interview.invite_after_screening")
def invite_after_screening(sender, session, recommendation, **kwargs):
    """A screening evaluated as `advance` sends the technical invitation (guide P2-1: the next invitation is automatic).

    HR can cancel it. Runs in a savepoint and never raises, so it cannot undo the evaluation that triggered it.
    """
    from apps.Module7_Interviews.services.invite import invite

    if session.kind != "screening" or recommendation != "advance" or not session.application_id:
        return
    try:
        with transaction.atomic():
            invite(session.application, kind="technical", user=None)
    except ApiError as exc:  # already invited, company suspended, ...
        logger.info("No automatic technical invitation sent (%s)", exc.detail)
    except Exception:
        logger.exception("Could not send the automatic technical invitation")

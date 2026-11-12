import logging

from django.db import transaction
from django.dispatch import receiver

from apps.common.errors import ApiError
from apps.Module4_ApplicationManagement.signals import application_shortlisted

logger = logging.getLogger(__name__)


@receiver(application_shortlisted, dispatch_uid="interviews.invite_on_shortlist")
def invite_on_shortlist(sender, application, **kwargs):
    """Send the screening invitation when the job asks for it (D-103).

    Runs in a savepoint and never raises: a problem here must not undo the shortlisting that triggered it.
    """
    from .services.invite import invite

    try:
        # Read through the relation (no get_or_create): a job with no settings row means "off", and a batch that
        # loaded the settings with its applications costs no extra query per candidate.
        config = getattr(application.job, "screening_config", None)
        if config is None or not config.invite_on_shortlist:
            return
        with transaction.atomic():
            invite(application, user=None)
    except ApiError as exc:  # already invited, company suspended, ...: expected, nothing to alarm anyone about
        logger.info("No automatic interview invitation sent (%s)", exc.detail)
    except Exception:
        logger.exception("Could not send the automatic interview invitation")

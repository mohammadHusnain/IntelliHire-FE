import logging

from django.dispatch import receiver

from apps.Module1_Authentication.signals import email_verified

logger = logging.getLogger(__name__)


@receiver(email_verified, dispatch_uid="tracking.link_applications_on_verify")
def link_on_verify(sender, user, **kwargs):
    """After a candidate verifies their email, their earlier applications show up under the account. Never raises."""
    from .services.linking import link_applications

    try:
        link_applications(user)
    except Exception:
        logger.exception("Could not link applications to a newly verified account")

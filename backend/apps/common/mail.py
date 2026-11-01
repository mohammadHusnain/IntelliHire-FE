import logging
import smtplib

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db import transaction

logger = logging.getLogger(__name__)


def send_email_on_commit(*, to, subject, body, html_body=None):
    """Send an email only after the surrounding transaction commits.

    Delivery failures are logged and never raised, because the database change
    they announce has already been committed. Recipients are not logged.
    """
    recipients = [to] if isinstance(to, str) else list(to)

    def _send():
        message = EmailMultiAlternatives(subject, body, settings.DEFAULT_FROM_EMAIL, recipients)
        if html_body:
            message.attach_alternative(html_body, "text/html")
        try:
            message.send(fail_silently=False)
        except (smtplib.SMTPException, OSError):
            logger.exception("Email delivery failed (subject=%r, recipients=%d)", subject, len(recipients))

    transaction.on_commit(_send)

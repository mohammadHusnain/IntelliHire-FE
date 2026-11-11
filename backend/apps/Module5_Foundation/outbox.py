"""Durable email: every message is a row first, so a broker or SMTP outage never loses or duplicates it."""
import logging
import smtplib
from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.mail import BadHeaderError, EmailMultiAlternatives
from django.core.validators import validate_email
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from .models import EmailStatus, OutboundEmail
from .sanitize import clean_text

logger = logging.getLogger(__name__)
BULK_LIMIT = 200


def _recipients(to):
    seen, valid = set(), []
    for address in [to] if isinstance(to, str) else list(to or []):
        address = (address or "").strip()
        key = address.lower()
        if key in seen:
            continue
        seen.add(key)
        try:
            validate_email(address)
        except ValidationError:
            logger.warning("Skipping an email with an invalid recipient address (kind pending)")
            continue
        valid.append(address)
    return valid


def send_email(*, to, subject, body, html_body=None, kind="general", sensitive=False, related=None):
    """Queue an email for each valid recipient and send it after the surrounding transaction commits.

    The rows are created inside the caller's transaction, so a rollback leaves no email behind. Nothing here
    raises for delivery problems: the database change the email announces has already happened.
    """
    recipients = _recipients(to)
    if not recipients:
        return []
    related_type, related_id = ("", None)
    if related is not None:
        related_type, related_id = related._meta.model_name, getattr(related, "pk", None)
    limit = settings.EMAIL_MAX_BODY_CHARS
    rows = OutboundEmail.objects.bulk_create(
        [
            OutboundEmail(
                to_email=address,
                subject=clean_text(subject, 200),
                body_text=(body or "")[:limit],
                body_html=(html_body or "")[:limit],
                kind=clean_text(kind, 50) or "general",
                sensitive=sensitive,
                related_type=related_type,
                related_id=related_id,
            )
            for address in recipients
        ]
    )
    ids = [str(row.pk) for row in rows]
    transaction.on_commit(lambda: _enqueue(ids))
    return rows


def _enqueue(ids):
    from .tasks import send_email_task

    for email_id in ids:
        try:
            send_email_task.delay(email_id)
        except Exception:
            # The row stays queued; the sweep picks it up. A dead broker must never fail the request.
            logger.warning("Could not queue an email task; it will be retried by the sweep", exc_info=True)


def _permanent(exc):
    if isinstance(exc, (smtplib.SMTPRecipientsRefused, BadHeaderError, ValueError)):
        return True
    code = getattr(exc, "smtp_code", None)
    return isinstance(exc, smtplib.SMTPResponseException) and isinstance(code, int) and 500 <= code < 600


def _describe(exc):
    code = getattr(exc, "smtp_code", None)
    return f"{type(exc).__name__}{f' {code}' if code else ''}"[:300]


def deliver(email_id):
    """Send one queued email. Safe to call twice at once: only the caller that claims the row sends it."""
    now = timezone.now()
    claimed = OutboundEmail.objects.filter(pk=email_id, status=EmailStatus.QUEUED).update(
        status=EmailStatus.SENDING, claimed_at=now, attempts=F("attempts") + 1
    )
    if not claimed:
        return "skipped"
    email = OutboundEmail.objects.get(pk=email_id)
    try:
        message = EmailMultiAlternatives(email.subject, email.body_text, settings.DEFAULT_FROM_EMAIL, [email.to_email])
        if email.body_html:
            message.attach_alternative(email.body_html, "text/html")
        message.send(fail_silently=False)
    except Exception as exc:  # noqa: BLE001 - classified below; delivery errors never propagate
        return _failed(email, exc)
    fields = {"status": EmailStatus.SENT, "sent_at": timezone.now(), "last_error": "", "claimed_at": None}
    if email.sensitive:
        fields.update(body_text="", body_html="", body_purged=True)
    OutboundEmail.objects.filter(pk=email.pk).update(**fields)
    return "sent"


def _failed(email, exc):
    logger.warning("Email delivery failed (kind=%s, attempt=%d): %s", email.kind, email.attempts, _describe(exc))
    delays = settings.EMAIL_RETRY_DELAYS_MINUTES
    final = _permanent(exc) or email.attempts >= settings.EMAIL_OUTBOX_MAX_ATTEMPTS
    fields = {"last_error": _describe(exc), "claimed_at": None}
    if final:
        fields["status"] = EmailStatus.FAILED
        if email.sensitive:
            fields.update(body_text="", body_html="", body_purged=True)
    else:
        delay = delays[min(email.attempts - 1, len(delays) - 1)]
        fields.update(status=EmailStatus.QUEUED, next_attempt_at=timezone.now() + timedelta(minutes=delay))
    OutboundEmail.objects.filter(pk=email.pk).update(**fields)
    return "failed" if final else "retry"


def sweep():
    """Free emails stuck mid-send, then queue every email whose retry is due. Returns (reset, queued)."""
    now = timezone.now()
    reset = OutboundEmail.objects.filter(
        status=EmailStatus.SENDING, claimed_at__lte=now - timedelta(minutes=settings.EMAIL_SENDING_STALE_MINUTES)
    ).update(status=EmailStatus.QUEUED, claimed_at=None, next_attempt_at=now)
    due = list(
        OutboundEmail.objects.filter(status=EmailStatus.QUEUED, next_attempt_at__lte=now)
        .order_by("next_attempt_at")
        .values_list("pk", flat=True)[:BULK_LIMIT]
    )
    _enqueue([str(pk) for pk in due])
    return reset, len(due)


def purge():
    """Wipe old credential-bearing bodies and delete very old rows. Returns (bodies wiped, rows deleted)."""
    now = timezone.now()
    cutoff = now - timedelta(days=settings.EMAIL_SENSITIVE_BODY_RETENTION_DAYS)
    wiped = (
        OutboundEmail.objects.filter(sensitive=True, body_purged=False)
        .exclude(status__in=[EmailStatus.QUEUED, EmailStatus.SENDING])
        .filter(created_at__lte=cutoff)
        .update(body_text="", body_html="", body_purged=True)
    )
    deleted, _ = (
        OutboundEmail.objects.exclude(status__in=[EmailStatus.QUEUED, EmailStatus.SENDING])
        .filter(created_at__lte=now - timedelta(days=settings.EMAIL_ROW_RETENTION_DAYS))
        .delete()
    )
    return wiped, deleted

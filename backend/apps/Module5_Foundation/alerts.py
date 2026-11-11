import logging
from datetime import timedelta

from django.conf import settings
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.common.choices import UserRole, UserStatus

from .models import AIRequestLog, AIRequestStatus, AlertKind, AlertSeverity, EmailStatus, OutboundEmail, SystemAlert
from .outbox import send_email

logger = logging.getLogger(__name__)

HEARTBEAT_KEY = "foundation:worker-heartbeat"
HEARTBEAT_MISSING_KEY = "foundation:worker-heartbeat-missing-since"
HEARTBEAT_STALE_SECONDS = 180
HEARTBEAT_GRACE_SECONDS = 300
AI_WINDOW_MINUTES = 15
AI_MIN_CALLS = 10
AI_FAILURE_RATE = 0.2
EMAIL_OVERDUE_MINUTES = 30
EMAIL_CRITICAL_COUNT = 20


def record_heartbeat():
    cache.set(HEARTBEAT_KEY, timezone.now().timestamp(), 600)


def _heartbeat_age():
    stamp = cache.get(HEARTBEAT_KEY)
    return None if stamp is None else timezone.now().timestamp() - stamp


def _notify_admins(alert):
    emails = list(
        _admin_model().objects.filter(role=UserRole.PLATFORM_ADMIN, status=UserStatus.ACTIVE).values_list("email", flat=True)
    )
    if not emails:
        logger.warning("Critical alert %s raised but there is no active platform admin to email.", alert.kind)
        return
    send_email(
        to=emails,
        subject=f"[IntelliHire] {alert.get_kind_display()}",
        body=f"{alert.message}\n\nOpen the admin dashboard for details.",
        kind="system_alert",
    )


def _admin_model():
    from django.contrib.auth import get_user_model

    return get_user_model()


def _raise(kind, severity, message, now):
    """Open the alert, or refresh the open one. Admins are emailed only when a critical alert appears or escalates."""
    try:
        with transaction.atomic():
            alert = SystemAlert.objects.select_for_update().filter(kind=kind, is_active=True).first()
            if alert is None:
                alert = SystemAlert.objects.create(kind=kind, severity=severity, message=message, created_at=now)
                email = severity == AlertSeverity.CRITICAL
            else:
                email = severity == AlertSeverity.CRITICAL and alert.severity != AlertSeverity.CRITICAL
                alert.severity, alert.message = severity, message
                alert.save(update_fields=["severity", "message"])
    except IntegrityError:  # another run opened it first
        return
    if email:
        _notify_admins(alert)


def _resolve(kind, now):
    SystemAlert.objects.filter(kind=kind, is_active=True).update(is_active=False, resolved_at=now)


def _check_ai(now):
    window = AIRequestLog.objects.filter(created_at__gte=now - timedelta(minutes=AI_WINDOW_MINUTES))
    total = window.count()
    failed = window.filter(status=AIRequestStatus.FAILED).count()
    if total >= AI_MIN_CALLS and failed / total > AI_FAILURE_RATE:
        _raise(AlertKind.AI_FAILURE_RATE, AlertSeverity.CRITICAL, f"{failed} of {total} AI calls failed in the last {AI_WINDOW_MINUTES} minutes.", now)
    else:
        _resolve(AlertKind.AI_FAILURE_RATE, now)


def _check_email(now):
    overdue = OutboundEmail.objects.filter(
        status__in=[EmailStatus.QUEUED, EmailStatus.SENDING], next_attempt_at__lte=now - timedelta(minutes=EMAIL_OVERDUE_MINUTES)
    ).count()
    if overdue:
        severity = AlertSeverity.CRITICAL if overdue >= EMAIL_CRITICAL_COUNT else AlertSeverity.WARNING
        _raise(AlertKind.EMAIL_QUEUE_BACKLOG, severity, f"{overdue} email(s) have been waiting more than {EMAIL_OVERDUE_MINUTES} minutes.", now)
    else:
        _resolve(AlertKind.EMAIL_QUEUE_BACKLOG, now)


def _check_worker(now, *, can_raise):
    """A dead worker cannot report itself, so only a web process or cron job may raise this alert."""
    if settings.CELERY_TASK_ALWAYS_EAGER:
        return
    age = _heartbeat_age()
    if age is not None and age <= HEARTBEAT_STALE_SECONDS:
        cache.delete(HEARTBEAT_MISSING_KEY)
        _resolve(AlertKind.WORKER_DOWN, now)
        return
    if not can_raise:
        return
    first_seen = cache.get(HEARTBEAT_MISSING_KEY)
    if first_seen is None:
        cache.set(HEARTBEAT_MISSING_KEY, now.timestamp(), 3600)  # grace period after a deploy or cache reset
        first_seen = now.timestamp()
    if age is not None or now.timestamp() - first_seen >= HEARTBEAT_GRACE_SECONDS:
        _raise(AlertKind.WORKER_DOWN, AlertSeverity.CRITICAL, "No background worker has reported in recently.", now)


def check_alerts(*, evaluate_worker=False, now=None):
    """Open, update or resolve system alerts from the current state. Safe to run as often as you like."""
    now = now or timezone.now()
    _check_ai(now)
    _check_email(now)
    _check_worker(now, can_raise=evaluate_worker)

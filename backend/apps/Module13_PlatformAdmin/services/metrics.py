"""The dashboard, system health and the AI usage report. Every number comes from an aggregate query (FR-71 to FR-76, UC-13)."""
import os
import tempfile
from datetime import timedelta

from django.conf import settings
from django.core.cache import cache
from django.db import connection
from django.db.models import Avg, Count, Q, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone

from apps.common.choices import CompanyStatus, UserStatus
from apps.Module1_Authentication.models import User
from apps.Module12_Communities.models import Community
from apps.Module2_CompanyManagement.models import Company
from apps.Module3_JobPosting.models import JobPosting, JobStatus
from apps.Module4_ApplicationManagement.models import Application
from apps.Module5_Foundation.models import AIRequestLog, AIRequestStatus, EmailStatus, OutboundEmail, SystemAlert
from apps.Module7_Interviews.models import InterviewSession, SessionStatus

from ..models import BackupStatus, FlagStatus, ModerationFlag
BACKUP_WARN_HOURS = 26


def _counts(queryset, field):
    return {row[field]: row["total"] for row in queryset.values(field).annotate(total=Count("pk"))}


def dashboard():
    now = timezone.now()
    week, month, day = now - timedelta(days=7), now - timedelta(days=30), now - timedelta(hours=24)
    ai = AIRequestLog.objects.filter(created_at__gte=day).aggregate(
        calls=Count("pk"), failures=Count("pk", filter=~Q(status=AIRequestStatus.OK)), latency=Avg("latency_ms"),
        prompt_tokens=Sum("prompt_tokens"), completion_tokens=Sum("completion_tokens"),
    )  # fmt: skip
    return {
        "users": {"by_role": _counts(User.objects, "role"), "by_status": _counts(User.objects, "status"), "total": User.objects.count()},
        "companies": {"by_status": _counts(Company.objects, "status"), "pending_review": Company.objects.filter(status=CompanyStatus.PENDING).count()},
        "jobs": {"open": JobPosting.objects.filter(status=JobStatus.OPEN).count(), "by_status": _counts(JobPosting.objects, "status")},
        "applications": {"last_7_days": Application.objects.filter(submitted_at__gte=week).count(), "last_30_days": Application.objects.filter(submitted_at__gte=month).count(), "total": Application.objects.count()},
        "interviews_30_days": _counts(InterviewSession.objects.filter(completed_at__gte=month, status__in=[SessionStatus.COMPLETED, SessionStatus.EVALUATED, SessionStatus.INCOMPLETE]), "kind"),
        "communities": {"total": Community.objects.exclude(status="removed").count()},
        "moderation": {"open_flags": ModerationFlag.objects.filter(status__in=[FlagStatus.OPEN, FlagStatus.REVIEWING]).count()},
        "alerts": {"active": SystemAlert.objects.filter(is_active=True).count()},
        "ai_last_24h": {
            "calls": ai["calls"], "failures": ai["failures"], "average_latency_ms": round(ai["latency"] or 0),
            "prompt_tokens": ai["prompt_tokens"] or 0, "completion_tokens": ai["completion_tokens"] or 0,
        },
    }  # fmt: skip


def _database():
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        return {"ok": True, "detail": ""}
    except Exception as exc:  # noqa: BLE001 - a health check reports, it never raises
        return {"ok": False, "detail": type(exc).__name__}


def _storage():
    try:
        root = settings.PRIVATE_MEDIA_ROOT
        os.makedirs(root, exist_ok=True)
        handle = tempfile.NamedTemporaryFile(dir=root, delete=True)
        handle.write(b"ok")
        handle.close()
        return {"ok": True, "detail": ""}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "detail": type(exc).__name__}


def _broker_and_worker():
    """The worker's heartbeat (Module 5 stores a timestamp) and whether the broker answers at all."""
    from datetime import datetime, timezone as dt_timezone

    from apps.Module5_Foundation.alerts import HEARTBEAT_STALE_SECONDS, _heartbeat_age

    age = _heartbeat_age()
    last = cache.get("foundation:worker-heartbeat")
    worker = {
        "ok": age is not None and age < HEARTBEAT_STALE_SECONDS,
        "last_heartbeat": datetime.fromtimestamp(last, dt_timezone.utc) if last else None,
        "seconds_since": round(age) if age is not None else None,
    }
    broker = {"ok": False, "detail": ""}
    try:
        from config.celery import app

        link = app.connection()
        link.ensure_connection(max_retries=0, timeout=2)
        link.release()
        broker["ok"] = True
    except Exception as exc:  # noqa: BLE001 - a health check reports, it never raises
        broker["detail"] = type(exc).__name__
    return broker, worker


def health():
    now = timezone.now()
    hour = now - timedelta(hours=1)
    calls = AIRequestLog.objects.filter(created_at__gte=hour)
    total = calls.count()
    failed = calls.exclude(status=AIRequestStatus.OK).count()
    broker, worker = _broker_and_worker()
    usage = {}
    try:
        import psutil

        disk = psutil.disk_usage(str(settings.BASE_DIR))
        usage = {"cpu_percent": psutil.cpu_percent(interval=0.1), "memory_percent": psutil.virtual_memory().percent, "disk_percent": disk.percent}
    except Exception:  # noqa: BLE001 - psutil is optional at runtime
        usage = {"cpu_percent": None, "memory_percent": None, "disk_percent": None}
    from ..models import BackupRecord

    backup = BackupRecord.objects.filter(status=BackupStatus.SUCCESS).first()
    stale = backup is None or (now - backup.finished_at) > timedelta(hours=BACKUP_WARN_HOURS)
    return {
        "database": _database(), "storage": _storage(), "broker": broker, "worker": worker,
        "email": {"queued": OutboundEmail.objects.filter(status=EmailStatus.QUEUED).count(), "failed": OutboundEmail.objects.filter(status=EmailStatus.FAILED).count()},
        "ai_last_hour": {
            "calls": total, "failures": failed, "failure_rate": round(failed / total, 3) if total else 0.0,
            "last_successful_at": AIRequestLog.objects.filter(status=AIRequestStatus.OK).values_list("created_at", flat=True).first(),
        },
        "resources": usage,
        "alerts": {"active": SystemAlert.objects.filter(is_active=True).count()},
        "backup": {
            "last_successful_at": backup.finished_at if backup else None, "size_bytes": backup.size_bytes if backup else 0,
            "warning": "No successful backup in the last 26 hours." if stale else "",
        },
        "checked_at": now,
    }  # fmt: skip


def ai_usage(start=None, end=None, feature=None):
    """Calls, failures, tokens and average latency per feature per day. No data means no rows, not an error."""
    queryset = AIRequestLog.objects.all()
    if start:
        queryset = queryset.filter(created_at__date__gte=start)
    if end:
        queryset = queryset.filter(created_at__date__lte=end)
    if feature:
        queryset = queryset.filter(feature=feature)
    rows = (
        queryset.annotate(day=TruncDate("created_at"))
        .values("day", "feature")
        .annotate(
            calls=Count("pk"), failures=Count("pk", filter=~Q(status=AIRequestStatus.OK)), prompt_tokens=Sum("prompt_tokens"),
            completion_tokens=Sum("completion_tokens"), average_latency_ms=Avg("latency_ms"),
        )
        .order_by("day", "feature")
    )  # fmt: skip
    return [
        {
            "day": row["day"], "feature": row["feature"], "calls": row["calls"], "failures": row["failures"],
            "prompt_tokens": row["prompt_tokens"] or 0, "completion_tokens": row["completion_tokens"] or 0,
            "average_latency_ms": round(row["average_latency_ms"] or 0),
        }
        for row in rows
    ]  # fmt: skip


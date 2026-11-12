"""Time-driven changes: links that expire and sessions that go quiet. Each is a compare-and-set, so it is safe to run twice."""
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.Module5_Foundation.events import log_event

from ..models import InterviewSession, SessionStatus
from . import notices

SWEEP_LIMIT = 500


def mark_expired(session):
    """Expire a session whose link ran out before the candidate finished. True only for the caller that changed it."""
    with transaction.atomic():
        won = InterviewSession.objects.filter(
            pk=session.pk, status__in=[SessionStatus.INVITED, SessionStatus.INTERRUPTED]
        ).update(status=SessionStatus.EXPIRED)
        if won and session.application_id:
            session.refresh_from_db()
            log_event(
                "interview.expired", company=session.application.job.company_id, target=session,
                summary=f"{session.get_kind_display()} interview link expired", metadata={"kind": session.kind},
            )  # fmt: skip
            label = "Screening" if session.kind == "screening" else session.get_kind_display() + " interview"
            notices.notify_hr(
                session, "interview_expired", f"{label} not completed: {session.role_title}",
                "The candidate did not complete the interview before the link expired.",
            )  # fmt: skip
    return bool(won)


def expire_due():
    now = timezone.now()
    due = InterviewSession.objects.filter(
        status__in=[SessionStatus.INVITED, SessionStatus.INTERRUPTED], expires_at__lte=now
    ).select_related("application__job__company")[:SWEEP_LIMIT]
    return sum(mark_expired(session) for session in list(due))


def interrupt_idle():
    """In-progress sessions with no activity for INTERVIEW_IDLE_MINUTES become interrupted (the same link resumes them)."""
    cutoff = timezone.now() - timedelta(minutes=settings.INTERVIEW_IDLE_MINUTES)
    return InterviewSession.objects.filter(status=SessionStatus.IN_PROGRESS).filter(
        Q(last_activity_at__lt=cutoff) | Q(last_activity_at__isnull=True, started_at__lt=cutoff)
    ).update(status=SessionStatus.INTERRUPTED)

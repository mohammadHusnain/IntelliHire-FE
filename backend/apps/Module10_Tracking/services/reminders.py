"""The 48-hour reminder for an interview nobody has started (FR-62). One email at most per interview, safe to run twice."""
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.common.choices import CompanyStatus
from apps.Module5_Foundation.events import log_event
from apps.Module5_Foundation.notifications import notify
from apps.Module7_Interviews.models import InterviewSession, SessionStatus
from apps.Module7_Interviews.services import links

from .. import emails

SWEEP_LIMIT = 200


def send_due():
    """Remind every unstarted, still-valid interview that expires within TRACKING_REMINDER_HOURS. Returns how many were sent.

    The reminder carries a new link (the raw token is not kept anywhere), so the old one stops working; the email says so.
    The claim is one compare-and-set, so two sweeps at once send one email.
    """
    now = timezone.now()
    due = list(
        InterviewSession.objects.filter(
            status=SessionStatus.INVITED, started_at__isnull=True, reminder_sent_at__isnull=True, application__isnull=False,
            kind__in=["screening", "technical"], expires_at__gt=now, expires_at__lte=now + timedelta(hours=settings.TRACKING_REMINDER_HOURS),
        )
        .select_related("application__job__company")
        .order_by("expires_at")[:SWEEP_LIMIT]
    )
    sent = 0
    for session in due:
        if session.application.job.company.status != CompanyStatus.APPROVED:
            continue
        raw = links.new_token()
        with transaction.atomic():
            won = InterviewSession.objects.filter(pk=session.pk, status=SessionStatus.INVITED, reminder_sent_at__isnull=True).update(
                reminder_sent_at=now, token_hash=links.hash_token(raw)
            )
            if not won:
                continue
            emails.send_interview_reminder(session, raw)
            if session.candidate_user_id:
                notify(session.candidate_user, "interview_reminder", f"Reminder: interview for {session.role_title}", "Your interview link expires soon. Check your email.")
            log_event(
                "interview.reminded", company=session.application.job.company_id, target=session, summary="Interview reminder sent",
                metadata={"kind": session.kind},
            )  # fmt: skip
            sent += 1
    return sent

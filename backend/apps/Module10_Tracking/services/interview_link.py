"""Getting an interview link again from the tracking page (Q1 a): a new link replaces the old one, nothing raw is ever stored."""
from django.db import transaction
from django.utils import timezone

from apps.common.choices import CompanyStatus
from apps.common.errors import ApiError
from apps.Module5_Foundation.events import log_event
from apps.Module7_Interviews.models import InterviewSession, SessionStatus
from apps.Module7_Interviews.services import links

from . import stages


def _none():
    return ApiError("There is no interview waiting for you.", "no_pending_interview", 404)


def issue(application):
    """Rotate the token of the interview the candidate can start or resume and return its new URL (404 when there is none)."""
    raw = links.new_token()
    with transaction.atomic():
        sessions = list(
            InterviewSession.objects.select_for_update(of=("self",)).filter(application=application, status__in=stages.PENDING_INVITE_STATUSES)
        )
        pending = stages.pending_invitation(sessions, timezone.now(), application.job.company.status == CompanyStatus.APPROVED)
        if pending is None:
            raise _none()
        won = InterviewSession.objects.filter(pk=pending.pk, status__in=[SessionStatus.INVITED, SessionStatus.INTERRUPTED]).update(
            token_hash=links.hash_token(raw)
        )
        if not won:
            raise _none()
        log_event(
            "interview.resent", company=application.job.company_id, target=pending, summary="Interview link reissued to the candidate",
            metadata={"kind": pending.kind, "by": "candidate"},
        )  # fmt: skip
    return {"url": links.interview_url(raw), "kind": pending.kind, "expires_at": pending.expires_at}

"""What HR can do to an existing interview: resend the link, extend the deadline, cancel, evaluate again."""
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers

from apps.common.errors import ApiError, violated_constraint
from apps.Module5_Foundation.events import log_event

from ..models import OPEN_STATUSES, InterviewSession, SessionStatus
from . import links, notices
from .engine import answered_count
from .evaluation import queue_evaluation
from .invite import MAX_EXPIRY_DAYS, OPEN_CONSTRAINT


def _locked(session):
    return InterviewSession.objects.select_related("application__job__company").select_for_update(of=("self",)).get(pk=session.pk)


def _event(kind, session, user, **metadata):
    log_event(
        f"interview.{kind}", actor=user, company=session.application.job.company_id, target=session,
        summary=f"Interview {kind}", metadata={"kind": session.kind, **metadata},
    )  # fmt: skip


def resend(session, user):
    """A new link replaces the old one (which stops working). The deadline stays the same."""
    raw = links.new_token()
    with transaction.atomic():
        locked = _locked(session)
        if locked.status not in OPEN_STATUSES:
            raise ApiError("This interview is already closed, so the link cannot be sent again.", "interview_closed", 409)
        if locked.expires_at <= timezone.now():
            raise ApiError("The deadline has passed. Extend it first.", "link_expired", 409)
        locked.token_hash = links.hash_token(raw)
        locked.save(update_fields=["token_hash"])
        _event("resent", locked, user)
        notices.send_invitation(locked, raw)
    return locked


def extend(session, user, days):
    """Move the deadline `days` (1 to 14) past the later of the old deadline and now. An expired link comes back to life."""
    if not isinstance(days, int) or isinstance(days, bool) or not 1 <= days <= MAX_EXPIRY_DAYS:
        raise serializers.ValidationError({"days": [f"Choose a whole number of days between 1 and {MAX_EXPIRY_DAYS}."]})
    with transaction.atomic():
        locked = _locked(session)
        if locked.status not in (*OPEN_STATUSES, SessionStatus.EXPIRED):
            raise ApiError("This interview is already closed.", "interview_closed", 409)
        locked.expires_at = max(locked.expires_at, timezone.now()) + timedelta(days=days)
        fields = ["expires_at"]
        if locked.status == SessionStatus.EXPIRED:
            locked.status = SessionStatus.INTERRUPTED if locked.started_at else SessionStatus.INVITED
            fields.append("status")
        try:
            with transaction.atomic():
                locked.save(update_fields=fields)
        except IntegrityError as exc:
            if violated_constraint(exc) == OPEN_CONSTRAINT:
                raise ApiError("A newer interview of this kind is already open for this candidate.", "open_session_exists", 409) from None
            raise
        _event("extended", locked, user, days=days)
    return locked


def cancel(session, user):
    """Kill the link. The application's status is not touched."""
    with transaction.atomic():
        won = InterviewSession.objects.filter(pk=session.pk, status__in=OPEN_STATUSES).update(status=SessionStatus.CANCELLED)
        if not won:
            raise ApiError("This interview is already closed.", "interview_closed", 409)
        locked = _locked(session)
        _event("cancelled", locked, user)
    return locked


RESCORABLE = (SessionStatus.COMPLETED, SessionStatus.INCOMPLETE, SessionStatus.EVALUATED, SessionStatus.EVALUATION_FAILED)


def reevaluate(session, user):
    """Score the answers and write the report again. Answers that cannot be re-scored keep their earlier score."""
    with transaction.atomic():
        locked = _locked(session)
        if locked.status == SessionStatus.EVALUATING:
            raise ApiError("An evaluation is running right now.", "evaluation_running", 409)
        if locked.status not in RESCORABLE:
            raise ApiError("Only a finished interview can be evaluated.", "not_completed", 409)
        finished_early = answered_count(locked) < locked.question_target
        locked.status = SessionStatus.INCOMPLETE if finished_early else SessionStatus.COMPLETED
        locked.evaluation_attempts, locked.next_evaluation_at = 0, timezone.now()
        locked.save(update_fields=["status", "evaluation_attempts", "next_evaluation_at"])
        _event("reevaluated", locked, user)
        queue_evaluation(locked.pk, rescore=True)
    return locked

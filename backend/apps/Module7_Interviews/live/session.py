"""Opening and closing a live session in the database.

The call itself is new; everything after it is not. `finish_live` writes the transcript as ordinary
`InterviewTurn` rows and then hands over to the existing `evaluation.queue_evaluation`, so the
score arithmetic, the recommendation, Module 8's automatic technical invitation and Module 9's
ranking all keep working untouched.
"""
import logging

from django.db import transaction
from django.db.models import F
from django.db.models.functions import Coalesce
from django.utils import timezone

from ..models import AnswerSource, InterviewSession, InterviewTurn, SessionStatus
from ..services import evaluation
from .transcript import to_turns

logger = logging.getLogger(__name__)
MAX_ANSWER_CHARS = 8000
MAX_QUESTION_CHARS = 2000


def begin_live(session):
    """Mark the session in progress. Idempotent, so a reconnection does not reset `started_at`."""
    now = timezone.now()
    with transaction.atomic():
        moved = InterviewSession.objects.filter(
            pk=session.pk, status__in=[SessionStatus.INVITED, SessionStatus.INTERRUPTED]
        ).update(status=SessionStatus.IN_PROGRESS, started_at=Coalesce(F("started_at"), now), last_activity_at=now)
        if not moved:
            InterviewSession.objects.filter(pk=session.pk, status=SessionStatus.IN_PROGRESS).update(last_activity_at=now)
    session.refresh_from_db()
    return session


def finish_live(session, entries, reason="stopped"):
    """Store the transcript as turns and queue the existing evaluation.

    A call with no answers at all is left `interrupted` so the candidate's link still works and the
    sweep can expire it; there is nothing to score.
    """
    pairs = to_turns(entries)
    now = timezone.now()

    if not pairs:
        InterviewSession.objects.filter(pk=session.pk, status=SessionStatus.IN_PROGRESS).update(
            status=SessionStatus.INTERRUPTED, last_activity_at=now
        )
        session.refresh_from_db()
        return session

    with transaction.atomic():
        locked = InterviewSession.objects.select_for_update(of=("self",)).get(pk=session.pk)
        if locked.status in (SessionStatus.COMPLETED, SessionStatus.EVALUATED, SessionStatus.INCOMPLETE):
            return locked  # already saved by another path; never write a second transcript
        locked.turns.all().delete()  # a live call is the whole interview, so there is nothing to keep
        InterviewTurn.objects.bulk_create([
            InterviewTurn(
                session=locked,
                index=index,
                question_text=pair["question_text"][:MAX_QUESTION_CHARS],
                question_meta={"source": "live", "is_follow_up": index > 1},
                answer_text=pair["answer_text"][:MAX_ANSWER_CHARS],
                answer_source=AnswerSource.VOICE,
                answered_at=now,
            )
            for index, pair in enumerate(pairs, 1)
        ])
        status = SessionStatus.COMPLETED if reason in ("time_up", "stopped") else SessionStatus.INCOMPLETE
        InterviewSession.objects.filter(pk=locked.pk).update(
            status=status, completed_at=now, last_activity_at=now, question_target=len(pairs)
        )

    session.refresh_from_db()
    evaluation.queue_evaluation(session.pk)
    logger.info("Live %s interview %s stored %d answers (%s)", session.kind, session.pk, len(pairs), reason)
    return session

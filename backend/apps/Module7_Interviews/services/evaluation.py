"""Evaluating a finished interview: score the answers, compute the numbers, write the report, apply the guard.

Idempotent and durable: the session row is the source of truth, a compare-and-set claim makes duplicate tasks harmless,
and the sweep re-queues anything stuck, failed or parked. With no hooks merged it does nothing and the session stays
completed; it looks again after INTERVIEW_EVAL_PARKED_HOURS, so merging the hooks later picks the backlog up by itself.
"""
import logging
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.Module5_Foundation.ai.config import get_config
from apps.Module5_Foundation.events import log_event

from .. import runner
from ..models import InterviewSession, InterviewTurn, SessionStatus
from ..signals import interview_evaluated
from . import notices, scoring

logger = logging.getLogger(__name__)
CLAIMABLE = (SessionStatus.COMPLETED, SessionStatus.INCOMPLETE, SessionStatus.EVALUATION_FAILED)
CENTS = Decimal("0.01")
SWEEP_LIMIT = 200
# The only things a hook may add to a report: words. Numbers and the recommendation are never taken from it.
TEXT_KEYS = ("summary", "strengths", "weaknesses", "suggestions", "dimension_comments", "technical_relevance")


def queue_evaluation(session_id, rescore=False):
    """Hand the evaluation to the worker after the transaction commits. A dead broker only delays it: the sweep re-queues."""

    def send():
        from ..tasks import evaluate_session

        try:
            evaluate_session.delay(str(session_id), rescore)
        except Exception:
            logger.warning("Could not queue an interview evaluation; the sweep will retry it", exc_info=True)

    transaction.on_commit(send)


def save_turn_result(turn_id, result):
    """Store one validated per-answer result on its turn."""
    score = Decimal(str(result["score"])).quantize(CENTS, rounding=ROUND_HALF_UP)
    evaluation = {"score": float(score), "criteria": result["criteria"], "feedback": result["feedback"], "flags": result["flags"]}
    InterviewTurn.objects.filter(pk=turn_id).update(evaluation=evaluation, score=score)


def minimum_for(kind):
    return get_config().screening_min_score


def _claim(session_id):
    with transaction.atomic():
        session = InterviewSession.objects.select_related("application__job__company").select_for_update(of=("self",)).filter(pk=session_id).first()
        if session is None or session.status not in CLAIMABLE:
            return None
        previous = session.status
        session.status, session.evaluation_claimed_at = SessionStatus.EVALUATING, timezone.now()
        session.evaluation_attempts += 1
        session.save(update_fields=["status", "evaluation_claimed_at", "evaluation_attempts"])
        return session, previous


def _park(session, previous):
    """Nothing is connected: put the session back as it was and look again later."""
    InterviewSession.objects.filter(pk=session.pk, status=SessionStatus.EVALUATING).update(
        status=previous, evaluation_claimed_at=None, evaluation_attempts=max(0, session.evaluation_attempts - 1),
        next_evaluation_at=timezone.now() + timedelta(hours=settings.INTERVIEW_EVAL_PARKED_HOURS),
    )  # fmt: skip
    return "not_connected"


def _fail(session):
    attempts = session.evaluation_attempts
    final = attempts >= settings.INTERVIEW_EVAL_MAX_ATTEMPTS
    won = InterviewSession.objects.filter(pk=session.pk, status=SessionStatus.EVALUATING).update(
        status=SessionStatus.EVALUATION_FAILED, evaluation_claimed_at=None,
        next_evaluation_at=None if final else timezone.now() + timedelta(minutes=settings.INTERVIEW_EVAL_RETRY_MINUTES),
    )  # fmt: skip
    if won and (attempts == 1 or final):
        text = "Use Evaluate again to retry." if final else "It will be retried automatically."
        notices.notify_hr(session, "interview_evaluation_failed", f"Interview evaluation failed: {session.role_title}", text)
    return "failed"


def _report(session, scored, turns, text):
    """The numbers come from code and win over anything the hook says; the hook only adds words."""
    comments = {item["index"]: item["comment"] for item in text.get("per_question", [])}
    report = {k: v for k, v in text.items() if k in TEXT_KEYS}
    for key, empty in (("summary", ""), ("strengths", []), ("weaknesses", [])):
        report.setdefault(key, empty)
    report.update(
        rubric_averages=scoring.rubric_averages(scored, session.kind), scored_answers=len(scored), total_answers=len(turns),
        per_question=[
            {"index": t.index, "score": float(t.score) if t.score is not None else None, "comment": comments.get(t.index, "")}
            for t in turns
        ],
    )  # fmt: skip
    return report


def evaluate(session_id, rescore=False):
    """Returns "evaluated", "failed", "not_connected" or "skipped" (someone else has it, or it is not finished)."""
    claimed = _claim(session_id)
    if claimed is None:
        return "skipped"
    session, previous = claimed
    turns = list(session.turns.filter(answered_at__isnull=False).order_by("index"))
    answer_hook, failed = True, False
    for turn in turns:
        if turn.score is not None and not rescore:
            continue
        try:
            result = runner.call("evaluate_answer", session, turn, session=session)
        except Exception as exc:  # AIError after the runner's retry, or a crashing hook
            logger.warning("evaluate_answer hook failed: %s", type(exc).__name__)
            failed = True
            continue
        if result is runner.NOT_CONNECTED:
            answer_hook = False
            break
        save_turn_result(turn.pk, result)
    turns = list(session.turns.filter(answered_at__isnull=False).order_by("index"))
    scored = [t for t in turns if t.score is not None]
    try:
        text = runner.call("evaluate_session", session, turns, session=session)
    except Exception as exc:
        logger.warning("evaluate_session hook failed: %s", type(exc).__name__)
        return _fail(session)
    if text is runner.NOT_CONNECTED:
        if not scored:
            return _fail(session) if failed else _park(session, previous)
        text = {}
    elif failed and not scored:
        return _fail(session)
    overall = scoring.overall_score(t.score for t in scored)
    recommendation = scoring.recommendation_for(overall, minimum_for(session.kind)) if session.kind != "mock" else None
    won = InterviewSession.objects.filter(pk=session.pk, status=SessionStatus.EVALUATING).update(
        status=SessionStatus.EVALUATED, overall_score=overall, recommendation=recommendation,
        report=_report(session, scored, turns, text), evaluation_claimed_at=None, next_evaluation_at=None,
    )  # fmt: skip
    if not won:
        return "skipped"
    session.refresh_from_db()
    _announce(session, recommendation, overall)
    return "evaluated"


def _announce(session, recommendation, overall):
    if not session.application_id:
        return
    log_event(
        "interview.evaluated", company=session.application.job.company_id, target=session,
        summary=f"{session.get_kind_display()} interview evaluated",
        metadata={"kind": session.kind, "recommendation": recommendation, "overall_score": float(overall) if overall is not None else None},
    )  # fmt: skip
    body = f"Recommendation: {str(recommendation).replace('_', ' ')}. Open the transcript to review it." if recommendation else "Open the transcript to review it."
    notices.notify_hr(session, "interview_evaluated", f"Interview evaluated: {session.role_title}", body)
    interview_evaluated.send_robust(sender=InterviewSession, session=session, recommendation=recommendation)


def sweep():
    """Free evaluations stuck mid-run, then queue every one that is due. Returns (reset, queued)."""
    now = timezone.now()
    reset = InterviewSession.objects.filter(
        status=SessionStatus.EVALUATING, evaluation_claimed_at__lte=now - timedelta(minutes=settings.INTERVIEW_EVAL_STALE_MINUTES)
    ).update(status=SessionStatus.EVALUATION_FAILED, evaluation_claimed_at=None, next_evaluation_at=now)
    due = list(
        InterviewSession.objects.filter(status__in=CLAIMABLE, next_evaluation_at__lte=now)
        .order_by("next_evaluation_at")
        .values_list("pk", flat=True)[:SWEEP_LIMIT]
    )
    for session_id in due:
        queue_evaluation(session_id)
    return reset, len(due)

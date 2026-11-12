"""What the candidate does with a link: open, start, answer, finish, resume. Shared by every interview kind.

The rules that keep it safe: an answer is saved before any hook is called (NFR-06); `turn_index` makes answering
idempotent; the session row is locked only for short database work, never around a hook call; and the one status change
that completes a session is a compare-and-set, so exactly one request queues the evaluation.
"""
import logging
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import serializers

from apps.common.choices import CompanyStatus
from apps.common.errors import ApiError
from apps.Module5_Foundation.ai.config import get_config
from apps.Module5_Foundation.events import log_event

from .. import runner
from ..ai_hooks import AIError, AIUnavailable
from ..models import FINISHED_STATUSES, OPEN_STATUSES, InterviewSession, InterviewTurn, SessionStatus
from . import kinds, links, notices
from .bank import NoQuestionAvailable
from .evaluation import queue_evaluation, save_turn_result

logger = logging.getLogger(__name__)

INSTRUCTIONS = {
    "screening": (
        "Answer each question in your own words. There are no trick questions: we want to understand your interest in "
        "the role, what you know about it and your relevant experience. You can pause and come back with the same link."
    ),
    "technical": "Answer each question as fully as you can, and explain your reasoning. You can pause and come back with the same link.",
    "mock": "This is a practice interview. Answer as you would in a real one; you will get feedback at the end.",
}
UNAVAILABLE = "This interview is no longer available."


def gone(code, message):
    return ApiError(message, code, 410)


# --- Finding and checking the session ---------------------------------------------------------------------------
def session_for_token(raw_token):
    try:
        return InterviewSession.objects.select_related("application__job__company").get(token_hash=links.hash_token(raw_token))
    except InterviewSession.DoesNotExist:
        raise ApiError("Interview not found.", "not_found", 404) from None


def _company(session):
    return session.application.job.company if session.application_id else None


def ensure_available(session, *, allow_finished=False):
    """Raise 410 when the link may no longer be used. `allow_finished` lets a replayed answer or finish get its stored result."""
    company = _company(session)
    if company is not None and company.status != CompanyStatus.APPROVED:
        raise gone("interview_unavailable", UNAVAILABLE)
    status = session.status
    if status == SessionStatus.CANCELLED:
        raise gone("interview_cancelled", "This interview has been cancelled. Please contact the recruiting team.")
    if status in FINISHED_STATUSES:
        if allow_finished:
            return
        raise gone("interview_completed", "This interview has already been completed. Thank you.")
    expired = gone(
        "interview_expired",
        f"This interview link has expired. Please contact the recruiting team{f' at {company.name}' if company else ''}.",
    )
    if status == SessionStatus.EXPIRED:
        raise expired
    if status in (SessionStatus.INVITED, SessionStatus.INTERRUPTED) and session.expires_at <= timezone.now():
        from .lifecycle import mark_expired

        mark_expired(session)
        raise expired


# --- Reading state ----------------------------------------------------------------------------------------------
def answered_count(session):
    return session.turns.filter(answered_at__isnull=False).count()


def current_turn(session):
    return session.turns.filter(answered_at__isnull=True).order_by("index").first()


def turn_payload(turn):
    if not turn:
        return None
    return {"index": turn.index, "question_text": turn.question_text, "asked_at": turn.asked_at, "is_follow_up": bool(turn.question_meta.get("is_follow_up"))}


def public_summary(session):
    started = session.started_at is not None
    left = None if started else max(0, int((session.expires_at - timezone.now()).total_seconds()))
    return {
        "company_name": session.application.job.company.name if session.application_id else "",
        "role_title": session.role_title,
        "kind": session.kind,
        "status": session.status,
        "instructions": INSTRUCTIONS[session.kind],
        "question_count": session.question_target,
        "answered_count": answered_count(session),
        "estimated_minutes": notices.estimated_minutes(session),
        "expires_at": session.expires_at,
        "seconds_left_to_start": left,
        "voice_available": settings.INTERVIEW_VOICE_ENABLED,
        "ai_disclaimer": notices.AI_DISCLAIMER,
        "current_turn": turn_payload(current_turn(session)),
    }


# --- Making the next question -----------------------------------------------------------------------------------
def _hint(session, turns):
    return kinds.rules_for(session.kind).hint(session, turns)


def ensure_current_turn(session):
    """The unanswered question the candidate should see, creating the next one if needed; None when all are answered.

    The hook is called outside any lock. If two requests race, the unique (session, index) rule and a re-check under
    the lock make sure both get the same question. Raises NoQuestionAvailable when even the bank is empty.
    """
    turns = list(session.turns.order_by("index"))
    pending = next((t for t in turns if t.answered_at is None), None)
    if pending:
        return pending
    if len(turns) >= session.question_target:
        return None
    hint = _hint(session, turns)
    try:
        question = runner.ask_next_question(session, turns, hint)
    except AIUnavailable:
        raise _outage(session) from None
    if session.ai_failing_since:
        InterviewSession.objects.filter(pk=session.pk).update(ai_failing_since=None)
    meta = {k: question[k] for k in ("competency", "topic", "difficulty", "is_follow_up")}
    meta["from_bank"] = bool(question.get("from_bank"))
    if question.get("bank_id"):
        meta["bank_id"] = question["bank_id"]
    if hint.get("follow_up_of") and question.get("is_follow_up"):
        meta["follow_up_of"] = hint["follow_up_of"]
    with transaction.atomic():
        locked = InterviewSession.objects.select_for_update().get(pk=session.pk)
        if locked.status not in OPEN_STATUSES:
            ensure_available(locked)
        existing = locked.turns.order_by("index").filter(index=len(turns) + 1).first()
        if existing:
            return existing
        return InterviewTurn.objects.create(session=locked, index=len(turns) + 1, question_text=question["question_text"], question_meta=meta)


def _outage(session):
    """The question hook is down and this kind does not fall back to the bank: 503 now, interrupted after a while.

    The answer that led here is already saved. The candidate resumes from the same link, which restarts the clock.
    """
    now = timezone.now()
    InterviewSession.objects.filter(pk=session.pk, ai_failing_since__isnull=True).update(ai_failing_since=now)
    since = InterviewSession.objects.values_list("ai_failing_since", flat=True).get(pk=session.pk)
    if since and (now - since).total_seconds() >= settings.INTERVIEW_AI_OUTAGE_SECONDS:
        won = InterviewSession.objects.filter(pk=session.pk, status=SessionStatus.IN_PROGRESS).update(status=SessionStatus.INTERRUPTED)
        if won and session.application_id:
            log_event(
                "ai.provider_failure", company=session.application.job.company_id, target=session,
                summary="The question service stayed unavailable during an interview", metadata={"kind": session.kind, "hook": "next_question"},
            )  # fmt: skip
    error = ApiError("The interview service is busy. Your answers are saved; please try again shortly.", "ai_unavailable", 503)
    error.wait = settings.INTERVIEW_AI_RETRY_AFTER
    return error


def _unavailable_question():
    error = ApiError("No question is available right now. Please try again in a moment.", "no_question_available", 503)
    error.wait = 30  # DRF turns this into a Retry-After header
    return error


# --- Start ------------------------------------------------------------------------------------------------------
def start(session):
    """Open the first question, or resume where the candidate left off. The session only becomes in progress once a question exists."""
    ensure_available(session)
    try:
        turn = ensure_current_turn(session)
    except NoQuestionAvailable:
        raise _unavailable_question() from None
    now = timezone.now()
    with transaction.atomic():
        moved = InterviewSession.objects.filter(
            pk=session.pk, status__in=[SessionStatus.INVITED, SessionStatus.INTERRUPTED]
        ).update(status=SessionStatus.IN_PROGRESS, started_at=Coalesce(F("started_at"), now), last_activity_at=now, ai_failing_since=None)
        if not moved:
            InterviewSession.objects.filter(pk=session.pk, status=SessionStatus.IN_PROGRESS).update(last_activity_at=now)
    session.refresh_from_db()
    ensure_available(session)  # cancelled or expired while the question was being made
    return {"done": session.status in FINISHED_STATUSES, "turn": turn_payload(turn), **_counts(session)}


def _counts(session):
    return {"answered_count": answered_count(session), "question_count": session.question_target}


# --- Answer -----------------------------------------------------------------------------------------------------
def _answer_text(session, text, audio):
    """The text to store and where it came from. Validation first, then (for audio) transcription."""
    has_text = text is not None and str(text).strip() != ""
    if has_text == (audio is not None):
        raise serializers.ValidationError({"answer_text": ["Send either answer_text or an audio file, not both and not neither."]})
    limit = settings.INTERVIEW_MAX_ANSWER_CHARS
    if has_text:
        text = str(text).strip()
        if len(text) > limit:
            raise serializers.ValidationError({"answer_text": [f"Answers can be at most {limit} characters."]})
        return text, "typed"
    if not kinds.rules_for(session.kind).allow_voice:
        audio.close()
        raise ApiError("This interview accepts typed answers only.", "voice_not_allowed", 400)
    if getattr(audio, "size", 0) > settings.INTERVIEW_MAX_AUDIO_BYTES:
        raise serializers.ValidationError({"audio": ["This recording is too large."]})
    try:
        result = runner.call("transcribe", audio, session=session)
    except AIError:
        raise ApiError("We could not turn your recording into text. Please type your answer.", "transcription_failed", 422) from None
    finally:
        audio.close()
    if result is runner.NOT_CONNECTED:
        raise ApiError("Voice answers are not available yet. Please type your answer.", "voice_not_available", 422)
    if result["duration_seconds"] > settings.INTERVIEW_MAX_AUDIO_SECONDS:
        raise ApiError("This recording is too long. Please keep it shorter or type your answer.", "audio_too_long", 422)
    spoken = result["text"].strip()[:limit]
    if not spoken:
        raise ApiError("We could not hear anything in that recording. Please type your answer.", "transcription_failed", 422)
    return spoken, "voice"


def _store_evaluation(session, turn):
    """Score one saved answer. Anything but a valid score leaves the turn unscored: the answer is already safe."""
    try:
        result = runner.call("evaluate_answer", session, turn, session=session)
    except AIError:
        return
    except Exception as exc:  # a merged hook must never cost the candidate their answer
        logger.warning("evaluate_answer hook failed: %s", type(exc).__name__)
        return
    if result is runner.NOT_CONNECTED:
        return
    save_turn_result(turn.pk, result)


def answer(session, turn_index, text=None, audio=None):
    ensure_available(session, allow_finished=True)
    turn = session.turns.filter(index=turn_index).first()
    if turn is None:
        raise ApiError("That question does not exist.", "wrong_turn", 409)
    if turn.answered_at is not None:
        return progress(session)  # a double click or a second tab: return what the first one produced
    if session.status in FINISHED_STATUSES:
        ensure_available(session)
    if session.status == SessionStatus.INVITED:
        raise ApiError("Start the interview first.", "not_started", 409)
    value, source = _answer_text(session, text, audio)
    now = timezone.now()
    with transaction.atomic():
        locked_session = InterviewSession.objects.select_for_update().get(pk=session.pk)
        locked_turn = InterviewTurn.objects.select_for_update().get(pk=turn.pk)
        if locked_turn.answered_at is not None:
            saved = None
        else:
            if locked_session.status not in (SessionStatus.IN_PROGRESS, SessionStatus.INTERRUPTED):
                ensure_available(locked_session)
            if locked_session.turns.filter(index__lt=turn.index, answered_at__isnull=True).exists():
                raise ApiError("This is not the current question.", "wrong_turn", 409)
            locked_turn.answer_text, locked_turn.answer_source, locked_turn.answered_at = value, source, now
            locked_turn.save(update_fields=["answer_text", "answer_source", "answered_at"])
            locked_session.status, locked_session.last_activity_at = SessionStatus.IN_PROGRESS, now
            locked_session.save(update_fields=["status", "last_activity_at"])
            saved = locked_turn
    if saved is not None:
        _store_evaluation(session, saved)
    return progress(session)


def progress(session):
    """What the candidate sees next: the next question, or done."""
    session.refresh_from_db()
    if session.status in FINISHED_STATUSES:
        return {"done": True, "turn": None, **_counts(session)}
    if answered_count(session) >= session.question_target:
        complete(session, SessionStatus.COMPLETED)
        return {"done": True, "turn": None, **_counts(session)}
    try:
        turn = ensure_current_turn(session)
    except NoQuestionAvailable:
        raise _unavailable_question() from None
    return {"done": False, "turn": turn_payload(turn), **_counts(session)}


# --- Finishing --------------------------------------------------------------------------------------------------
def complete(session, final_status):
    """Compare-and-set the session to completed (or incomplete); only the winner notifies and queues the evaluation."""
    now = timezone.now()
    with transaction.atomic():
        won = InterviewSession.objects.filter(pk=session.pk, status__in=[SessionStatus.IN_PROGRESS, SessionStatus.INTERRUPTED]).update(
            status=final_status, completed_at=now, last_activity_at=now, next_evaluation_at=now
        )
        if not won:
            return False
        session.refresh_from_db()
        if session.application_id:
            log_event(
                "interview.completed", company=session.application.job.company_id, target=session,
                summary=f"{session.get_kind_display()} interview finished", metadata={"kind": session.kind, "status": final_status},
            )  # fmt: skip
            notices.notify_hr(session, "interview_completed", f"Interview finished: {session.role_title}", "A candidate finished their interview.")
        queue_evaluation(session.pk)
    return True


def finish_early(session):
    """The candidate presses Finish: allowed after at least INTERVIEW_MIN_ANSWERS_TO_FINISH answers."""
    ensure_available(session, allow_finished=True)
    if session.status in FINISHED_STATUSES:
        return {"done": True, "turn": None, **_counts(session)}
    count = answered_count(session)
    if session.status == SessionStatus.INVITED or count < settings.INTERVIEW_MIN_ANSWERS_TO_FINISH:
        raise ApiError(
            f"Please answer at least {settings.INTERVIEW_MIN_ANSWERS_TO_FINISH} questions before finishing.", "too_few_answers", 400
        )
    complete(session, SessionStatus.COMPLETED if count >= session.question_target else SessionStatus.INCOMPLETE)
    session.refresh_from_db()
    return {"done": True, "turn": None, **_counts(session)}


def new_expiry(days):
    return timezone.now() + timedelta(days=days)


def target_for(kind):
    config = get_config()
    return {"screening": config.screening_questions, "technical": config.technical_questions, "mock": config.mock_questions}[kind]

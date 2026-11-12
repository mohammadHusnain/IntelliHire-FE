"""The single owner of the hook policy: validation, one retry, the bank fallback and the log row.

Nothing here knows what a hook does inside. It never logs a prompt, a question, an answer or a transcript, only the
hook name, the outcome and how long it took.
"""
import logging
import re
import time

import jsonschema
from apps.Module5_Foundation.ai import llm
from apps.Module5_Foundation.ai.config import get_config
from apps.Module5_Foundation.models import AIRequestStatus

from . import ai_hooks, rubrics
from .ai_hooks import AINotConnected, AIInvalidOutput, AIPolicyBlocked, AIUnavailable
from .services import bank, kinds

logger = logging.getLogger(__name__)
_sleep = time.sleep  # replaced in tests


class _NotConnected:
    def __repr__(self):
        return "NOT_CONNECTED"

    def __bool__(self):
        return False


NOT_CONNECTED = _NotConnected()


def _schema(name, kind):
    if name == "next_question":
        return rubrics.NEXT_QUESTION_SCHEMA
    if name == "evaluate_answer":
        return rubrics.evaluate_answer_schema(kind)
    if name == "evaluate_session":
        return rubrics.evaluate_session_schema(kind)
    return rubrics.TRANSCRIBE_SCHEMA


def _validate(name, kind, result):
    """Out-of-range or missing values are rejected, never clamped or repaired."""
    try:
        jsonschema.validate(result, _schema(name, kind))
    except jsonschema.ValidationError as exc:
        raise AIInvalidOutput(f"{name} returned an invalid result ({exc.validator})") from None
    return result


def _related(session):
    return ("interviewsession", session.pk) if session is not None else None


def call(name, *args, session=None):
    """Run one hook under the policy. Returns the validated result, or NOT_CONNECTED when nothing is merged yet.

    Raises AIUnavailable (after one retry), AIPolicyBlocked or AIInvalidOutput; the caller decides what that means.
    """
    kind = session.kind if session is not None else "screening"
    started = time.monotonic()
    attempts = 0
    while True:
        attempts += 1
        try:
            result = _validate(name, kind, getattr(ai_hooks, name)(*args))
        except AINotConnected:
            return NOT_CONNECTED
        except AIUnavailable as exc:
            if attempts == 1:
                _sleep(float(get_config().retry_delay_seconds))
                continue
            _log(name, AIRequestStatus.FAILED, attempts, started, "unavailable", session)
            raise exc
        except AIPolicyBlocked:
            _log(name, AIRequestStatus.POLICY_BLOCKED, attempts, started, "policy_blocked", session)
            raise
        except AIInvalidOutput as exc:
            _log(name, AIRequestStatus.FAILED, attempts, started, "invalid_output", session)
            raise exc
        except bank.NoQuestionAvailable:
            raise
        except Exception as exc:  # a crashing merged hook is a failed call, never a 500 for the candidate
            _log(name, AIRequestStatus.FAILED, attempts, started, "hook_error", session)
            logger.warning("%s hook crashed: %s", name, type(exc).__name__)
            raise AIInvalidOutput(f"{name} raised an error") from None
        _log(name, AIRequestStatus.OK if attempts == 1 else AIRequestStatus.RETRIED, attempts, started, "", session)
        return result


def _log(name, status, attempts, started, error, session):
    llm._log(
        feature=f"interview_{name}", provider="hook", model="", status=status, attempts=attempts, started=started,
        error=error, related=_related(session),
    )  # fmt: skip


# --- Questions --------------------------------------------------------------------------------------------------
def _norm(text):
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", "", text.lower())).strip()


def check_question(session, question, asked):
    """A reason the question is unusable, or "" when it passes: not a repeat, and (technical) about the role's skills."""
    if _norm(question["question_text"]) in asked:
        return "duplicate"
    if session.kind == "technical":
        skills = [str(s).lower() for s in session.context.get("required_skills", []) if s]
        haystack = f'{question["question_text"]} {question["topic"]}'.lower()
        if skills and not any(skill in haystack for skill in skills):
            return "off_topic"
    return ""


def ask_next_question(session, turns, hint):
    """The next question, never a repeat. The hook gets two tries; anything wrong or down falls back to the bank.

    Returns the question dict (with `from_bank`), or raises bank.NoQuestionAvailable when even the bank has nothing.
    """
    asked = {_norm(turn.question_text) for turn in turns}
    for _ in range(2):
        try:
            question = call("next_question", session, turns, hint, session=session)
        except AIUnavailable:
            if not kinds.rules_for(session.kind).outage_uses_bank:
                raise
            break
        except AIPolicyBlocked:
            kinds.rules_for(session.kind).on_policy_blocked(session)
            break
        except AIInvalidOutput:
            break
        if question is NOT_CONNECTED:
            break
        question = {**question, "from_bank": bool(question.get("from_bank", False))}
        problem = check_question(session, question, asked)
        if not problem:
            return question
        hint = {**hint, "retry_reason": problem, "avoid_topics": [*hint.get("avoid_topics", []), question["topic"]]}
    return bank.pick(session, turns, {k: v for k, v in hint.items() if k != "retry_reason"})

"""The runner owns the policy: validation, one retry, the bank fallback, and what gets logged (spec 7.5)."""
import pytest

from apps.Module5_Foundation.models import AIRequestLog

from .. import ai_hooks, runner
from ..ai_hooks import AIInvalidOutput, AINotConnected, AIPolicyBlocked, AIUnavailable
from ..models import InterviewTurn

pytestmark = pytest.mark.django_db

GOOD_QUESTION = {"question_text": "Tell us about your Python work?", "competency": "experience", "topic": "python", "difficulty": "medium", "is_follow_up": False}
GOOD_ANSWER = {"score": 7, "criteria": {"role_alignment": 7}, "feedback": "Fine.", "flags": []}


def raising(error):
    def hook(*args, **kwargs):
        raise error

    return hook


def logs():
    return list(AIRequestLog.objects.values_list("feature", "status", "attempts", "error"))


def test_not_connected_is_skipped_without_a_failure_log(session):
    assert runner.call("evaluate_answer", session, InterviewTurn(index=1), session=session) is runner.NOT_CONNECTED
    assert runner.call("evaluate_session", session, [], session=session) is runner.NOT_CONNECTED
    assert runner.call("transcribe", object(), session=session) is runner.NOT_CONNECTED
    assert logs() == []


def test_a_good_result_is_returned_and_logged_with_the_hook_name_only(session, monkeypatch):
    monkeypatch.setattr(ai_hooks, "evaluate_answer", lambda s, t: GOOD_ANSWER)
    assert runner.call("evaluate_answer", session, None, session=session) == GOOD_ANSWER
    assert logs()[0] == ("interview_evaluate_answer", "ok", 1, "")
    assert AIRequestLog.objects.get().related_id == session.pk


def test_unavailable_waits_and_retries_once(session, monkeypatch):
    seen, waits = [], []
    monkeypatch.setattr(runner, "_sleep", waits.append)

    def flaky(s, t):
        seen.append(1)
        if len(seen) == 1:
            raise AIUnavailable()
        return GOOD_ANSWER

    monkeypatch.setattr(ai_hooks, "evaluate_answer", flaky)
    assert runner.call("evaluate_answer", session, None, session=session) == GOOD_ANSWER
    assert len(seen) == 2 and len(waits) == 1
    assert logs() == [("interview_evaluate_answer", "retried", 2, "")]


def test_unavailable_twice_is_raised_to_the_caller(session, monkeypatch):
    monkeypatch.setattr(ai_hooks, "evaluate_answer", raising(AIUnavailable()))
    with pytest.raises(AIUnavailable):
        runner.call("evaluate_answer", session, None, session=session)
    assert logs() == [("interview_evaluate_answer", "failed", 2, "unavailable")]


@pytest.mark.parametrize(
    "bad",
    [
        {**GOOD_ANSWER, "score": 11}, {**GOOD_ANSWER, "score": -1}, {**GOOD_ANSWER, "score": "8"},
        {**GOOD_ANSWER, "criteria": {"role_alignment": 12}}, {**GOOD_ANSWER, "criteria": {"made_up": 5}},
        {"score": 5}, {**GOOD_ANSWER, "flags": ["Not A Code"]}, "text",
    ],
)  # fmt: skip
def test_out_of_range_or_malformed_results_are_rejected_never_clamped(session, monkeypatch, bad):
    monkeypatch.setattr(ai_hooks, "evaluate_answer", lambda s, t: bad)
    with pytest.raises(AIInvalidOutput):
        runner.call("evaluate_answer", session, None, session=session)
    assert logs()[0][1:] == ("failed", 1, "invalid_output")


def test_a_crashing_hook_is_a_failed_call_not_a_500(session, monkeypatch):
    monkeypatch.setattr(ai_hooks, "evaluate_answer", raising(ValueError("secret answer text must not leak")))
    with pytest.raises(AIInvalidOutput):
        runner.call("evaluate_answer", session, None, session=session)
    assert "secret" not in str(logs())


def test_policy_blocked_is_logged_and_raised(session, monkeypatch):
    monkeypatch.setattr(ai_hooks, "evaluate_answer", raising(AIPolicyBlocked()))
    with pytest.raises(AIPolicyBlocked):
        runner.call("evaluate_answer", session, None, session=session)
    assert logs()[0][1] == "policy_blocked"


def test_the_session_report_schema_depends_on_the_kind(session, monkeypatch):
    monkeypatch.setattr(ai_hooks, "evaluate_session", lambda s, t: {"summary": "s", "strengths": [], "weaknesses": [], "per_question": []})
    assert runner.call("evaluate_session", session, [], session=session)["summary"] == "s"
    session.kind = "technical"  # technical also needs technical_relevance
    with pytest.raises(AIInvalidOutput):
        runner.call("evaluate_session", session, [], session=session)


# --- next_question: the bank is the safety net ------------------------------------------------------------------
def test_next_question_from_the_hook_is_used(session, monkeypatch):
    monkeypatch.setattr(ai_hooks, "next_question", lambda s, t, h: GOOD_QUESTION)
    question = runner.ask_next_question(session, [], {})
    assert question["question_text"] == GOOD_QUESTION["question_text"] and question["from_bank"] is False


@pytest.mark.parametrize("error", [AIPolicyBlocked(), AIInvalidOutput("x"), AIUnavailable(), AINotConnected()])
def test_a_hook_that_cannot_help_falls_back_to_the_bank(session, monkeypatch, error):
    monkeypatch.setattr(ai_hooks, "next_question", raising(error))
    question = runner.ask_next_question(session, [], {})
    assert question["from_bank"] is True and question["question_text"]


def test_a_repeated_question_is_asked_again_once_then_the_bank_is_used(session, monkeypatch):
    calls = []

    def repeating(s, t, h):
        calls.append(h)
        return GOOD_QUESTION

    monkeypatch.setattr(ai_hooks, "next_question", repeating)
    earlier = InterviewTurn(index=1, question_text="Tell us about your PYTHON work")
    question = runner.ask_next_question(session, [earlier], {})
    assert len(calls) == 2 and calls[1]["retry_reason"] == "duplicate"
    assert question["from_bank"] is True


def test_a_technical_question_must_mention_a_skill_of_the_job(session, monkeypatch):
    session.kind = "technical"
    off_topic = {**GOOD_QUESTION, "question_text": "What is your favourite colour?", "topic": "colours"}
    monkeypatch.setattr(ai_hooks, "next_question", lambda s, t, h: off_topic)
    assert runner.ask_next_question(session, [], {})["from_bank"] is True
    monkeypatch.setattr(ai_hooks, "next_question", lambda s, t, h: GOOD_QUESTION)
    assert runner.ask_next_question(session, [], {})["from_bank"] is False

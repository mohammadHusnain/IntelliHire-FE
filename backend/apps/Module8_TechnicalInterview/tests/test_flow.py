"""The technical interview through the public link: typed answers, difficulty, follow-ups, outages, the report (FR-48 to FR-51)."""
import itertools
from datetime import timedelta

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from apps.Module5_Foundation.models import ActivityEvent, Notification
from apps.Module7_Interviews import ai_hooks
from apps.Module7_Interviews.models import InterviewQuestionBank, InterviewSession
from apps.Module7_Interviews.services import evaluation
from apps.Module7_Interviews.signals import interview_evaluated

from .conftest import answer_turns

pytestmark = pytest.mark.django_db
BASE = "/api/public/interviews/"


def go(client, session, tail, body=None, fmt="json"):
    return client.post(f"{BASE}{session.raw_token}/{tail}", body or {}, format=fmt)


def answer(client, session, index, text="I would profile it first."):
    return go(client, session, "answer/", {"turn_index": index, "answer_text": text})


@pytest.fixture
def adaptive(monkeypatch):
    """A question hook that records its hints and honours `follow_up_of`; scores come from `scores[index]`."""
    state = type("S", (), {"hints": [], "scores": {}, "counter": itertools.count(1)})()

    def next_question(session, turns, hint):
        state.hints.append(dict(hint))
        follow = bool(hint.get("follow_up_of"))
        return {
            "question_text": f"Python question {next(state.counter)}: explain it?", "competency": "technical_accuracy",
            "topic": hint.get("focus_topic") or "python", "difficulty": "medium", "is_follow_up": follow,
        }  # fmt: skip

    def evaluate_answer(session, turn):
        score = state.scores.get(turn.index, 8.0)
        return {"score": score, "criteria": {"technical_accuracy": score}, "feedback": "ok", "flags": []}

    monkeypatch.setattr(ai_hooks, "next_question", next_question)
    monkeypatch.setattr(ai_hooks, "evaluate_answer", evaluate_answer)
    return state


class TestEvaluationAndReport:
    def finish(self, technical, application, hooks, score=8.0, **kwargs):
        hooks.install(question=False).score = score
        session = technical(application, status="completed", target=3, **kwargs)
        answer_turns(session, 3)
        return session

    def test_the_score_is_a_percentage_and_the_report_has_the_documented_shape(self, technical, application, hooks):
        hooks.install(question=False).score = lambda turn: [9, 7, 8][turn.index - 1]
        session = technical(application, status="completed", target=3)
        answer_turns(session, 3)
        assert evaluation.evaluate(session.pk) == "evaluated"
        session.refresh_from_db()
        assert float(session.overall_score) == 80.0
        assert session.recommendation is None  # no pass rule: the score feeds Module 9 and HR decides
        report = session.report
        assert set(report) >= {"summary", "technical_relevance", "strengths", "weaknesses", "questions", "rubric_averages"}
        assert report["technical_relevance"] == "adequate" and report["rubric_averages"] == {"technical_accuracy": 8.0}
        assert [(q["index"], q["score"], q["comment"]) for q in report["questions"]] == [(1, 9.0, "Fine"), (2, 7.0, "Fine"), (3, 8.0, "Fine")]
        assert "per_question" not in report and report["questions"][0]["question"] == "Question 1?"

    def test_the_hook_cannot_change_a_score_or_add_a_recommendation(self, technical, application, hooks, monkeypatch):
        hooks.install(question=False).score = 3.0
        monkeypatch.setattr(ai_hooks, "evaluate_session", lambda s, t: {"summary": "Great", "strengths": [], "weaknesses": [], "per_question": [{"index": 1, "comment": "x"}], "technical_relevance": "strong", "overall_score": 100, "recommendation": "advance"})
        session = technical(application, status="completed", target=3)
        answer_turns(session, 3)
        evaluation.evaluate(session.pk)
        session.refresh_from_db()
        assert float(session.overall_score) == 30.0 and session.recommendation is None
        assert "overall_score" not in session.report and "recommendation" not in session.report

    def test_without_the_report_hook_the_report_stays_empty_but_the_score_is_kept(self, technical, application, hooks, clients):
        hooks.install(question=False, report=False).score = 8.0
        session = technical(application, status="completed", target=3)
        answer_turns(session, 3)
        assert evaluation.evaluate(session.pk) == "evaluated"
        session.refresh_from_db()
        assert session.report == {} and float(session.overall_score) == 80.0
        from apps.common.choices import MemberRole

        body = clients[MemberRole.VIEWER].get(f"/api/interviews/{session.pk}/").json()
        assert body["report_message"] == "Report not available yet" and body["overall_score"] == 80.0

    def test_with_no_hook_at_all_nothing_happens(self, technical, application, clients):
        session = technical(application, status="completed", target=3)
        answer_turns(session, 3)
        assert evaluation.evaluate(session.pk) == "not_connected"
        session.refresh_from_db()
        assert session.status == "completed" and session.report == {}

    def test_module_9_can_listen_for_a_technical_evaluation(self, technical, application, hooks):
        seen = []
        handler = lambda sender, session, recommendation, **kw: seen.append((session.kind, recommendation))  # noqa: E731
        interview_evaluated.connect(handler)
        try:
            hooks.install(question=False).score = 9.0
            session = technical(application, status="completed", target=3)
            answer_turns(session, 3)
            evaluation.evaluate(session.pk)
        finally:
            interview_evaluated.disconnect(handler)
        assert seen == [("technical", None)]
        assert Notification.objects.filter(kind="interview_evaluated").exists()

    def test_an_overdue_technical_interview_tells_hr_it_was_not_completed(self, technical, application):
        from apps.Module7_Interviews.services import lifecycle

        technical(application, status="invited", expires_at=timezone.now() - timedelta(minutes=1))
        assert lifecycle.expire_due() == 1
        assert Notification.objects.filter(kind="interview_expired").first().title.startswith("Technical interview not completed")


class TestLiveTechnicalRound:
    """The technical round is a spoken call now: 6 minutes, deeper questions, no typed path."""

    def test_it_is_a_live_call_of_six_minutes(self):
        from apps.Module7_Interviews.live.prompts import live_seconds
        from apps.Module7_Interviews.services.kinds import rules_for

        rules = rules_for("technical")
        assert rules.live is True
        assert live_seconds(rules) == 360
        assert 5 * 60 <= live_seconds(rules) <= 7 * 60, "the brief asks for 5 to 7 minutes"

    def test_voice_is_how_it_is_answered_now(self):
        from apps.Module7_Interviews.services.kinds import rules_for

        assert rules_for("technical").allow_voice is True

    def test_the_prompt_asks_for_depth_follow_ups_and_spoken_answers(self, technical, application):
        from apps.Module7_Interviews.live.prompts import build_system_prompt
        from apps.Module7_Interviews.services.kinds import rules_for

        session = technical(application)
        text = build_system_prompt(session, rules_for("technical"))
        assert "technical round" in text
        assert "one follow-up" in text
        assert "never ask the candidate to write or paste code" in text.replace('"', "")
        assert "about 6 minutes" in text

    def test_the_prompt_differs_from_the_screening_one(self, technical, application):
        from apps.Module7_Interviews.live.prompts import build_system_prompt
        from apps.Module7_Interviews.services.kinds import rules_for

        session = technical(application)
        technical_text = build_system_prompt(session, rules_for("technical"))
        screening_text = build_system_prompt(session, rules_for("screening"))
        assert technical_text != screening_text
        assert "short screening call" not in technical_text

    def test_the_typed_path_is_refused_so_there_is_only_one_way_in(self, api_client, technical, application):
        session = technical(application)
        for tail, body in (("start/", None), ("answer/", {"turn_index": 1, "answer_text": "hi"})):
            response = api_client.post(f"/api/public/interviews/{session.raw_token}/{tail}", body, format="json")
            assert response.status_code == 409
            assert response.data["code"] == "use_live_channel"

    def test_a_finished_call_stores_its_transcript_as_voice_turns(self, technical, application, monkeypatch):
        from apps.Module7_Interviews.live.session import begin_live, finish_live

        monkeypatch.setattr("apps.Module7_Interviews.services.evaluation.queue_evaluation", lambda pk, **kw: None)
        session = technical(application)
        begin_live(session)
        finish_live(session, [
            {"role": "interviewer", "text": "How would you keep that API fast under load?"},
            {"role": "candidate", "text": "Cache the hot reads and page the rest."},
            {"role": "interviewer", "text": "What would you measure to prove it worked?"},
            {"role": "candidate", "text": "p95 latency and the cache hit rate."},
        ], "time_up")

        session.refresh_from_db()
        assert session.status == "completed"
        assert [t.answer_source for t in session.turns.all()] == ["voice", "voice"]
        assert session.turns.count() == 2

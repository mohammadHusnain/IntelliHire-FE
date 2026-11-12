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


class TestQuestions:
    def test_the_first_questions_come_from_the_technical_bank_for_the_jobs_skills(self, api_client, technical, application):
        session = technical(application)
        first = go(api_client, session, "start/").json()["turn"]
        turn = session.turns.get()
        bank = InterviewQuestionBank.objects.get(pk=turn.question_meta["bank_id"])
        assert bank.kind == "technical" and set(bank.skills) & {"Python", "Django"}
        assert turn.question_meta["topic"] in ("Python", "Django") and first["is_follow_up"] is False
        assert turn.question_meta["difficulty"] == "medium"  # a mid-level job prefers medium

    @pytest.mark.parametrize("band, difficulty", [("junior", "easy"), ("mid", "medium"), ("senior", "hard")])
    def test_difficulty_follows_the_seniority_band(self, api_client, technical, application, adaptive, band, difficulty):
        session = technical(application, context={"required_skills": ["Python"], "seniority_band": band, "competencies_to_cover": ["Python"]})
        go(api_client, session, "start/")
        assert adaptive.hints[0]["difficulty"] == difficulty and adaptive.hints[0]["seniority_band"] == band

    def test_each_required_skill_is_covered_in_turn(self, api_client, technical, application, adaptive):
        session = technical(application, target=3)
        go(api_client, session, "start/")
        answer(api_client, session, 1)
        answer(api_client, session, 2)
        assert [h.get("focus_topic") for h in adaptive.hints] == ["Python", "Django", None]
        assert adaptive.hints[2]["competencies_to_cover"] == []

    def test_a_pasted_code_answer_is_stored_as_text(self, api_client, technical, application, adaptive):
        session = technical(application)
        go(api_client, session, "start/")
        code = "def f(x):\n    return [i * 2 for i in x]\n"
        assert answer(api_client, session, 1, code).status_code == 200
        assert session.turns.get(index=1).answer_text == code.strip()

    def test_audio_is_400_for_the_technical_interview(self, api_client, technical, application):
        session = technical(application)
        go(api_client, session, "start/")
        audio = SimpleUploadedFile("a.webm", b"x" * 50, content_type="audio/webm")
        response = api_client.post(f"{BASE}{session.raw_token}/answer/", {"turn_index": 1, "audio": audio}, format="multipart")
        assert response.status_code == 400 and response.json()["code"] == "voice_not_allowed"
        assert session.turns.get(index=1).answered_at is None

    def test_the_summary_says_voice_is_not_available_for_a_technical_interview(self, api_client, technical, application):
        session = technical(application)
        body = api_client.get(f"{BASE}{session.raw_token}/").json()
        assert body["kind"] == "technical" and body["question_count"] == 4 and "Answer each question" in body["instructions"]


class TestFollowUps:
    def test_a_weak_answer_earns_one_follow_up_marked_in_the_response(self, api_client, technical, application, adaptive):
        adaptive.scores = {1: 3.0}
        session = technical(application, target=4)
        go(api_client, session, "start/")
        nxt = answer(api_client, session, 1).json()["turn"]
        assert adaptive.hints[1]["follow_up_of"] == 1 and nxt["is_follow_up"] is True
        meta = session.turns.get(index=2).question_meta
        assert meta["is_follow_up"] is True and meta["follow_up_of"] == 1

    def test_a_follow_up_counts_towards_the_target(self, api_client, technical, application, adaptive):
        adaptive.scores = {1: 3.0}
        session = technical(application, target=3)
        go(api_client, session, "start/")
        answer(api_client, session, 1)
        answer(api_client, session, 2)
        done = answer(api_client, session, 3).json()
        assert done["done"] is True and session.turns.count() == 3

    def test_a_score_of_four_or_more_earns_no_follow_up(self, api_client, technical, application, adaptive):
        adaptive.scores = {1: 4.0}
        session = technical(application)
        go(api_client, session, "start/")
        answer(api_client, session, 1)
        assert "follow_up_of" not in adaptive.hints[1]

    def test_only_one_follow_up_per_topic_then_move_on(self, api_client, technical, application, adaptive):
        adaptive.scores = {1: 2.0, 2: 2.0}  # both the first answer and its follow-up are weak
        session = technical(application, target=5)
        go(api_client, session, "start/")
        answer(api_client, session, 1)
        answer(api_client, session, 2)
        assert adaptive.hints[1]["follow_up_of"] == 1
        assert "follow_up_of" not in adaptive.hints[2] and adaptive.hints[2]["focus_topic"] == "Django"

    def test_at_most_two_follow_ups_in_an_interview(self, api_client, technical, application, adaptive):
        adaptive.scores = {1: 2.0, 3: 2.0, 5: 2.0}  # three weak base answers (the follow-ups sit at 2 and 4)
        session = technical(application, target=8, context={"required_skills": ["Python", "Django", "React"], "seniority_band": "mid", "competencies_to_cover": ["Python", "Django", "React"]})
        go(api_client, session, "start/")
        for index in range(1, 7):
            answer(api_client, session, index)
        asked = [h.get("follow_up_of") for h in adaptive.hints]
        assert sum(1 for a in asked if a) == 2

    def test_the_rule_never_fires_while_nothing_scores(self, api_client, technical, application, monkeypatch):
        hints = []
        monkeypatch.setattr(ai_hooks, "next_question", lambda s, t, h: (hints.append(h), {"question_text": f"Python q{len(hints)}?", "competency": "x", "topic": "python", "difficulty": "easy", "is_follow_up": False})[1])
        session = technical(application)
        go(api_client, session, "start/")
        for index in (1, 2, 3):
            answer(api_client, session, index)
        assert not any("follow_up_of" in h for h in hints)


class TestOutage:
    @pytest.fixture
    def down(self, monkeypatch):
        monkeypatch.setattr(ai_hooks, "next_question", lambda s, t, h: (_ for _ in ()).throw(ai_hooks.AIUnavailable()))

    def test_starting_while_the_service_is_down_is_503_with_retry_after_120_and_no_bank_question(self, api_client, technical, application, down):
        session = technical(application)
        response = go(api_client, session, "start/")
        assert response.status_code == 503 and response.json()["code"] == "ai_unavailable" and response["Retry-After"] == "120"
        session.refresh_from_db()
        assert session.status == "invited" and not session.turns.exists()

    def test_after_two_minutes_of_failure_the_session_is_interrupted_and_the_failure_is_logged(self, api_client, technical, application, monkeypatch):
        session = technical(application)
        go(api_client, session, "start/")  # the first question works
        InterviewSession.objects.filter(pk=session.pk).update(status="in_progress")
        monkeypatch.setattr(ai_hooks, "next_question", lambda s, t, h: (_ for _ in ()).throw(ai_hooks.AIUnavailable()))
        first = answer(api_client, session, 1)
        assert first.status_code == 503 and first["Retry-After"] == "120"
        session.refresh_from_db()
        assert session.status == "in_progress" and session.ai_failing_since is not None  # not yet two minutes
        assert session.turns.get(index=1).answer_text  # the answer is saved
        InterviewSession.objects.filter(pk=session.pk).update(ai_failing_since=timezone.now() - timedelta(minutes=3))
        assert answer(api_client, session, 1).status_code == 503
        session.refresh_from_db()
        assert session.status == "interrupted"
        assert ActivityEvent.objects.filter(event_type="ai.provider_failure", target_id=session.pk).count() == 1

    def test_resuming_after_recovery_continues_on_the_same_link_and_clears_the_clock(self, api_client, technical, application, adaptive):
        session = technical(application)
        go(api_client, session, "start/")
        answer(api_client, session, 1)
        InterviewSession.objects.filter(pk=session.pk).update(status="interrupted", ai_failing_since=timezone.now() - timedelta(minutes=5))
        resumed = go(api_client, session, "start/")
        assert resumed.status_code == 200
        session.refresh_from_db()
        assert session.status == "in_progress" and session.ai_failing_since is None

    def test_a_successful_call_clears_the_failure_clock(self, api_client, technical, application, adaptive):
        session = technical(application)
        InterviewSession.objects.filter(pk=session.pk).update(ai_failing_since=timezone.now() - timedelta(seconds=30))
        go(api_client, session, "start/")
        session.refresh_from_db()
        assert session.ai_failing_since is None

    @pytest.mark.parametrize("error", [ai_hooks.AIPolicyBlocked(), ai_hooks.AIInvalidOutput("bad")])
    def test_blocked_or_invalid_output_still_falls_back_to_the_bank(self, api_client, technical, application, monkeypatch, error):
        monkeypatch.setattr(ai_hooks, "next_question", lambda s, t, h: (_ for _ in ()).throw(error))
        session = technical(application)
        assert go(api_client, session, "start/").status_code == 200
        assert session.turns.get().question_meta["from_bank"] is True

    def test_a_screening_interview_keeps_falling_back_to_the_bank_on_an_outage(self, api_client, session_factory, application, monkeypatch):
        monkeypatch.setattr(ai_hooks, "next_question", lambda s, t, h: (_ for _ in ()).throw(ai_hooks.AIUnavailable()))
        session = session_factory(application, kind="screening")
        assert go(api_client, session, "start/").status_code == 200


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

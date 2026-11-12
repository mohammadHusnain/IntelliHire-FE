"""Evaluating a finished interview (FR-44 to FR-46): numbers from code, words from the hook, the guard decides."""
import threading
from datetime import timedelta

import pytest
from django.db import connection
from django.utils import timezone

from apps.Module5_Foundation.models import ActivityEvent, AIRequestLog, Notification

from .. import ai_hooks
from ..models import InterviewSession, InterviewTurn
from ..services import evaluation
from ..signals import interview_evaluated
from .conftest import answer_turns

pytestmark = pytest.mark.django_db


def finished(session_factory, application, scores=None, status="completed", target=3, **kwargs):
    session = session_factory(application, status=status, target=target, **kwargs)
    answer_turns(session, target)
    for turn, score in zip(session.turns.order_by("index"), scores or []):
        if score is not None:
            InterviewTurn.objects.filter(pk=turn.pk).update(score=score, evaluation={"score": score, "criteria": {"role_alignment": score}, "feedback": "", "flags": []})
    return session


def by_index(*scores):
    return lambda turn: scores[turn.index - 1]


class TestWithoutHooks:
    def test_nothing_happens_and_the_session_stays_completed(self, session_factory, application):
        session = finished(session_factory, application)
        assert evaluation.evaluate(session.pk) == "not_connected"
        session.refresh_from_db()
        assert session.status == "completed" and session.overall_score is None and session.recommendation is None and session.report == {}
        assert session.evaluation_attempts == 0 and session.evaluation_claimed_at is None
        assert session.next_evaluation_at > timezone.now() + timedelta(hours=5)
        assert not AIRequestLog.objects.exists()  # "not connected" is not a failure and is not logged

    def test_an_incomplete_session_goes_back_to_incomplete(self, session_factory, application):
        session = finished(session_factory, application, status="incomplete")
        evaluation.evaluate(session.pk)
        session.refresh_from_db()
        assert session.status == "incomplete"

    def test_a_session_that_is_not_finished_is_left_alone(self, session_factory, application):
        session = finished(session_factory, application, status="in_progress")
        assert evaluation.evaluate(session.pk) == "skipped"
        session.refresh_from_db()
        assert session.status == "in_progress"


class TestWithHooks:
    def test_numbers_and_recommendation_are_computed_in_code(self, session_factory, application, hooks):
        hooks.install().score = by_index(9, 7, 8)
        session = finished(session_factory, application)
        assert evaluation.evaluate(session.pk) == "evaluated"
        session.refresh_from_db()
        assert (session.status, float(session.overall_score), session.recommendation) == ("evaluated", 80.0, "advance")
        assert session.report["rubric_averages"] == {"role_alignment": 8.0} and session.report["scored_answers"] == 3
        assert [(p["index"], p["score"], p["comment"]) for p in session.report["per_question"]] == [(1, 9.0, "Fine"), (2, 7.0, "Fine"), (3, 8.0, "Fine")]
        assert session.report["summary"] == "A solid candidate." and session.evaluation_claimed_at is None and session.next_evaluation_at is None

    @pytest.mark.parametrize("score, expected", [(7.5, "advance"), (6.0, "advance"), (5.9, "hold"), (4.5, "hold"), (4.4, "not_recommended"), (4.0, "not_recommended")])
    def test_tc30_the_guard(self, session_factory, application, hooks, score, expected):
        hooks.install().score = score
        session = finished(session_factory, application)
        evaluation.evaluate(session.pk)
        session.refresh_from_db()
        assert session.recommendation == expected

    def test_the_minimum_comes_from_the_ai_settings(self, session_factory, application, hooks):
        from apps.Module5_Foundation.ai.config import clear_config_cache
        from apps.Module5_Foundation.models import AISettings

        AISettings.objects.update_or_create(pk=1, defaults={"screening_min_score": 80})
        clear_config_cache()
        hooks.install().score = 7.0
        session = finished(session_factory, application)
        evaluation.evaluate(session.pk)
        session.refresh_from_db()
        assert session.recommendation == "hold"

    def test_a_hook_can_add_words_but_never_change_a_number_or_the_recommendation(self, session_factory, application, hooks, monkeypatch):
        hooks.install().score = 3.0
        monkeypatch.setattr(
            ai_hooks, "evaluate_session",
            lambda s, t: {"summary": "Perfect!", "strengths": [], "weaknesses": [], "per_question": [], "recommendation": "advance", "overall_score": 100, "rubric_averages": {"role_alignment": 10}, "scored_answers": 99},
        )  # fmt: skip
        session = finished(session_factory, application)
        evaluation.evaluate(session.pk)
        session.refresh_from_db()
        assert session.recommendation == "not_recommended" and float(session.overall_score) == 30.0
        assert session.report["rubric_averages"] == {"role_alignment": 3.0} and session.report["scored_answers"] == 3
        assert "recommendation" not in session.report and "overall_score" not in session.report

    def test_answers_saved_while_the_hook_was_down_are_scored_now_and_scored_ones_are_not_repeated(self, session_factory, application, hooks):
        hooks.install().score = 6.0
        session = finished(session_factory, application, scores=[9, None, None])
        evaluation.evaluate(session.pk)
        scored = [call[1] for call in hooks.calls if call[0] == "evaluate_answer"]
        assert scored == [2, 3]
        session.refresh_from_db()
        assert [float(t.score) for t in session.turns.order_by("index")] == [9.0, 6.0, 6.0]

    def test_reevaluating_scores_every_answer_again(self, session_factory, application, hooks):
        hooks.install().score = 6.0
        session = finished(session_factory, application, scores=[9, 9, 9])
        evaluation.evaluate(session.pk, rescore=True)
        assert [float(t.score) for t in session.turns.order_by("index")] == [6.0, 6.0, 6.0]

    def test_a_rescore_that_cannot_run_keeps_the_earlier_scores(self, session_factory, application, hooks):
        hooks.install(answer=False)  # only the report hook is connected
        session = finished(session_factory, application, scores=[9, 8, 7])
        assert evaluation.evaluate(session.pk, rescore=True) == "evaluated"
        session.refresh_from_db()
        assert float(session.overall_score) == 80.0

    def test_scores_without_a_report_hook_still_finish_with_numbers_only(self, session_factory, application, hooks):
        hooks.install(report=False).score = 8.0
        session = finished(session_factory, application)
        assert evaluation.evaluate(session.pk) == "evaluated"
        session.refresh_from_db()
        assert float(session.overall_score) == 80.0 and session.report["summary"] == ""

    def test_a_failed_answer_does_not_block_the_rest(self, session_factory, application, hooks):
        def flaky(turn):
            if turn.index == 2:
                raise ai_hooks.AIUnavailable()
            return 8.0

        hooks.install().score = flaky
        session = finished(session_factory, application)
        assert evaluation.evaluate(session.pk) == "evaluated"
        session.refresh_from_db()
        assert session.report["scored_answers"] == 2 and session.report["total_answers"] == 3 and float(session.overall_score) == 80.0

    def test_the_mock_kind_has_no_application_and_gets_no_recommendation(self, hooks, user_factory):
        hooks.install().score = 9.0
        session = InterviewSession.objects.create(
            kind="mock", application=None, candidate_user=user_factory(), token_hash="m" * 64, status="completed",
            role_title="Data Analyst", question_target=3, expires_at=timezone.now() + timedelta(days=1),
        )  # fmt: skip
        answer_turns(session, 3)
        assert evaluation.evaluate(session.pk) == "evaluated"
        session.refresh_from_db()
        assert float(session.overall_score) == 90.0 and session.recommendation is None


class TestAfterEvaluation:
    def test_events_notifications_and_the_signal(self, session_factory, application, hooks, team):
        hooks.install().score = 9.0
        seen = []
        handler = lambda sender, session, recommendation, **kw: seen.append((session.pk, recommendation))  # noqa: E731
        interview_evaluated.connect(handler)
        try:
            session = finished(session_factory, application)
            evaluation.evaluate(session.pk)
        finally:
            interview_evaluated.disconnect(handler)
        assert seen == [(session.pk, "advance")]
        event = ActivityEvent.objects.get(event_type="interview.evaluated")
        assert event.metadata == {"kind": "screening", "recommendation": "advance", "overall_score": 90.0}
        notification = Notification.objects.filter(kind="interview_evaluated").first()
        assert notification.link == f"/company/candidates/{application.pk}" and "advance" in notification.body
        assert Notification.objects.filter(kind="interview_evaluated").count() == 3
        application.refresh_from_db()
        assert application.status == "shortlisted"  # nothing is decided automatically (P2-1)

    @pytest.mark.parametrize("score, word", [(5.0, "hold"), (2.0, "not recommended")])
    def test_hold_and_not_recommended_notify_hr_with_the_transcript_link(self, session_factory, application, hooks, score, word):
        hooks.install().score = score
        session = finished(session_factory, application)
        evaluation.evaluate(session.pk)
        notification = Notification.objects.filter(kind="interview_evaluated").first()
        assert word in notification.body and notification.link.endswith(str(application.pk))
        assert not Notification.objects.filter(kind="interview_invited").exists()  # the candidate is told nothing

    def test_a_listener_that_breaks_cannot_undo_the_evaluation(self, session_factory, application, hooks):
        hooks.install().score = 9.0

        def broken(sender, session, recommendation, **kw):
            raise RuntimeError("listener bug")

        interview_evaluated.connect(broken)
        try:
            session = finished(session_factory, application)
            assert evaluation.evaluate(session.pk) == "evaluated"
        finally:
            interview_evaluated.disconnect(broken)


class TestFailures:
    def failing(self, hooks, monkeypatch, which="session"):
        hooks.install(question=False, answer=which != "answer").score = 8.0
        monkeypatch.setattr(ai_hooks, "evaluate_session" if which == "session" else "evaluate_answer", self.boom)

    @staticmethod
    def boom(*args):
        raise ai_hooks.AIUnavailable()

    def test_a_failing_report_hook_marks_the_evaluation_failed_and_tells_hr(self, session_factory, application, hooks, monkeypatch):
        self.failing(hooks, monkeypatch)
        session = finished(session_factory, application)
        assert evaluation.evaluate(session.pk) == "failed"
        session.refresh_from_db()
        assert session.status == "evaluation_failed" and session.evaluation_attempts == 1 and session.overall_score is None
        assert session.next_evaluation_at > timezone.now() + timedelta(minutes=4)
        assert Notification.objects.filter(kind="interview_evaluation_failed").count() == 3

    def test_it_is_retried_up_to_three_times_then_stops_and_hr_hears_at_the_start_and_the_end(self, session_factory, application, hooks, monkeypatch):
        self.failing(hooks, monkeypatch)
        session = finished(session_factory, application)
        for attempt in (1, 2, 3):
            assert evaluation.evaluate(session.pk) == "failed"
            session.refresh_from_db()
            assert session.evaluation_attempts == attempt
        assert session.status == "evaluation_failed" and session.next_evaluation_at is None
        assert Notification.objects.filter(kind="interview_evaluation_failed").count() == 6  # attempt 1 and attempt 3, 3 recipients each

    def test_a_retry_that_works_finishes_the_job(self, session_factory, application, hooks, monkeypatch):
        self.failing(hooks, monkeypatch)
        session = finished(session_factory, application)
        evaluation.evaluate(session.pk)
        hooks.install()
        assert evaluation.evaluate(session.pk) == "evaluated"
        session.refresh_from_db()
        assert session.status == "evaluated" and session.evaluation_attempts == 2

    def test_every_answer_failing_to_score_is_a_failure_even_if_the_report_works(self, session_factory, application, hooks, monkeypatch):
        self.failing(hooks, monkeypatch, which="answer")
        session = finished(session_factory, application)
        assert evaluation.evaluate(session.pk) == "failed"

    def test_a_crashing_hook_is_a_failure_not_an_exception(self, session_factory, application, hooks, monkeypatch):
        hooks.install(question=False)
        monkeypatch.setattr(ai_hooks, "evaluate_session", lambda s, t: 1 / 0)
        session = finished(session_factory, application)
        assert evaluation.evaluate(session.pk) == "failed"


class TestIdempotence:
    def test_evaluating_twice_runs_the_hooks_once(self, session_factory, application, hooks):
        hooks.install().score = 8.0
        session = finished(session_factory, application)
        assert evaluation.evaluate(session.pk) == "evaluated"
        calls = len(hooks.calls)
        assert evaluation.evaluate(session.pk) == "skipped"
        assert len(hooks.calls) == calls

    def test_an_unknown_session_is_skipped(self):
        import uuid

        assert evaluation.evaluate(uuid.uuid4()) == "skipped"


@pytest.mark.django_db(transaction=True)
def test_two_workers_evaluating_at_once_run_the_hooks_once(session_factory, application, hooks, ensure_bank):
    hooks.install().score = 8.0
    session = finished(session_factory, application)
    barrier, results = threading.Barrier(2), []

    def worker():
        try:
            barrier.wait(timeout=10)
            results.append(evaluation.evaluate(session.pk))
        finally:
            connection.close()

    threads = [threading.Thread(target=worker) for _ in range(2)]
    [t.start() for t in threads]
    [t.join(timeout=30) for t in threads]
    assert sorted(results) == ["evaluated", "skipped"], results
    assert len([c for c in hooks.calls if c[0] == "evaluate_session"]) == 1
    assert InterviewSession.objects.get(pk=session.pk).status == "evaluated"

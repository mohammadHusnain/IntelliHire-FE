"""The scheduled work: idle sessions, expiring links, stuck and due evaluations (UC-08 A1, A2; UC-03 A1)."""
from datetime import timedelta

import pytest
from django.utils import timezone

from apps.Module5_Foundation.models import ActivityEvent, Notification

from .. import tasks
from ..models import InterviewSession
from ..services import evaluation, lifecycle
from .conftest import answer_turns

pytestmark = pytest.mark.django_db
BASE = "/api/public/interviews/"


def minutes_ago(n):
    return timezone.now() - timedelta(minutes=n)


class TestIdle:
    def test_a_quiet_in_progress_session_becomes_interrupted(self, session_factory, application):
        quiet = session_factory(application, status="in_progress", last_activity_at=minutes_ago(31))
        assert lifecycle.interrupt_idle() == 1
        quiet.refresh_from_db()
        assert quiet.status == "interrupted"

    def test_an_active_session_and_other_statuses_are_left_alone(self, session_factory, application_factory, job):
        active = session_factory(application_factory(job), status="in_progress", last_activity_at=minutes_ago(29))
        invited = session_factory(application_factory(job), status="invited", last_activity_at=minutes_ago(300))
        assert lifecycle.interrupt_idle() == 0
        assert [InterviewSession.objects.get(pk=s.pk).status for s in (active, invited)] == ["in_progress", "invited"]

    def test_a_session_that_never_recorded_activity_uses_its_start_time(self, session_factory, application):
        session = session_factory(application, status="in_progress", last_activity_at=None, started_at=minutes_ago(45))
        assert lifecycle.interrupt_idle() == 1
        session.refresh_from_db()
        assert session.status == "interrupted"

    def test_the_same_link_resumes_an_interrupted_session_at_the_unanswered_question(self, api_client, session):
        first = api_client.post(f"{BASE}{session.raw_token}/start/").json()
        InterviewSession.objects.filter(pk=session.pk).update(last_activity_at=minutes_ago(40))
        lifecycle.interrupt_idle()
        assert api_client.get(f"{BASE}{session.raw_token}/").json()["status"] == "interrupted"
        resumed = api_client.post(f"{BASE}{session.raw_token}/start/").json()
        assert resumed["turn"] == first["turn"]
        assert InterviewSession.objects.get(pk=session.pk).status == "in_progress"

    def test_answering_after_the_break_resumes_too(self, api_client, session):
        api_client.post(f"{BASE}{session.raw_token}/start/")
        InterviewSession.objects.filter(pk=session.pk).update(status="interrupted")
        response = api_client.post(f"{BASE}{session.raw_token}/answer/", {"turn_index": 1, "answer_text": "back again"}, format="json")
        assert response.status_code == 200
        assert InterviewSession.objects.get(pk=session.pk).status == "in_progress"


class TestExpiry:
    def test_overdue_invited_and_interrupted_sessions_expire_and_hr_is_told_once(self, session_factory, application_factory, job):
        invited = session_factory(application_factory(job), status="invited", expires_at=minutes_ago(1))
        interrupted = session_factory(application_factory(job), status="interrupted", expires_at=minutes_ago(1), started_at=minutes_ago(90))
        assert lifecycle.expire_due() == 2
        assert lifecycle.expire_due() == 0  # a second run finds nothing
        assert {InterviewSession.objects.get(pk=s.pk).status for s in (invited, interrupted)} == {"expired"}
        notification = Notification.objects.filter(kind="interview_expired").first()
        assert notification.title.startswith("Screening not completed") and notification.link.startswith("/company/candidates/")
        assert Notification.objects.filter(kind="interview_expired").count() == 6  # 2 sessions x 3 recipients
        assert ActivityEvent.objects.filter(event_type="interview.expired").count() == 2

    def test_sessions_still_in_time_or_in_progress_or_finished_are_not_expired(self, session_factory, application_factory, job):
        sessions = [
            session_factory(application_factory(job), status="invited", expires_at=timezone.now() + timedelta(hours=1)),
            session_factory(application_factory(job), status="in_progress", expires_at=minutes_ago(1)),
            session_factory(application_factory(job), status="completed", expires_at=minutes_ago(1)),
        ]
        assert lifecycle.expire_due() == 0
        assert [InterviewSession.objects.get(pk=s.pk).status for s in sessions] == ["invited", "in_progress", "completed"]

    def test_an_expired_link_stops_working_for_the_candidate(self, api_client, session):
        InterviewSession.objects.filter(pk=session.pk).update(expires_at=minutes_ago(1))
        lifecycle.expire_due()
        assert api_client.get(f"{BASE}{session.raw_token}/").status_code == 410


class TestEvaluationSweep:
    def test_a_stuck_evaluation_is_freed_and_run_again(self, session_factory, application, hooks, django_capture_on_commit_callbacks):
        hooks.install().score = 8.0
        session = session_factory(application, status="evaluating", evaluation_claimed_at=minutes_ago(20), evaluation_attempts=1)
        answer_turns(session, 3)
        with django_capture_on_commit_callbacks(execute=True):
            reset, queued = evaluation.sweep()
        assert (reset, queued) == (1, 1)
        session.refresh_from_db()
        assert session.status == "evaluated"

    def test_a_recent_claim_is_left_alone(self, session_factory, application):
        session = session_factory(application, status="evaluating", evaluation_claimed_at=minutes_ago(2))
        assert evaluation.sweep() == (0, 0)
        session.refresh_from_db()
        assert session.status == "evaluating"

    def test_only_due_evaluations_are_queued(self, session_factory, application_factory, job, hooks, django_capture_on_commit_callbacks):
        hooks.install().score = 8.0
        due = session_factory(application_factory(job), status="completed", next_evaluation_at=minutes_ago(1))
        later = session_factory(application_factory(job), status="completed", next_evaluation_at=timezone.now() + timedelta(hours=1))
        exhausted = session_factory(application_factory(job), status="evaluation_failed", next_evaluation_at=None, evaluation_attempts=3)
        for s in (due, later, exhausted):
            answer_turns(s, 3)
        with django_capture_on_commit_callbacks(execute=True):
            assert evaluation.sweep() == (0, 1)
        assert [InterviewSession.objects.get(pk=s.pk).status for s in (due, later, exhausted)] == ["evaluated", "completed", "evaluation_failed"]

    def test_interviews_parked_before_the_hooks_existed_are_picked_up_once_they_are_merged(self, session_factory, application, hooks, django_capture_on_commit_callbacks):
        session = session_factory(application, status="completed", next_evaluation_at=minutes_ago(1))
        answer_turns(session, 3)
        with django_capture_on_commit_callbacks(execute=True):
            evaluation.sweep()
        session.refresh_from_db()
        assert session.status == "completed" and session.next_evaluation_at > timezone.now()  # parked again, nothing lost
        hooks.install().score = 8.0
        InterviewSession.objects.filter(pk=session.pk).update(next_evaluation_at=minutes_ago(1))
        with django_capture_on_commit_callbacks(execute=True):
            evaluation.sweep()
        session.refresh_from_db()
        assert session.status == "evaluated"

    def test_a_dead_broker_never_fails_the_caller(self, session_factory, application, monkeypatch, django_capture_on_commit_callbacks):
        def dead(*args, **kwargs):
            raise ConnectionError("broker down")

        monkeypatch.setattr(tasks.evaluate_session, "delay", dead)
        session = session_factory(application, status="completed", next_evaluation_at=minutes_ago(1))
        with django_capture_on_commit_callbacks(execute=True):
            assert evaluation.sweep() == (0, 1)
        session.refresh_from_db()
        assert session.status == "completed" and session.next_evaluation_at <= timezone.now()  # still due: the next sweep retries


class TestTask:
    def test_the_scheduled_task_does_all_three_jobs(self, session_factory, application_factory, job):
        idle = session_factory(application_factory(job), status="in_progress", last_activity_at=minutes_ago(40))
        overdue = session_factory(application_factory(job), status="invited", expires_at=minutes_ago(1))
        result = tasks.sweep()
        assert result["interrupted"] == 1 and result["expired"] == 1 and result["evaluations"] == (0, 0)
        assert [InterviewSession.objects.get(pk=s.pk).status for s in (idle, overdue)] == ["interrupted", "expired"]

    def test_it_is_registered_to_run_every_five_minutes(self, settings):
        entry = settings.CELERY_BEAT_SCHEDULE["interviews-sweep"]
        assert entry == {"task": "interviews.sweep", "schedule": 300.0}

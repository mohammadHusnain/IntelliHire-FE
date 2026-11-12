"""Running a mock interview on the shared engine, ending it, feedback and delete (FR-10 to FR-14, UC-02, UC-03)."""
from datetime import timedelta

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from apps.Module5_Foundation.models import ActivityEvent
from apps.Module7_Interviews import ai_hooks
from apps.Module7_Interviews.models import InterviewQuestionBank, InterviewSession, InterviewTurn
from apps.Module7_Interviews.services import evaluation, lifecycle

from ..models import MockInterviewSession
from .conftest import create, play

pytestmark = pytest.mark.django_db
URL = "/api/mock-interviews/"


def one(me, **body):
    return create(me, question_count=8, **body).json()["id"]


class TestRunning:
    def test_start_gives_a_bank_question_and_the_session_begins(self, me):
        session_id = one(me)
        body = me.post(f"{URL}{session_id}/start/").json()
        assert body["done"] is False and body["turn"]["index"] == 1 and body["turn"]["question_text"] and body["question_count"] == 8
        session = InterviewSession.objects.get(pk=session_id)
        assert session.status == "in_progress" and session.turns.get().question_meta["from_bank"] is True

    def test_role_specific_questions_come_from_that_roles_bank_first(self, me, role):
        session_id = create(me, interview_type="role_specific", role_id=str(role.pk)).json()["id"]
        me.post(f"{URL}{session_id}/start/")
        text = InterviewSession.objects.get(pk=session_id).turns.get().question_text
        assert InterviewQuestionBank.objects.get(kind="mock", text=text).role_category in ("software_engineer", "")

    def test_a_refresh_returns_the_current_unanswered_question(self, me):
        session_id = one(me)
        first = me.post(f"{URL}{session_id}/start/").json()
        again = me.post(f"{URL}{session_id}/start/").json()
        detail = me.get(f"{URL}{session_id}/").json()
        assert again["turn"]["question_text"] == first["turn"]["question_text"] == detail["current_turn"]["question_text"] and detail["report"] is None

    def test_answering_runs_to_done_and_every_answer_is_stored_with_its_owner(self, me, candidate):
        session_id = one(me)
        last = play(me, session_id, 8)
        assert last["done"] is True and last["answered_count"] == 8
        session = InterviewSession.objects.get(pk=session_id)
        assert session.status == "completed" and session.completed_at
        turns = list(session.turns.order_by("index"))
        assert len(turns) == 8 and all(t.answer_text and t.answered_at and t.answer_source == "typed" for t in turns) and session.candidate_user == candidate

    def test_answering_twice_returns_the_stored_result(self, me):
        session_id = one(me)
        me.post(f"{URL}{session_id}/start/")
        first = me.post(f"{URL}{session_id}/answer/", {"turn_index": 1, "answer_text": "first"}, format="json").json()
        second = me.post(f"{URL}{session_id}/answer/", {"turn_index": 1, "answer_text": "second"}, format="json").json()
        assert first == second and InterviewSession.objects.get(pk=session_id).turns.get(index=1).answer_text == "first"

    @pytest.mark.parametrize("body", [{"turn_index": 1, "answer_text": ""}, {"turn_index": 1, "answer_text": "x" * 3001}, {"turn_index": 1}])
    def test_bad_answers_are_400(self, me, body):
        session_id = one(me)
        me.post(f"{URL}{session_id}/start/")
        assert me.post(f"{URL}{session_id}/answer/", body, format="json").status_code == 400

    def test_the_wrong_question_is_409_and_answering_before_starting_is_409(self, me):
        session_id = one(me)
        assert me.post(f"{URL}{session_id}/answer/", {"turn_index": 1, "answer_text": "x"}, format="json").status_code == 409
        me.post(f"{URL}{session_id}/start/")
        assert me.post(f"{URL}{session_id}/answer/", {"turn_index": 5, "answer_text": "x"}, format="json").json()["code"] == "wrong_turn"

    def test_voice_is_422_until_transcription_is_connected(self, me):
        session_id = one(me)
        me.post(f"{URL}{session_id}/start/")
        audio = SimpleUploadedFile("a.webm", b"x" * 50, content_type="audio/webm")
        response = me.post(f"{URL}{session_id}/answer/", {"turn_index": 1, "audio": audio}, format="multipart")
        assert response.status_code == 422 and response.json()["code"] == "voice_not_available"

    def test_voice_works_once_the_transcribe_hook_is_merged(self, me, hooks):
        hooks.install(question=False, answer=False, report=False, voice=True)
        session_id = one(me)
        me.post(f"{URL}{session_id}/start/")
        audio = SimpleUploadedFile("a.webm", b"x" * 50, content_type="audio/webm")
        assert me.post(f"{URL}{session_id}/answer/", {"turn_index": 1, "audio": audio}, format="multipart").status_code == 200
        assert InterviewSession.objects.get(pk=session_id).turns.get(index=1).answer_source == "voice"

    def test_a_finished_session_is_gone_for_start_and_answer(self, me):
        session_id = one(me)
        play(me, session_id, 8)
        assert me.post(f"{URL}{session_id}/start/").status_code == 410

    def test_the_idle_sweep_interrupts_it_and_the_candidate_can_resume(self, me):
        session_id = one(me)
        first = me.post(f"{URL}{session_id}/start/").json()
        InterviewSession.objects.filter(pk=session_id).update(last_activity_at=timezone.now() - timedelta(minutes=40))
        assert lifecycle.interrupt_idle() == 1
        assert me.get(f"{URL}{session_id}/").json()["status"] == "interrupted"
        assert me.post(f"{URL}{session_id}/start/").json()["turn"] == first["turn"]
        assert me.post(f"{URL}{session_id}/end/").status_code == 200  # or end it

    def test_a_policy_block_uses_the_bank_and_records_a_failure_without_content(self, me, monkeypatch):
        monkeypatch.setattr(ai_hooks, "next_question", lambda s, t, h: (_ for _ in ()).throw(ai_hooks.AIPolicyBlocked()))
        session_id = one(me)
        assert me.post(f"{URL}{session_id}/start/").status_code == 200
        assert InterviewSession.objects.get(pk=session_id).turns.get().question_meta["from_bank"] is True
        event = ActivityEvent.objects.get(event_type="ai.provider_failure")
        assert event.metadata == {"kind": "mock", "hook": "next_question", "reason": "policy_blocked"} and event.target_id == InterviewSession.objects.get(pk=session_id).pk

    def test_an_outage_keeps_the_practice_going_with_bank_questions(self, me, monkeypatch):
        monkeypatch.setattr(ai_hooks, "next_question", lambda s, t, h: (_ for _ in ()).throw(ai_hooks.AIUnavailable()))
        session_id = one(me)
        assert me.post(f"{URL}{session_id}/start/").status_code == 200 and not ActivityEvent.objects.filter(event_type="ai.provider_failure").exists()

    def test_the_questions_never_repeat(self, me):
        session_id = one(me)
        play(me, session_id, 8)
        texts = list(InterviewSession.objects.get(pk=session_id).turns.values_list("question_text", flat=True))
        assert len(texts) == len(set(texts)) == 8


class TestSomeoneElses:
    @pytest.mark.parametrize("method, tail", [("get", ""), ("delete", ""), ("post", "start/"), ("post", "answer/"), ("post", "end/"), ("post", "feedback/retry/")])
    def test_another_candidates_session_is_404_on_every_endpoint(self, me, auth_client, user_factory, method, tail):
        session_id = one(me)
        stranger = auth_client(user_factory())
        body = {"turn_index": 1, "answer_text": "x"} if tail == "answer/" else None
        response = getattr(stranger, method)(f"{URL}{session_id}/{tail}", body, format="json")
        assert response.status_code == 404
        assert InterviewSession.objects.get(pk=session_id).status == "invited"

    def test_a_mock_session_cannot_be_opened_through_the_public_interview_link(self, me, api_client):
        session_id = one(me)
        session = InterviewSession.objects.get(pk=session_id)
        assert api_client.get(f"/api/public/interviews/{session.token_hash}/").status_code == 404


class TestEnding:
    def test_with_at_least_three_answers_it_finishes_with_partial_feedback(self, me, hooks, django_capture_on_commit_callbacks):
        hooks.install(question=False).score = 7.0
        session_id = one(me)
        play(me, session_id, 3)
        with django_capture_on_commit_callbacks(execute=True):
            response = me.post(f"{URL}{session_id}/end/")
        assert response.status_code == 200 and response.json()["status"] == "incomplete"  # the feedback is produced in the background
        body = me.get(f"{URL}{session_id}/").json()
        assert body["status"] == "evaluated" and body["feedback_status"] == "partial" and body["answered_count"] == 3
        assert body["overall_score"] == 70.0 and len(body["transcript"]) == 3 and "ended early" in body["feedback_message"]

    def test_with_fewer_than_three_it_is_cancelled_and_does_not_count(self, me):
        session_id = one(me)
        play(me, session_id, 2)
        body = me.post(f"{URL}{session_id}/end/").json()
        assert body["status"] == "cancelled" and MockInterviewSession.objects.get(session_id=session_id).counts_toward_limit is False

    def test_ending_a_session_that_never_started_cancels_it(self, me):
        session_id = one(me)
        assert me.post(f"{URL}{session_id}/end/").json()["status"] == "cancelled"

    def test_ending_twice_or_a_closed_session(self, me):
        session_id = one(me)
        me.post(f"{URL}{session_id}/end/")
        assert me.post(f"{URL}{session_id}/end/").json()["code"] == "session_closed"

    def test_ending_a_finished_session_is_harmless(self, me):
        session_id = one(me)
        play(me, session_id, 8)
        assert me.post(f"{URL}{session_id}/end/").status_code == 200


class TestFeedback:
    def finish(self, me, django_capture_on_commit_callbacks):
        session_id = one(me)
        with django_capture_on_commit_callbacks(execute=True):
            play(me, session_id, 8)
        return session_id

    def test_without_the_hooks_the_candidate_is_told_feedback_is_not_available_yet(self, me, django_capture_on_commit_callbacks):
        session_id = self.finish(me, django_capture_on_commit_callbacks)
        body = me.get(f"{URL}{session_id}/").json()
        assert body["feedback_status"] == "none" and body["feedback_message"] == "Feedback is not available yet." and body["overall_score"] is None
        assert body["report"] is None and len(body["transcript"]) == 8 and body["disclaimer"] == "Generated by AI for your own practice."

    def test_with_the_hooks_the_feedback_is_ready_and_the_numbers_come_from_code(self, me, hooks, django_capture_on_commit_callbacks):
        hooks.install(question=False).score = 8.0
        session_id = self.finish(me, django_capture_on_commit_callbacks)
        body = me.get(f"{URL}{session_id}/").json()
        assert (body["feedback_status"], body["overall_score"], body["feedback_message"]) == ("ready", 80.0, "")
        assert body["report"]["summary"] == "Good practice." and body["report"]["suggestions"] == ["Add examples"] and body["report"]["rubric_averages"] == {"communication": 8.0}
        assert body["transcript"][0]["score"] == 8.0 and body["transcript"][0]["feedback"] == "Clear answer."

    def test_a_failure_is_shown_and_can_be_retried(self, me, hooks, monkeypatch, django_capture_on_commit_callbacks):
        hooks.install(question=False)
        monkeypatch.setattr(ai_hooks, "evaluate_session", lambda s, t: (_ for _ in ()).throw(ai_hooks.AIUnavailable()))
        session_id = self.finish(me, django_capture_on_commit_callbacks)
        body = me.get(f"{URL}{session_id}/").json()
        assert body["feedback_status"] == "failed" and body["feedback_message"] == "We couldn't generate feedback for this session."
        hooks.install(question=False)  # the service recovers
        with django_capture_on_commit_callbacks(execute=True):
            assert me.post(f"{URL}{session_id}/feedback/retry/").status_code == 202
        assert me.get(f"{URL}{session_id}/").json()["feedback_status"] == "ready"

    def test_retry_is_409_unless_the_feedback_failed(self, me, django_capture_on_commit_callbacks):
        session_id = self.finish(me, django_capture_on_commit_callbacks)
        response = me.post(f"{URL}{session_id}/feedback/retry/")
        assert response.status_code == 409 and response.json()["code"] == "not_failed"

    def test_generating_is_reported_while_it_runs(self, me):
        session_id = one(me)
        InterviewSession.objects.filter(pk=session_id).update(status="evaluating")
        assert me.get(f"{URL}{session_id}/").json()["feedback_status"] == "generating"

    def test_the_sweep_evaluates_a_session_that_finished_before_the_hooks_existed(self, me, hooks, django_capture_on_commit_callbacks):
        session_id = self.finish(me, django_capture_on_commit_callbacks)
        hooks.install(question=False).score = 9.0
        InterviewSession.objects.filter(pk=session_id).update(next_evaluation_at=timezone.now() - timedelta(minutes=1))
        with django_capture_on_commit_callbacks(execute=True):
            evaluation.sweep()
        assert me.get(f"{URL}{session_id}/").json()["overall_score"] == 90.0


class TestDelete:
    def test_delete_removes_everything_that_was_said_and_keeps_an_empty_shell(self, me, with_cv, candidate):
        with_cv("Sara Malik built Django services for years.")
        session_id = create(me, use_cv=True).json()["id"]
        play(me, session_id, 4)
        assert me.delete(f"{URL}{session_id}/").status_code == 204
        session = InterviewSession.objects.get(pk=session_id)
        assert not InterviewTurn.objects.filter(session=session).exists() and session.context == {} and session.report == {} and session.overall_score is None
        assert MockInterviewSession.objects.get(session=session).deleted_at is not None and session.status == "cancelled"
        assert me.get(f"{URL}{session_id}/").status_code == 404 and me.get(URL).json()["count"] == 0

    def test_the_event_keeps_no_content(self, me, candidate):
        session_id = one(me)
        play(me, session_id, 2, text="SECRET ANSWER TEXT")
        me.delete(f"{URL}{session_id}/")
        event = ActivityEvent.objects.get(event_type="mock_interview.deleted")
        assert event.actor == candidate and event.target_id == InterviewSession.objects.get(pk=session_id).pk and "SECRET" not in str(event.__dict__)

    def test_deleting_an_open_session_frees_the_slot(self, me):
        session_id = one(me)
        assert me.delete(f"{URL}{session_id}/").status_code == 204
        assert create(me).status_code == 201

    def test_a_deleted_session_cannot_be_deleted_again(self, me):
        session_id = one(me)
        me.delete(f"{URL}{session_id}/")
        assert me.delete(f"{URL}{session_id}/").status_code == 404

    def test_a_deleted_session_is_gone_from_progress_and_the_dashboard(self, me, hooks, django_capture_on_commit_callbacks):
        hooks.install(question=False).score = 8.0
        session_id = one(me)
        with django_capture_on_commit_callbacks(execute=True):
            play(me, session_id, 8)
        assert me.get(URL + "progress/").json()["scored_sessions"] == 1
        me.delete(f"{URL}{session_id}/")
        assert me.get(URL + "progress/").json()["scored_sessions"] == 0 and me.get("/api/candidate/dashboard/").json()["recent_mock_sessions"] == []

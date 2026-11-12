"""The candidate's side, end to end through the public link: open, start, answer, finish, resume (UC-08, FR-42 to FR-46)."""
import threading
from datetime import timedelta

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.utils import timezone

from apps.common.choices import CompanyStatus, MemberRole
from apps.Module5_Foundation.models import ActivityEvent, Notification

from ..models import InterviewQuestionBank, InterviewSession, InterviewTurn
from ..services import engine

pytestmark = pytest.mark.django_db
BASE = "/api/public/interviews/"


def url(session, tail=""):
    return f"{BASE}{session.raw_token}/{tail}"


def start(client, session):
    return client.post(url(session, "start/"))


def answer(client, session, index, text="I would build it with Python and tests.", **extra):
    return client.post(url(session, "answer/"), {"turn_index": index, "answer_text": text, **extra}, format="json")


def run_to_the_end(client, session, count=3):
    first = start(client, session).json()
    assert first["turn"]["index"] == 1
    last = None
    for index in range(1, count + 1):
        last = answer(client, session, index)
        assert last.status_code == 200, last.content
    return last.json()


# --- Opening the link -------------------------------------------------------------------------------------------
class TestOpen:
    def test_the_link_needs_no_login_and_describes_the_interview(self, api_client, session):
        body = api_client.get(url(session)).json()
        assert body["company_name"] == session.application.job.company.name
        assert (body["role_title"], body["kind"], body["status"]) == ("Backend Developer", "screening", "invited")
        assert (body["question_count"], body["answered_count"], body["current_turn"]) == (3, 0, None)
        assert body["seconds_left_to_start"] > 6 * 86400 and body["estimated_minutes"] >= 5
        assert body["voice_available"] is False and "AI" in body["ai_disclaimer"]
        assert session.raw_token not in str(body)

    @pytest.mark.parametrize("token", ["nope", "x" * 500, "../../etc", "%00"])
    def test_an_unknown_token_is_404(self, api_client, token):
        assert api_client.get(f"{BASE}{token}/").status_code == 404

    def test_a_stale_login_token_cannot_break_the_public_link(self, api_client, session):
        api_client.credentials(HTTP_AUTHORIZATION="Bearer garbage")
        assert api_client.get(url(session)).status_code == 200

    def test_an_expired_link_is_410_names_the_company_and_tells_hr_once(self, api_client, session, team):
        session.expires_at = timezone.now() - timedelta(minutes=1)
        session.save()
        for _ in range(2):
            response = api_client.get(url(session))
            assert response.status_code == 410 and response.json()["code"] == "interview_expired"
            assert team[0].name in response.json()["detail"] and "recruiting team" in response.json()["detail"]
        session.refresh_from_db()
        assert session.status == "expired"
        notified = set(Notification.objects.filter(kind="interview_expired").values_list("user_id", flat=True))
        _, users = team
        assert notified == {users[r].pk for r in (MemberRole.ADMIN, MemberRole.HR_MANAGER, MemberRole.RECRUITER)}
        assert ActivityEvent.objects.filter(event_type="interview.expired").count() == 1

    def test_a_started_interview_is_not_cut_off_by_the_deadline(self, api_client, session):
        start(api_client, session)
        session.refresh_from_db()
        session.expires_at = timezone.now() - timedelta(minutes=5)
        session.save()
        assert api_client.get(url(session)).status_code == 200

    @pytest.mark.parametrize("status, code", [("completed", "interview_completed"), ("evaluated", "interview_completed"), ("incomplete", "interview_completed"), ("cancelled", "interview_cancelled"), ("expired", "interview_expired")])
    def test_a_finished_link_is_410_with_a_matching_message(self, api_client, session, status, code):
        session.status = status
        session.save()
        response = api_client.get(url(session))
        assert response.status_code == 410 and response.json()["code"] == code

    def test_a_suspended_company_makes_the_link_unavailable(self, api_client, session):
        company = session.application.job.company
        company.status, company.suspension_reason = CompanyStatus.SUSPENDED, "Policy violation under review."
        company.save()
        response = api_client.get(url(session))
        assert response.status_code == 410 and response.json()["code"] == "interview_unavailable"
        assert start(api_client, session).status_code == 410

    def test_hr_moving_the_application_to_rejected_does_not_cut_the_candidate_off(self, api_client, session):
        session.application.status = "rejected"
        session.application.save()
        assert start(api_client, session).status_code == 200


# --- Start ------------------------------------------------------------------------------------------------------
class TestStart:
    def test_the_first_question_comes_from_the_bank_and_the_session_starts(self, api_client, session):
        body = start(api_client, session).json()
        assert body["done"] is False and body["turn"]["index"] == 1 and body["turn"]["question_text"]
        assert (body["answered_count"], body["question_count"]) == (0, 3)
        session.refresh_from_db()
        assert session.status == "in_progress" and session.started_at and session.last_activity_at
        turn = session.turns.get()
        assert turn.question_meta["from_bank"] is True and InterviewQuestionBank.objects.filter(text=turn.question_text).exists()

    def test_starting_again_after_a_refresh_returns_the_same_question(self, api_client, session):
        first = start(api_client, session).json()
        second = start(api_client, session).json()
        assert first["turn"]["question_text"] == second["turn"]["question_text"]
        assert session.turns.count() == 1

    def test_no_question_at_all_is_503_with_retry_after_and_the_session_stays_invited(self, api_client, session):
        InterviewQuestionBank.objects.all().delete()
        response = start(api_client, session)
        assert response.status_code == 503 and response.json()["code"] == "no_question_available"
        assert int(response["Retry-After"]) > 0
        session.refresh_from_db()
        assert session.status == "invited" and session.started_at is None

    def test_the_hook_is_used_when_connected_and_the_focus_area_rotates(self, api_client, session, hooks):
        hooks.install()
        run_to_the_end(api_client, session)
        areas = [call[1].get("focus_area") for call in hooks.calls if call[0] == "next_question"]
        assert areas == ["interest", "familiarity", "experience"]
        assert session.turns.get(index=1).question_meta["from_bank"] is False

    def test_an_interrupted_session_resumes_on_the_same_unanswered_question(self, api_client, session):
        first = start(api_client, session).json()
        session.status = "interrupted"
        session.save()
        again = start(api_client, session).json()
        assert again["turn"]["question_text"] == first["turn"]["question_text"]
        session.refresh_from_db()
        assert session.status == "in_progress"

    def test_a_link_cancelled_while_the_question_is_made_is_refused(self, api_client, session):
        session.status = "cancelled"
        session.save()
        assert start(api_client, session).status_code == 410


# --- Answer -----------------------------------------------------------------------------------------------------
class TestAnswer:
    def test_a_full_interview_runs_without_any_hook_and_leaves_scores_empty(self, api_client, session, django_capture_on_commit_callbacks):
        with django_capture_on_commit_callbacks(execute=True):
            body = run_to_the_end(api_client, session)
        assert body["done"] is True and body["turn"] is None and body["answered_count"] == 3
        session.refresh_from_db()
        assert session.status == "completed" and session.completed_at
        assert session.overall_score is None and session.recommendation is None and session.report == {}
        assert not session.turns.exclude(score=None).exists()
        assert session.next_evaluation_at > timezone.now() + timedelta(hours=5)  # parked until a hook is merged
        assert Notification.objects.filter(kind="interview_completed").count() == 3
        assert ActivityEvent.objects.filter(event_type="interview.completed").count() == 1

    def test_with_hooks_the_interview_is_evaluated_and_the_guard_decides(self, api_client, session, hooks, django_capture_on_commit_callbacks):
        hooks.install()
        with django_capture_on_commit_callbacks(execute=True):
            run_to_the_end(api_client, session)
        session.refresh_from_db()
        assert session.status == "evaluated" and float(session.overall_score) == 80.0 and session.recommendation == "advance"
        assert [float(t.score) for t in session.turns.order_by("index")] == [8.0, 8.0, 8.0]
        assert session.report["summary"] == "A solid candidate." and session.report["scored_answers"] == 3

    def test_the_answer_is_saved_before_any_hook_is_called(self, api_client, session, monkeypatch):
        from .. import ai_hooks

        seen = {}

        def scoring(s, turn):
            seen["saved"] = InterviewTurn.objects.get(pk=turn.pk).answer_text
            raise ai_hooks.AIUnavailable()

        monkeypatch.setattr(ai_hooks, "evaluate_answer", scoring)
        start(api_client, session)
        assert answer(api_client, session, 1, "my real answer").status_code == 200
        assert seen["saved"] == "my real answer"
        assert session.turns.get(index=1).score is None  # unscored, not lost

    def test_answering_twice_returns_the_stored_result_and_saves_once(self, api_client, session):
        start(api_client, session)
        first = answer(api_client, session, 1, "first text").json()
        second = answer(api_client, session, 1, "second text from another tab").json()
        assert first == second
        assert session.turns.get(index=1).answer_text == "first text" and session.turns.count() == 2

    def test_the_last_answer_replayed_is_done_not_an_error(self, api_client, session):
        run_to_the_end(api_client, session)
        replay = answer(api_client, session, 3)
        assert replay.status_code == 200 and replay.json()["done"] is True

    def test_only_the_current_question_can_be_answered(self, api_client, session):
        start(api_client, session)
        assert answer(api_client, session, 2).status_code == 409
        assert answer(api_client, session, 99).json()["code"] == "wrong_turn"

    def test_an_answer_before_starting_is_refused(self, api_client, session):
        response = answer(api_client, session, 1)
        assert response.status_code == 409

    @pytest.mark.parametrize("text", ["", "   ", None])
    def test_an_empty_answer_is_400_by_field(self, api_client, session, text):
        start(api_client, session)
        response = api_client.post(url(session, "answer/"), {"turn_index": 1, "answer_text": text}, format="json")
        assert response.status_code == 400 and "answer_text" in response.json()

    def test_a_too_long_answer_is_400_and_exactly_at_the_limit_is_fine(self, api_client, session):
        start(api_client, session)
        assert answer(api_client, session, 1, "x" * 3001).status_code == 400
        assert answer(api_client, session, 1, "y" * 3000).status_code == 200

    def test_idk_is_stored_as_is(self, api_client, session):
        start(api_client, session)
        assert answer(api_client, session, 1, "idk").status_code == 200
        assert session.turns.get(index=1).answer_text == "idk"

    def test_the_questions_of_one_interview_never_repeat(self, api_client, session_factory, application):
        session = session_factory(application, target=8)
        run_to_the_end(api_client, session, count=8)
        texts = list(session.turns.values_list("question_text", flat=True))
        assert len(texts) == len(set(texts)) == 8

    def test_when_the_bank_runs_out_mid_interview_the_answer_is_kept_and_it_is_503(self, api_client, session):
        InterviewQuestionBank.objects.filter(kind="screening").exclude(pk=InterviewQuestionBank.objects.filter(kind="screening").first().pk).delete()
        start(api_client, session)
        response = answer(api_client, session, 1, "kept")
        assert response.status_code == 503 and int(response["Retry-After"]) > 0
        assert session.turns.get(index=1).answer_text == "kept"

    def test_the_questions_are_not_leaked_ahead(self, api_client, session):
        start(api_client, session)
        assert session.turns.count() == 1  # the next question exists only after the current one is answered


class TestVoice:
    def audio(self, size=100):
        return SimpleUploadedFile("answer.webm", b"x" * size, content_type="audio/webm")

    def post_audio(self, client, session, audio=None):
        return client.post(url(session, "answer/"), {"turn_index": 1, "audio": audio or self.audio()}, format="multipart")

    def test_voice_is_422_until_the_transcribe_hook_is_merged_and_nothing_is_stored(self, api_client, session):
        start(api_client, session)
        response = self.post_audio(api_client, session)
        assert response.status_code == 422 and response.json()["code"] == "voice_not_available"
        assert session.turns.get(index=1).answered_at is None

    def test_a_transcribed_answer_is_stored_as_text_with_source_voice(self, api_client, session, hooks):
        hooks.install(question=False, answer=False, report=False, voice=True)
        start(api_client, session)
        assert self.post_audio(api_client, session).status_code == 200
        turn = session.turns.get(index=1)
        assert (turn.answer_text, turn.answer_source) == ("I spoke this answer.", "voice")

    def test_a_failed_transcription_asks_the_candidate_to_type(self, api_client, session, monkeypatch):
        from .. import ai_hooks

        monkeypatch.setattr(ai_hooks, "transcribe", lambda f: (_ for _ in ()).throw(ai_hooks.AIUnavailable()))
        start(api_client, session)
        response = self.post_audio(api_client, session)
        assert response.status_code == 422 and response.json()["code"] == "transcription_failed"

    def test_a_recording_over_the_length_limit_is_422(self, api_client, session, monkeypatch):
        from .. import ai_hooks

        monkeypatch.setattr(ai_hooks, "transcribe", lambda f: {"text": "long", "duration_seconds": 9999})
        start(api_client, session)
        assert self.post_audio(api_client, session).json()["code"] == "audio_too_long"

    def test_an_oversized_file_is_400_before_any_hook_runs(self, api_client, session, settings):
        settings.INTERVIEW_MAX_AUDIO_BYTES = 50
        start(api_client, session)
        assert self.post_audio(api_client, session, self.audio(500)).status_code == 400

    def test_text_and_audio_together_or_neither_is_400(self, api_client, session):
        start(api_client, session)
        both = api_client.post(url(session, "answer/"), {"turn_index": 1, "answer_text": "hi", "audio": self.audio()}, format="multipart")
        neither = api_client.post(url(session, "answer/"), {"turn_index": 1}, format="json")
        assert both.status_code == neither.status_code == 400


# --- Finish early -----------------------------------------------------------------------------------------------
class TestFinish:
    def test_finishing_needs_three_answers(self, api_client, session_factory, application):
        session = session_factory(application, target=6)
        start(api_client, session)
        for index in (1, 2):
            answer(api_client, session, index)
        response = api_client.post(url(session, "finish/"))
        assert response.status_code == 400 and response.json()["code"] == "too_few_answers"

    def test_finishing_before_starting_is_400(self, api_client, session):
        assert api_client.post(url(session, "finish/")).status_code == 400

    def test_finishing_early_marks_the_session_incomplete_and_queues_the_evaluation(self, api_client, session_factory, application, hooks, django_capture_on_commit_callbacks):
        hooks.install()
        session = session_factory(application, target=6)
        start(api_client, session)
        for index in (1, 2, 3):
            answer(api_client, session, index)
        with django_capture_on_commit_callbacks(execute=True):
            response = api_client.post(url(session, "finish/"))
        assert response.status_code == 200 and response.json()["done"] is True
        session.refresh_from_db()
        assert session.status == "evaluated" and session.report["scored_answers"] == 3 and session.report["total_answers"] == 3
        assert session.turns.count() == 4  # the unanswered fourth question is left out of the evaluation
        assert api_client.post(url(session, "finish/")).status_code == 200  # a double click is harmless

    def test_an_incomplete_session_that_no_hook_evaluates_stays_incomplete(self, api_client, session_factory, application):
        session = session_factory(application, target=6)
        start(api_client, session)
        for index in (1, 2, 3):
            answer(api_client, session, index)
        api_client.post(url(session, "finish/"))
        session.refresh_from_db()
        assert session.status == "incomplete" and session.completed_at


# --- Real concurrency -------------------------------------------------------------------------------------------
@pytest.mark.django_db(transaction=True)
def test_two_tabs_answering_the_same_question_save_one_answer(api_client, session_factory, application, ensure_bank):
    session = session_factory(application)
    start(api_client, session)
    for _ in range(4):
        InterviewTurn.objects.filter(session=session, index__gt=1).delete()
        InterviewTurn.objects.filter(session=session, index=1).update(answer_text="", answer_source="", answered_at=None)
        barrier, results = threading.Barrier(2), []

        def tab(text):
            from rest_framework.test import APIClient

            try:
                barrier.wait(timeout=10)
                response = answer(APIClient(), session, 1, text)
                results.append((response.status_code, response.json()))
            except Exception as exc:  # noqa: BLE001 - reported by the assertion below
                results.append((repr(exc), None))
            finally:
                connection.close()

        threads = [threading.Thread(target=tab, args=(f"text {i}",)) for i in range(2)]
        [t.start() for t in threads]
        [t.join(timeout=30) for t in threads]
        assert [code for code, _ in results] == [200, 200], results
        assert results[0][1]["turn"] == results[1][1]["turn"]
        assert InterviewTurn.objects.filter(session=session, index=1).count() == 1
        assert InterviewTurn.objects.filter(session=session).count() == 2


@pytest.mark.django_db(transaction=True)
def test_the_last_answer_sent_twice_at_once_completes_once(api_client, session_factory, application, ensure_bank):
    for _ in range(3):
        session = session_factory(application, token=f"race-{_}-{timezone.now().timestamp()}")
        session.status = "in_progress"
        session.save()
        InterviewTurn.objects.bulk_create(
            [
                InterviewTurn(session=session, index=1, question_text="q1?", answer_text="a", answer_source="typed", answered_at=timezone.now()),
                InterviewTurn(session=session, index=2, question_text="q2?", answer_text="a", answer_source="typed", answered_at=timezone.now()),
                InterviewTurn(session=session, index=3, question_text="q3?"),
            ]
        )
        barrier = threading.Barrier(2)

        def tab():
            from rest_framework.test import APIClient

            try:
                barrier.wait(timeout=10)
                answer(APIClient(), session, 3, "last")
            finally:
                connection.close()

        threads = [threading.Thread(target=tab) for _ in range(2)]
        [t.start() for t in threads]
        [t.join(timeout=30) for t in threads]
        assert ActivityEvent.objects.filter(event_type="interview.completed", target_id=session.pk).count() == 1
        assert InterviewSession.objects.get(pk=session.pk).status == "completed"


def test_engine_summary_never_contains_the_token(session):
    session.refresh_from_db()
    assert session.raw_token not in str(engine.public_summary(session))

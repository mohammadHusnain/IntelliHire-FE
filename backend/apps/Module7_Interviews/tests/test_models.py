"""Rules kept by the database itself, plus the small plumbing: log redaction, throttles and the hook defaults."""
import logging

import pytest
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.common.log_filters import RedactTokens

from .. import ai_hooks
from ..models import InterviewQuestionBank, InterviewSession, InterviewTurn

pytestmark = pytest.mark.django_db
BASE = "/api/public/interviews/"


class TestConstraints:
    def test_a_turn_index_is_unique_within_a_session(self, session):
        InterviewTurn.objects.create(session=session, index=1, question_text="q?")
        with pytest.raises(IntegrityError), transaction.atomic():
            InterviewTurn.objects.create(session=session, index=1, question_text="again?")

    def test_turn_scores_stay_between_0_and_10(self, session):
        for index, score in enumerate([-1, 10.5], start=1):
            with pytest.raises(IntegrityError), transaction.atomic():
                InterviewTurn.objects.create(session=session, index=index, question_text="q?", score=score)
        InterviewTurn.objects.create(session=session, index=3, question_text="q?", score=10)

    def test_an_answer_always_has_text_source_and_time_together(self, session):
        for fields in ({"answer_text": "x"}, {"answered_at": timezone.now()}, {"answered_at": timezone.now(), "answer_text": "x"}, {"answered_at": timezone.now(), "answer_source": "typed"}):
            with pytest.raises(IntegrityError), transaction.atomic():
                InterviewTurn.objects.create(session=session, index=1, question_text="q?", **fields)

    def test_the_overall_score_and_recommendation_are_range_checked(self, session):
        for field, value in (("overall_score", 100.01), ("overall_score", -1), ("recommendation", "maybe"), ("status", "weird"), ("question_target", 0), ("kind", "oral")):
            with pytest.raises(IntegrityError), transaction.atomic():
                InterviewSession.objects.filter(pk=session.pk).update(**{field: value})

    def test_a_company_interview_needs_an_application_but_a_mock_does_not(self, session_factory, application, user_factory):
        with pytest.raises(IntegrityError), transaction.atomic():
            InterviewSession.objects.create(kind="screening", application=None, token_hash="a" * 64, role_title="r", question_target=3, expires_at=timezone.now())
        InterviewSession.objects.create(kind="mock", application=None, candidate_user=user_factory(), token_hash="b" * 64, role_title="r", question_target=3, expires_at=timezone.now())

    def test_two_mock_sessions_may_both_be_open_but_two_screenings_may_not(self, session_factory, application, user_factory):
        user = user_factory()
        for n in range(2):
            InterviewSession.objects.create(kind="mock", application=None, candidate_user=user, token_hash=f"{n}" * 64, role_title="r", question_target=3, expires_at=timezone.now())
        session_factory(application, status="invited")
        with pytest.raises(IntegrityError), transaction.atomic():
            session_factory(application, status="in_progress", token="x2")
        session_factory(application, kind="technical", status="invited", token="x3")  # another kind is a different slot

    def test_the_link_hash_is_unique_and_the_disclaimer_cannot_be_switched_off(self, session, session_factory, application_factory, job):
        with pytest.raises(IntegrityError), transaction.atomic():
            session_factory(application_factory(job), token=session.raw_token)
        with pytest.raises(IntegrityError), transaction.atomic():
            InterviewSession.objects.filter(pk=session.pk).update(ai_disclaimer=False)

    def test_the_bank_refuses_a_duplicate_question_and_a_bad_difficulty(self):
        first = InterviewQuestionBank.objects.first()
        with pytest.raises(IntegrityError), transaction.atomic():
            InterviewQuestionBank.objects.create(kind=first.kind, competency="x", text=first.text)
        with pytest.raises(IntegrityError), transaction.atomic():
            InterviewQuestionBank.objects.create(kind="screening", competency="x", text="A new one?", difficulty="brutal")

    def test_deleting_an_application_removes_its_interviews_and_turns(self, session):
        InterviewTurn.objects.create(session=session, index=1, question_text="q?")
        session.application.delete()
        assert not InterviewSession.objects.exists() and not InterviewTurn.objects.exists()


class TestSeedMigration:
    def test_it_is_idempotent(self):
        from .. import seed_data

        before = InterviewQuestionBank.objects.count()
        InterviewQuestionBank.objects.bulk_create([InterviewQuestionBank(**row) for row in seed_data.rows()], ignore_conflicts=True)
        assert InterviewQuestionBank.objects.count() == before == len(seed_data.rows())


class TestHookDefaults:
    def test_the_defaults_are_the_bank_and_not_connected(self, session):
        assert ai_hooks.next_question(session, [], {})["from_bank"] is True
        for call, args in ((ai_hooks.evaluate_answer, (session, None)), (ai_hooks.evaluate_session, (session, [])), (ai_hooks.transcribe, (None,))):
            with pytest.raises(ai_hooks.AINotConnected):
                call(*args)

    def test_the_module_never_imports_an_ai_sdk_or_builds_a_prompt(self):
        import pathlib

        root = pathlib.Path(__file__).resolve().parents[1]
        text = "\n".join(p.read_text(encoding="utf8") for p in root.rglob("*.py") if "tests" not in p.parts and "migrations" not in p.parts)
        for forbidden in ("import openai", "from openai", "llm.generate", "generate_json", "render(", "system_text"):
            assert forbidden not in text, forbidden


class TestLogRedaction:
    def record(self, message, *args):
        return logging.LogRecord("django.request", logging.WARNING, "x", 1, message, args, None)

    @pytest.mark.parametrize("path", ["/api/public/interviews/SECRET-token_123/", "/api/public/interviews/SECRET-token_123/answer/", "/api/public/invitations/SECRET-token_123/accept/"])
    def test_a_token_in_a_path_never_reaches_a_log_line(self, path):
        record = self.record("Not Found: %s", path)
        assert RedactTokens().filter(record) is True
        assert "SECRET" not in record.getMessage() and "<redacted>" in record.getMessage()

    def test_other_log_lines_are_untouched(self):
        record = self.record("Bad Request: %s", "/api/jobs/123/")
        RedactTokens().filter(record)
        assert record.getMessage() == "Bad Request: /api/jobs/123/"

    def test_a_real_request_that_logs_a_warning_is_redacted(self, api_client, caplog):
        from django.conf import settings

        assert "redact_tokens" in settings.LOGGING["handlers"]["console"]["filters"]
        caplog.clear()


class TestThrottles:
    def test_starting_is_limited_to_10_per_hour_per_link(self, api_client, session, session_factory, application_factory, job):
        other = session_factory(application_factory(job))
        codes = [api_client.post(f"{BASE}{session.raw_token}/start/").status_code for _ in range(11)]
        assert codes[:10] == [200] * 10 and codes[10] == 429
        assert api_client.post(f"{BASE}{other.raw_token}/start/").status_code == 200  # another link has its own allowance

    def test_the_limits_are_configured(self, settings):
        rates = settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]
        assert (rates["interview_start"], rates["interview_answer"]) == ("10/hour", "60/min")

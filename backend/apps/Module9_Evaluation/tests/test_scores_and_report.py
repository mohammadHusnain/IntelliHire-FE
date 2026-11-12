"""Stage scores, the evaluation row and the AI-assisted report: privacy, the guard, durability (FR-52 to FR-54)."""
import threading
from datetime import timedelta
from decimal import Decimal

import pytest
from django.db import connection
from django.utils import timezone

from apps.Module5_Foundation.ai.errors import AIUnavailable
from apps.Module5_Foundation.ai.providers.fake import FakeProvider
from apps.Module5_Foundation.models import ActivityEvent, Notification

from .. import tasks
from ..models import CandidateEvaluation, EvaluationWeights
from ..services import report, scores
from .conftest import GOOD_REPORT, evaluation_of, queue_report

pytestmark = pytest.mark.django_db


class TestScores:
    def test_the_three_stage_scores_become_one_composite(self, scored):
        evaluation, changed = scores.refresh(scored)
        assert changed is True
        assert (float(evaluation.cv_score), float(evaluation.screening_score), float(evaluation.technical_score)) == (80.0, 70.0, 85.0)
        assert evaluation.composite_score == Decimal("79.00") and evaluation.is_partial is False and evaluation.missing_stages == []
        assert evaluation.job_id == scored.job_id and evaluation.report_status == "none"
        assert EvaluationWeights.objects.get(job=scored.job).weights == {"cv": 30, "screening": 30, "technical": 40}  # created on first access

    def test_a_missing_stage_is_partial_and_named(self, application, cv_match):
        cv_match(application, 60)
        evaluation, _ = scores.refresh(application)
        assert evaluation.is_partial and evaluation.missing_stages == ["screening", "technical"] and evaluation.composite_score == Decimal("60.00")

    def test_nothing_scored_means_no_evaluation_row(self, application):
        assert scores.refresh(application) == (None, False)
        assert not CandidateEvaluation.objects.exists()

    def test_refreshing_twice_changes_nothing_the_second_time(self, scored):
        scores.refresh(scored)
        assert scores.refresh(scored)[1] is False

    def test_only_evaluated_interviews_count_and_the_latest_wins(self, application, evaluated_session, session_factory):
        evaluated_session(application, "screening", 50)
        newer = evaluated_session(application, "screening", 90)
        session_factory(application, kind="screening", status="completed", overall_score=None, token="open-one")
        session_factory(application, kind="technical", status="evaluation_failed", token="failed-one")
        assert scores.stage_scores(application) == {"cv": None, "screening": newer.overall_score, "technical": None}

    def test_a_new_session_changes_the_composite(self, application, cv_match, evaluated_session):
        cv_match(application, 80)
        evaluated_session(application, "screening", 60)
        first = scores.refresh(application)[0].composite_score
        evaluated_session(application, "technical", 100)
        evaluation, changed = scores.refresh(application)
        assert changed and evaluation.composite_score > first and evaluation.technical_score == Decimal("100.00")

    def test_the_weights_snapshot_shows_what_the_composite_was_built_from(self, scored):
        used = scores.refresh(scored)[0].weights_used
        assert used["configured"] == {"cv": 30, "screening": 30, "technical": 40} and used["policy"] == "renormalise"

    def test_a_cv_analysis_through_the_real_pipeline_creates_the_evaluation(self, application_factory, job, monkeypatch):
        from apps.Module6_CVAnalysis.models import CVAnalysis
        from apps.Module6_CVAnalysis.services import pipeline
        from apps.Module6_CVAnalysis.tests.conftest import CV_TEXT, parsed_cv
        from apps.common.tests.helpers import make_pdf
        from django.core.files.base import ContentFile

        application = application_factory(job)
        application.resume.save("cv.pdf", ContentFile(make_pdf(CV_TEXT)), save=False)
        application.save()
        CVAnalysis.objects.create(application=application)
        FakeProvider.queue_chat(parsed_cv(), {"explanation": "x"})
        assert pipeline.analyse(application.pk) == "completed"
        evaluation = evaluation_of(application)
        assert evaluation.cv_score is not None and evaluation.is_partial and evaluation.missing_stages == ["screening", "technical"]


class TestReport:
    def test_generating_stores_the_report_with_the_disclaimer_and_tells_hr(self, evaluation, scored):
        report.request_report(scored.pk)
        queue_report()
        assert report.generate(scored.pk) == "ready"
        evaluation.refresh_from_db()
        body = evaluation.report
        assert evaluation.report_status == "ready" and evaluation.generated_at and evaluation.next_report_at is None
        assert (body["summary"], body["strengths"], body["weaknesses"]) == ("A strong fit for the role.", ["Solid Python"], ["No React"])
        assert body["recommendation"] == "yes" and body["ai_disclaimer"] == "AI-assisted summary to support, not replace, a hiring decision."
        assert body["stage_summaries"] == {"cv": "A good fit on skills.", "screening": "screening summary", "technical": "technical summary"}
        assert Notification.objects.filter(kind="evaluation_ready").count() == 3
        assert ActivityEvent.objects.filter(event_type="evaluation.generated").count() == 1

    def test_nothing_identifying_reaches_the_model(self, evaluation, scored, evaluated_session):
        scored.full_name = "Sara Malik"
        scored.save()
        evaluated_session(scored, "screening", 70, report={"summary": "Sara Malik (sara.malik@example.com, +92 300 1234567) spoke clearly."})
        scores.refresh(scored)
        report.request_report(scored.pk)
        queue_report()
        report.generate(scored.pk)
        prompt = [c for c in FakeProvider.calls if c["method"] == "chat"][-1]["user"]
        for private in ("Sara", "Malik", "sara.malik", "example.com", "1234567", scored.email, scored.reference):
            assert private not in prompt, private
        assert "composite" in prompt and "79" in prompt

    def test_the_model_sees_scores_skills_and_technical_comments_only(self, evaluation, scored):
        report.request_report(scored.pk)
        queue_report()
        report.generate(scored.pk)
        prompt = [c for c in FakeProvider.calls if c["method"] == "chat"][-1]["user"]
        for expected in ("matched_skills", "Python", "missing_skills", "React", "Solid.", "required_skills", "technical_relevance"):
            assert expected in prompt

    @pytest.mark.parametrize("llm, composite_band", [("strong_yes", "yes"), ("no", "yes"), ("maybe", "maybe")])
    def test_the_recommendation_is_checked_against_the_composite(self, evaluation, scored, llm, composite_band):
        assert evaluation.composite_score == Decimal("79.00")  # band: yes
        report.request_report(scored.pk)
        queue_report(recommendation=llm)
        report.generate(scored.pk)
        evaluation.refresh_from_db()
        assert evaluation.report["recommendation"] == composite_band
        assert evaluation.report["summary"] == GOOD_REPORT["summary"]  # the model's words are kept

    def test_generating_without_a_request_does_nothing(self, evaluation, scored):
        assert report.generate(scored.pk) == "skipped"
        assert not [c for c in FakeProvider.calls if c["method"] == "chat"]

    def test_a_failing_model_marks_the_report_failed_keeps_the_scores_and_retries_up_to_three_times(self, evaluation, scored):
        report.request_report(scored.pk)
        for attempt in (1, 2, 3):
            FakeProvider.queue_chat(AIUnavailable("down"), AIUnavailable("down"))
            assert report.generate(scored.pk) == "failed"
            evaluation.refresh_from_db()
            assert evaluation.report_status == "failed" and evaluation.report_attempts == attempt and evaluation.composite_score == Decimal("79.00")
            if attempt < 3:
                assert evaluation.next_report_at > timezone.now() + timedelta(minutes=4)
                CandidateEvaluation.objects.filter(pk=evaluation.pk).update(report_status="generating", next_report_at=timezone.now())
        assert evaluation.next_report_at is None
        assert Notification.objects.filter(kind="evaluation_report_failed").count() == 3  # once, when it is final

    def test_hr_can_retry_a_failed_report(self, evaluation, scored):
        report.request_report(scored.pk)
        FakeProvider.queue_chat(AIUnavailable("down"), AIUnavailable("down"))
        report.generate(scored.pk)
        assert report.request_report(scored.pk) is True
        queue_report()
        assert report.generate(scored.pk) == "ready"

    def test_a_second_request_while_one_is_running_is_ignored(self, evaluation, scored):
        report.request_report(scored.pk)
        assert report._claim(scored.pk) is True
        assert report.request_report(scored.pk) is False

    def test_scores_that_move_while_the_model_thinks_do_not_get_a_stale_report(self, evaluation, scored, evaluated_session, monkeypatch):
        report.request_report(scored.pk)
        from apps.Module5_Foundation.ai import llm

        original = llm.generate_json

        def moving(*args, **kwargs):
            CandidateEvaluation.objects.filter(pk=evaluation.pk).update(composite_score=Decimal("12.00"))  # a new score lands meanwhile
            return original(*args, **kwargs)

        monkeypatch.setattr(llm, "generate_json", moving)
        queue_report()
        assert report.generate(scored.pk) == "skipped"
        evaluation.refresh_from_db()
        assert evaluation.report == {} and evaluation.report_status == "generating" and evaluation.next_report_at is not None  # run again

    def test_the_sweep_frees_stuck_reports_and_requeues_due_ones(self, evaluation, scored, django_capture_on_commit_callbacks):
        CandidateEvaluation.objects.filter(pk=evaluation.pk).update(
            report_status="generating", report_claimed_at=timezone.now() - timedelta(minutes=20), next_report_at=timezone.now() - timedelta(minutes=1)
        )
        queue_report()
        with django_capture_on_commit_callbacks(execute=True):
            assert report.sweep() == (1, 1)
        assert evaluation_of(scored).report_status == "ready"

    def test_a_dead_broker_only_delays_the_report(self, evaluation, scored, monkeypatch, django_capture_on_commit_callbacks):
        monkeypatch.setattr(tasks.generate_report, "delay", lambda *a, **k: (_ for _ in ()).throw(ConnectionError("broker down")))
        with django_capture_on_commit_callbacks(execute=True):
            assert report.request_report(scored.pk) is True
        row = evaluation_of(scored)
        assert row.report_status == "generating" and row.next_report_at <= timezone.now()  # the sweep will pick it up

    def test_the_scheduled_task_runs_the_sweep(self, settings):
        assert settings.CELERY_BEAT_SCHEDULE["evaluation-sweep"] == {"task": "evaluation.sweep", "schedule": 300.0}
        assert tasks.sweep() == (0, 0)


@pytest.mark.django_db(transaction=True)
def test_two_workers_generating_at_once_call_the_model_once(evaluation, scored, ensure_bank):
    CandidateEvaluation.objects.filter(application=scored).update(report_status="generating", next_report_at=timezone.now())  # requested, not yet picked up
    queue_report()
    barrier, results = threading.Barrier(2), []

    def worker():
        try:
            barrier.wait(timeout=10)
            results.append(report.generate(scored.pk))
        finally:
            connection.close()

    threads = [threading.Thread(target=worker) for _ in range(2)]
    [t.start() for t in threads]
    [t.join(timeout=30) for t in threads]
    assert sorted(results) == ["ready", "skipped"], results
    assert len([c for c in FakeProvider.calls if c["method"] == "chat"]) == 1

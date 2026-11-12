"""When the evaluation updates itself: interviews finishing, the CV score changing, the weights changing (UC-10, FR-52)."""
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.common.choices import MemberRole
from apps.Module5_Foundation.ai.providers.fake import FakeProvider
from apps.Module5_Foundation.events import log_event  # noqa: F401
from apps.Module7_Interviews.services import evaluation as interview_evaluation
from apps.Module7_Interviews.signals import interview_evaluated
from apps.Module6_CVAnalysis.signals import cv_scored

from ..models import CandidateEvaluation, HRDecision
from ..services import recompute, scores
from .conftest import answer_turns, evaluation_of, queue_report

pytestmark = pytest.mark.django_db


def chat_calls():
    return [c for c in FakeProvider.calls if c["method"] == "chat"]


class TestInterviews:
    def finish(self, session_factory, application, kind, hooks, score):
        hooks.install(question=False).score = score
        session = session_factory(application, kind=kind, status="completed", target=3, token=f"{kind}-tok")
        answer_turns(session, 3)
        return session

    def test_a_technical_evaluation_updates_the_scores_and_generates_the_report(self, session_factory, application, cv_match, hooks, django_capture_on_commit_callbacks):
        cv_match(application, 80)
        queue_report()
        session = self.finish(session_factory, application, "technical", hooks, 9.0)
        with django_capture_on_commit_callbacks(execute=True):
            interview_evaluation.evaluate(session.pk)
        row = evaluation_of(application)
        assert float(row.technical_score) == 90.0 and row.report_status == "ready" and row.report["summary"]
        assert row.missing_stages == ["screening"]

    def test_a_screening_that_advances_waits_for_the_technical_interview(self, session_factory, application, cv_match, hooks, django_capture_on_commit_callbacks):
        cv_match(application, 80)
        session = self.finish(session_factory, application, "screening", hooks, 8.0)
        with django_capture_on_commit_callbacks(execute=True):
            interview_evaluation.evaluate(session.pk)
        row = evaluation_of(application)
        assert float(row.screening_score) == 80.0 and row.report_status == "none" and not chat_calls()

    @pytest.mark.parametrize("score", [5.0, 2.0])
    def test_a_screening_that_does_not_advance_gets_its_report_now(self, session_factory, application, cv_match, hooks, score, django_capture_on_commit_callbacks):
        cv_match(application, 80)
        queue_report()
        session = self.finish(session_factory, application, "screening", hooks, score)
        with django_capture_on_commit_callbacks(execute=True):
            interview_evaluation.evaluate(session.pk)
        assert evaluation_of(application).report_status == "ready"

    def test_a_new_interview_refreshes_an_existing_report(self, session_factory, application, cv_match, evaluated_session, hooks, django_capture_on_commit_callbacks):
        cv_match(application, 80)
        evaluated_session(application, "technical", 60)
        scores.refresh(application)
        CandidateEvaluation.objects.filter(application=application).update(report_status="ready", report={"summary": "old", "recommendation": "maybe"})
        queue_report(summary="new summary")
        session = self.finish(session_factory, application, "technical", hooks, 9.0)
        with django_capture_on_commit_callbacks(execute=True):
            interview_evaluation.evaluate(session.pk)
        row = evaluation_of(application)
        assert float(row.technical_score) == 90.0 and row.report["summary"] == "new summary"

    def test_a_broken_listener_cannot_undo_an_interview_evaluation(self, session_factory, application, hooks, monkeypatch):
        monkeypatch.setattr(scores, "refresh", lambda *a, **k: 1 / 0)
        session = self.finish(session_factory, application, "technical", hooks, 9.0)
        assert interview_evaluation.evaluate(session.pk) == "evaluated"

    def test_a_mock_interview_without_an_application_is_ignored(self, user_factory):
        from apps.Module7_Interviews.models import InterviewSession

        mock = InterviewSession.objects.create(kind="mock", candidate_user=user_factory(), token_hash="z" * 64, role_title="r", question_target=3, expires_at=timezone.now())
        interview_evaluated.send_robust(sender=InterviewSession, session=mock, recommendation=None)
        assert not CandidateEvaluation.objects.exists()


class TestCvScore:
    def test_a_cv_score_creates_and_updates_the_evaluation(self, application, cv_match):
        cv_match(application, 60)
        cv_scored.send_robust(sender=type(application), application=application)
        assert float(evaluation_of(application).composite_score) == 60.0
        cv_match(application, 90)
        cv_scored.send_robust(sender=type(application), application=application)
        assert float(evaluation_of(application).composite_score) == 90.0

    def test_a_ready_report_is_refreshed_when_the_cv_score_changes(self, application, cv_match, django_capture_on_commit_callbacks):
        cv_match(application, 60)
        scores.refresh(application)
        CandidateEvaluation.objects.filter(application=application).update(report_status="ready", report={"summary": "old", "recommendation": "maybe"})
        cv_match(application, 95)
        queue_report(summary="after the rescore", recommendation="strong_yes")
        with django_capture_on_commit_callbacks(execute=True):
            cv_scored.send_robust(sender=type(application), application=application)
        assert evaluation_of(application).report["summary"] == "after the rescore"

    def test_without_a_report_a_cv_score_change_does_not_call_the_model(self, application, cv_match, django_capture_on_commit_callbacks):
        cv_match(application, 60)
        with django_capture_on_commit_callbacks(execute=True):
            cv_scored.send_robust(sender=type(application), application=application)
        assert not chat_calls() and evaluation_of(application).report_status == "none"

    def test_an_unchanged_score_does_nothing(self, application, cv_match, django_capture_on_commit_callbacks):
        cv_match(application, 60)
        scores.refresh(application)
        CandidateEvaluation.objects.filter(application=application).update(report_status="ready", report={"summary": "keep"})
        with django_capture_on_commit_callbacks(execute=True):
            cv_scored.send_robust(sender=type(application), application=application)
        assert evaluation_of(application).report == {"summary": "keep"} and not chat_calls()


class TestWeightsChange:
    def plan(self, job, application_factory, cv_match, evaluated_session):
        made = []
        for cv, screening, technical in [(80, 70, 85), (60, 50, None), (90, None, None)]:
            application = application_factory(job)
            cv_match(application, cv)
            if screening:
                evaluated_session(application, "screening", screening)
            if technical:
                evaluated_session(application, "technical", technical)
            scores.refresh(application)
            made.append(application)
        return made

    def test_changing_the_weights_recomputes_every_candidate_in_the_background(self, clients, job, application_factory, cv_match, evaluated_session, django_capture_on_commit_callbacks):
        full, partial, cv_only = self.plan(job, application_factory, cv_match, evaluated_session)
        assert float(evaluation_of(full).composite_score) == 79.0
        with django_capture_on_commit_callbacks(execute=True):
            response = clients[MemberRole.ADMIN].put(f"/api/jobs/{job.pk}/evaluation-weights/", {"weight_cv": 100, "weight_screening": 0, "weight_technical": 0}, format="json")
        assert response.status_code == 200
        assert [float(evaluation_of(a).composite_score) for a in (full, partial, cv_only)] == [80.0, 60.0, 90.0]
        assert evaluation_of(full).weights_used["configured"] == {"cv": 100, "screening": 0, "technical": 0}  # visible as recalculated

    def test_the_policy_change_alone_recomputes_partial_candidates(self, clients, job, application_factory, cv_match, evaluated_session, django_capture_on_commit_callbacks):
        full, partial, _ = self.plan(job, application_factory, cv_match, evaluated_session)
        with django_capture_on_commit_callbacks(execute=True):
            clients[MemberRole.ADMIN].put(f"/api/jobs/{job.pk}/evaluation-weights/", {"missing_stage_policy": "zero"}, format="json")
        assert float(evaluation_of(partial).composite_score) == 33.0 and float(evaluation_of(full).composite_score) == 79.0  # (60*30 + 50*30)/100 + 0 for the missing technical stage

    def test_saving_the_same_weights_again_recomputes_nothing(self, clients, job, application_factory, cv_match, evaluated_session, django_capture_on_commit_callbacks, monkeypatch):
        self.plan(job, application_factory, cv_match, evaluated_session)
        called = []
        monkeypatch.setattr(recompute, "queue_recompute", lambda job_id: called.append(job_id))
        with django_capture_on_commit_callbacks(execute=True):
            clients[MemberRole.ADMIN].put(f"/api/jobs/{job.pk}/evaluation-weights/", {"weight_cv": 30, "weight_screening": 30, "weight_technical": 40}, format="json")
        assert called == []

    def test_decisions_are_untouched_and_ready_reports_are_regenerated_a_few_at_a_time(self, clients, job, application_factory, cv_match, evaluated_session, django_capture_on_commit_callbacks):
        full, partial, _ = self.plan(job, application_factory, cv_match, evaluated_session)
        clients[MemberRole.ADMIN].post(f"/api/applications/{full.pk}/decision/", {"decision": "selected", "notify": False}, format="json")
        CandidateEvaluation.objects.filter(application__in=[full, partial]).update(report_status="ready", report={"summary": "old", "recommendation": "yes"})
        with django_capture_on_commit_callbacks(execute=True):
            clients[MemberRole.ADMIN].put(f"/api/jobs/{job.pk}/evaluation-weights/", {"weight_cv": 10, "weight_screening": 10, "weight_technical": 80}, format="json")
        assert HRDecision.objects.count() == 1 and HRDecision.objects.get().decision == "selected"
        assert set(CandidateEvaluation.objects.filter(job=job, application__in=[full, partial]).values_list("report_status", flat=True)) == {"generating"}
        from ..services import report

        queue_report(), queue_report()
        with django_capture_on_commit_callbacks(execute=True):
            assert report.sweep()[1] == 2  # the sweep picks them up and the worker regenerates
        assert set(CandidateEvaluation.objects.filter(job=job, application__in=[full, partial]).values_list("report_status", flat=True)) == {"ready"}

    def test_a_job_with_no_applications_recomputes_to_zero(self, job):
        assert recompute.recompute_job(job.pk) == 0

    def test_recompute_updates_each_candidate_once_and_the_numbers_match_a_manual_refresh(self, job, application_factory, cv_match, evaluated_session):
        made = self.plan(job, application_factory, cv_match, evaluated_session)
        from ..models import EvaluationWeights

        EvaluationWeights.objects.filter(job=job).update(weight_cv=20, weight_screening=20, weight_technical=60)
        assert recompute.recompute_job(job.pk) == 3
        assert evaluation_of(made[0]).composite_score == Decimal("0.2") * 80 + Decimal("0.2") * 70 + Decimal("0.6") * 85

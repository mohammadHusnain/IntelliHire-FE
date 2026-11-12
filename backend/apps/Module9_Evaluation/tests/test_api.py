"""Weights, ranking, compare, the evaluation, the PDF (FR-52, FR-55, FR-56, UC-10 A3) and who may do what."""
import uuid
from datetime import timedelta

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from apps.common.choices import MemberRole
from apps.Module5_Foundation.models import ActivityEvent

from ..models import CandidateEvaluation, EvaluationWeights, HRDecision
from ..services import scores
from .conftest import queue_report

pytestmark = pytest.mark.django_db


@pytest.fixture
def outsider(member_factory, auth_client):
    return auth_client(member_factory(MemberRole.ADMIN))


def candidates(job, application_factory, cv_match, evaluated_session, plan):
    """Create applications with (cv, screening, technical) scores; returns them in the order given."""
    made = []
    for cv, screening, technical in plan:
        application = application_factory(job)
        if cv is not None:
            cv_match(application, cv)
        if screening is not None:
            evaluated_session(application, "screening", screening)
        if technical is not None:
            evaluated_session(application, "technical", technical)
        scores.refresh(application)
        made.append(application)
    return made


class TestWeights:
    url = "/api/jobs/{}/evaluation-weights/"

    def test_defaults_are_30_30_40_renormalise_and_created_on_first_access(self, clients, job):
        assert not EvaluationWeights.objects.exists()
        body = clients[MemberRole.VIEWER].get(self.url.format(job.pk)).json()
        assert (body["weight_cv"], body["weight_screening"], body["weight_technical"], body["missing_stage_policy"]) == (30, 30, 40, "renormalise")
        assert EvaluationWeights.objects.count() == 1

    def test_admin_and_hr_manager_can_change_them_and_it_is_logged(self, clients, job):
        response = clients[MemberRole.HR_MANAGER].put(self.url.format(job.pk), {"weight_cv": 20, "weight_screening": 30, "weight_technical": 50, "missing_stage_policy": "zero"}, format="json")
        assert response.status_code == 200 and response.json()["weight_technical"] == 50 and response.json()["missing_stage_policy"] == "zero"
        assert ActivityEvent.objects.filter(event_type="evaluation.weights_changed").count() == 1

    def test_a_partial_update_must_still_add_up_to_100(self, clients, job):
        assert clients[MemberRole.ADMIN].put(self.url.format(job.pk), {"weight_cv": 40}, format="json").status_code == 400
        ok = clients[MemberRole.ADMIN].put(self.url.format(job.pk), {"weight_cv": 40, "weight_technical": 30}, format="json")
        assert ok.status_code == 200 and ok.json()["weight_cv"] == 40

    @pytest.mark.parametrize("body", [{"weight_cv": 50, "weight_screening": 30, "weight_technical": 30}, {"weight_cv": -10, "weight_screening": 60, "weight_technical": 50}, {"weight_cv": 101, "weight_screening": 0, "weight_technical": 0}, {"missing_stage_policy": "maybe"}])
    def test_bad_weights_or_policy_are_400_and_nothing_changes(self, clients, job, body):
        assert clients[MemberRole.ADMIN].put(self.url.format(job.pk), body, format="json").status_code == 400
        assert not EvaluationWeights.objects.filter(job=job).exclude(weight_cv=30).exists()

    def test_recruiters_and_viewers_cannot_change_them(self, clients, job):
        for role in (MemberRole.RECRUITER, MemberRole.VIEWER):
            assert clients[role].put(self.url.format(job.pk), {"weight_cv": 30}, format="json").status_code == 403

    def test_another_companys_job_is_404(self, outsider, job):
        assert outsider.get(self.url.format(job.pk)).status_code == 404
        assert outsider.put(self.url.format(job.pk), {}, format="json").status_code == 404


class TestRanking:
    url = "/api/jobs/{}/evaluations/"

    def test_best_first_ties_to_the_earlier_submission_with_ranks(self, clients, job, application_factory, cv_match, evaluated_session):
        a, b, c = candidates(job, application_factory, cv_match, evaluated_session, [(60, None, None), (90, None, None), (60, None, None)])
        rows = clients[MemberRole.VIEWER].get(self.url.format(job.pk)).json()["results"]
        assert [r["application_id"] for r in rows] == [str(b.pk), str(a.pk), str(c.pk)] and [r["rank"] for r in rows] == [1, 2, 3]
        assert set(rows[0]) >= {"cv_score", "screening_score", "technical_score", "composite_score", "is_partial", "missing_stages", "report_status", "recommendation", "decision"}

    def test_filters_by_score_status_stage_and_partial(self, clients, job, application_factory, cv_match, evaluated_session):
        full, screened, cv_only = candidates(job, application_factory, cv_match, evaluated_session, [(80, 70, 85), (70, 60, None), (40, None, None)])
        get = lambda **q: {r["application_id"] for r in clients[MemberRole.VIEWER].get(self.url.format(job.pk), q).json()["results"]}  # noqa: E731
        assert get(min_score=60) == {str(full.pk), str(screened.pk)} and get(max_score=50) == {str(cv_only.pk)}
        assert get(stage="complete") == {str(full.pk)} and get(stage="technical") == {str(full.pk)}
        assert get(stage="screening") == {str(screened.pk)} and get(stage="cv") == {str(cv_only.pk)}
        assert get(partial="true") == {str(screened.pk), str(cv_only.pk)} and get(partial="false") == {str(full.pk)}
        screened.status = "interview"
        screened.save()
        assert get(status="interview") == {str(screened.pk)}

    def test_the_rank_is_within_the_filtered_set(self, clients, job, application_factory, cv_match, evaluated_session):
        candidates(job, application_factory, cv_match, evaluated_session, [(90, None, None), (80, None, None), (70, None, None)])
        rows = clients[MemberRole.VIEWER].get(self.url.format(job.pk), {"max_score": 85}).json()["results"]
        assert [r["rank"] for r in rows] == [1, 2]

    def test_pagination_and_the_current_decision(self, clients, job, application_factory, cv_match, evaluated_session):
        made = candidates(job, application_factory, cv_match, evaluated_session, [(s, None, None) for s in (90, 80, 70)])
        page = clients[MemberRole.VIEWER].get(self.url.format(job.pk), {"page_size": 2}).json()
        assert page["count"] == 3 and len(page["results"]) == 2 and page["next"]
        clients[MemberRole.ADMIN].post(f"/api/applications/{made[0].pk}/decision/", {"decision": "on_hold", "notify": False}, format="json")
        assert clients[MemberRole.VIEWER].get(self.url.format(job.pk)).json()["results"][0]["decision"] == "on_hold"

    @pytest.mark.parametrize("params", [{"min_score": "x"}, {"status": "nope"}, {"stage": "nope"}, {"partial": "maybe"}])
    def test_a_bad_filter_is_400(self, clients, job, params):
        response = clients[MemberRole.VIEWER].get(self.url.format(job.pk), params)
        assert response.status_code == 400 and response.json()["code"] == "invalid_filter"

    def test_queries_do_not_grow_with_the_number_of_candidates(self, clients, job, application_factory, cv_match, evaluated_session):
        client = clients[MemberRole.VIEWER]

        def count():
            with CaptureQueriesContext(connection) as queries:
                assert client.get(self.url.format(job.pk)).status_code == 200
            return len(queries)

        candidates(job, application_factory, cv_match, evaluated_session, [(60, 60, 60)] * 2)
        few = count()
        candidates(job, application_factory, cv_match, evaluated_session, [(70, None, 50)] * 10)
        assert count() == few

    def test_another_companys_job_is_404(self, outsider, job):
        assert outsider.get(self.url.format(job.pk)).status_code == 404


class TestCompare:
    url = "/api/jobs/{}/evaluations/compare/"

    def ids(self, *apps):
        return ",".join(str(a.pk) for a in apps)

    def test_two_to_four_candidates_side_by_side(self, clients, job, application_factory, cv_match, evaluated_session):
        a, b, c = candidates(job, application_factory, cv_match, evaluated_session, [(80, 70, 85), (60, 50, None), (40, None, None)])
        CandidateEvaluation.objects.filter(application=a).update(report_status="ready", report={"strengths": ["Python"], "weaknesses": ["React"], "recommendation": "yes"})
        body = clients[MemberRole.VIEWER].get(self.url.format(job.pk), {"applications": self.ids(a, b, c)}).json()
        first, second, third = body["applications"]
        assert first["scores"] == {"cv": 80.0, "screening": 70.0, "technical": 85.0, "composite": 79.0} and first["strengths"] == ["Python"] and first["recommendation"] == "yes"
        assert first["matched_skills"] == ["Python", "Django"] and first["missing_skills"] == ["React"] and first["is_partial"] is False
        assert second["is_partial"] and second["missing_stages"] == ["technical"] and third["scores"]["screening"] is None

    def test_a_candidate_without_an_evaluation_is_included_with_empty_scores(self, clients, job, application_factory, cv_match, evaluated_session):
        a, = candidates(job, application_factory, cv_match, evaluated_session, [(80, None, None)])
        blank = application_factory(job)
        body = clients[MemberRole.VIEWER].get(self.url.format(job.pk), {"applications": self.ids(a, blank)}).json()
        assert body["applications"][1]["scores"] is None and body["applications"][1]["is_partial"] is True

    @pytest.mark.parametrize("count", [0, 1, 5])
    def test_fewer_than_two_or_more_than_four_is_400(self, clients, job, application_factory, count):
        ids = ",".join(str(application_factory(job).pk) for _ in range(count))
        assert clients[MemberRole.VIEWER].get(self.url.format(job.pk), {"applications": ids}).status_code == 400

    def test_a_malformed_id_is_400_and_duplicates_count_once(self, clients, job, application_factory):
        a = application_factory(job)
        assert clients[MemberRole.VIEWER].get(self.url.format(job.pk), {"applications": f"{a.pk},not-an-id"}).json()["code"] == "invalid_count"
        assert clients[MemberRole.VIEWER].get(self.url.format(job.pk), {"applications": f"{a.pk},{a.pk}"}).status_code == 400

    def test_an_application_of_another_job_is_404(self, clients, job, application_factory, team, job_factory):
        company, users = team
        other = job_factory(company, users[MemberRole.ADMIN], status="open")
        a, b = application_factory(job), application_factory(other)
        assert clients[MemberRole.VIEWER].get(self.url.format(job.pk), {"applications": self.ids(a, b)}).status_code == 404

    def test_another_companys_ids_or_job_are_404(self, outsider, clients, job, application_factory):
        a, b = application_factory(job), application_factory(job)
        assert outsider.get(self.url.format(job.pk), {"applications": self.ids(a, b)}).status_code == 404
        assert clients[MemberRole.VIEWER].get(self.url.format(job.pk), {"applications": f"{uuid.uuid4()},{a.pk}"}).status_code == 404


class TestEvaluationDetail:
    def url(self, application, tail=""):
        return f"/api/applications/{application.pk}/evaluation/{tail}"

    def test_scores_report_and_decisions_in_one_place(self, clients, scored, evaluation):
        CandidateEvaluation.objects.filter(pk=evaluation.pk).update(report_status="ready", report={"summary": "Fine", "recommendation": "yes"}, generated_at=timezone.now())
        clients[MemberRole.ADMIN].post(f"/api/applications/{scored.pk}/decision/", {"decision": "selected", "notify": False}, format="json")
        body = clients[MemberRole.VIEWER].get(self.url(scored)).json()
        assert body["scores"] == {"cv": 80.0, "screening": 70.0, "technical": 85.0, "composite": 79.0} and body["is_partial"] is False
        assert body["report"]["summary"] == "Fine" and body["report_status"] == "ready" and "support, not replace" in body["ai_disclaimer"]
        assert body["weights_used"]["configured"] == {"cv": 30, "screening": 30, "technical": 40}
        assert body["current_decision"]["decision"] == "selected" and len(body["decisions"]) == 1

    def test_before_anything_is_scored_it_is_404_not_evaluated(self, clients, application):
        response = clients[MemberRole.VIEWER].get(self.url(application))
        assert response.status_code == 404 and response.json()["code"] == "not_evaluated"

    def test_another_companys_application_is_404(self, outsider, scored, evaluation):
        for tail in ("", "pdf/"):
            assert outsider.get(self.url(scored, tail)).status_code == 404
        assert outsider.post(self.url(scored, "generate/"), {}, format="json").status_code == 404


class TestGenerate:
    def test_it_needs_scores_first(self, clients, application):
        response = clients[MemberRole.RECRUITER].post(f"/api/applications/{application.pk}/evaluation/generate/")
        assert response.status_code == 409 and response.json()["code"] == "no_scores"

    def test_a_partial_candidate_can_be_reported_on(self, clients, application, cv_match, django_capture_on_commit_callbacks):
        cv_match(application, 70)
        scores.refresh(application)
        queue_report()
        with django_capture_on_commit_callbacks(execute=True):
            assert clients[MemberRole.RECRUITER].post(f"/api/applications/{application.pk}/evaluation/generate/").status_code == 202
        row = CandidateEvaluation.objects.get(application=application)
        assert row.report_status == "ready" and row.report["recommendation"] == "yes"

    def test_viewers_cannot(self, clients, scored, evaluation):
        assert clients[MemberRole.VIEWER].post(f"/api/applications/{scored.pk}/evaluation/generate/").status_code == 403


class TestPdf:
    def test_it_is_a_real_pdf_with_a_file_name_built_on_request(self, clients, scored, evaluation):
        clients[MemberRole.ADMIN].post(f"/api/applications/{scored.pk}/decision/", {"decision": "selected", "notify": False}, format="json")
        response = clients[MemberRole.VIEWER].get(f"/api/applications/{scored.pk}/evaluation/pdf/")
        assert response.status_code == 200 and response["Content-Type"] == "application/pdf"
        assert response["Content-Disposition"] == f'attachment; filename="evaluation-{scored.reference}.pdf"'
        assert response.content[:5] == b"%PDF-" and len(response.content) > 1500

    def test_the_text_is_in_the_pdf(self, clients, scored, evaluation):
        from pypdf import PdfReader
        import io

        CandidateEvaluation.objects.filter(pk=evaluation.pk).update(report_status="ready", report={"summary": "Strong fit overall", "strengths": ["Solid Python"], "weaknesses": [], "recommendation": "yes"})
        clients[MemberRole.ADMIN].post(f"/api/applications/{scored.pk}/decision/", {"decision": "on_hold", "notify": False}, format="json")
        reader = PdfReader(io.BytesIO(clients[MemberRole.VIEWER].get(f"/api/applications/{scored.pk}/evaluation/pdf/").content))
        text = " ".join(page.extract_text() for page in reader.pages)
        assert len(reader.pages) <= 2
        for expected in ("Candidate evaluation", scored.reference, "79.0", "Strong fit overall", "Solid Python", "on_hold", "support, not replace", "Generated"):
            assert expected in text, expected

    def test_a_failed_report_is_said_plainly(self, clients, scored, evaluation):
        from pypdf import PdfReader
        import io

        CandidateEvaluation.objects.filter(pk=evaluation.pk).update(report_status="failed")
        text = PdfReader(io.BytesIO(clients[MemberRole.VIEWER].get(f"/api/applications/{scored.pk}/evaluation/pdf/").content)).pages[0].extract_text()
        assert "manual review" in text

    def test_it_is_not_stored_and_404s_without_an_evaluation(self, clients, application):
        assert clients[MemberRole.VIEWER].get(f"/api/applications/{application.pk}/evaluation/pdf/").status_code == 404


class TestApplicationBlocks:
    def test_the_company_side_application_shows_the_composite_and_recommendation(self, clients, scored, evaluation):
        CandidateEvaluation.objects.filter(pk=evaluation.pk).update(report_status="ready", report={"recommendation": "yes"})
        block = clients[MemberRole.VIEWER].get(f"/api/applications/{scored.pk}/").json()["evaluation"]
        assert block == {"composite_score": 79.0, "cv_score": 80.0, "screening_score": 70.0, "technical_score": 85.0, "is_partial": False, "report_status": "ready", "recommendation": "yes"}
        row = clients[MemberRole.VIEWER].get(f"/api/jobs/{scored.job_id}/applications/").json()["results"][0]
        assert row["evaluation"]["composite_score"] == 79.0

    def test_no_evaluation_means_null(self, clients, application):
        assert clients[MemberRole.VIEWER].get(f"/api/applications/{application.pk}/").json()["evaluation"] is None

    def test_the_list_costs_the_same_queries_however_many_candidates(self, clients, job, application_factory, cv_match, evaluated_session):
        url = f"/api/jobs/{job.pk}/applications/"

        def count():
            with CaptureQueriesContext(connection) as queries:
                assert clients[MemberRole.VIEWER].get(url).status_code == 200
            return len(queries)

        candidates(job, application_factory, cv_match, evaluated_session, [(60, 60, 60)] * 2)
        few = count()
        candidates(job, application_factory, cv_match, evaluated_session, [(70, 50, None)] * 10)
        assert count() == few

import uuid
from unittest import mock

import pytest

from apps.common.choices import MemberRole
from apps.Module4_ApplicationManagement.models import Application
from apps.Module5_Foundation.ai.providers.fake import FakeProvider

from ..models import CVAnalysis, CVMatch, JobScreeningConfig
from ..services import pipeline
from .conftest import parsed_cv

pytestmark = pytest.mark.django_db
ALL_SKILLS = ["Python", "Django", "React"]
NOTHING = dict(technical_skills=[], experience=[], total_experience_years=0, education=[])


def url(job, suffix):
    return f"/api/jobs/{job.pk}/{suffix}/"


@pytest.fixture
def scored(analysed):
    """Three analysed applications: high, middle and low."""
    high = analysed(parsed_cv(technical_skills=ALL_SKILLS), full_name="High Scorer")
    middle = analysed(parsed_cv(experience=[], total_experience_years=0), full_name="Middle Scorer")
    low = analysed(parsed_cv(**NOTHING), full_name="Low Scorer")
    return high, middle, low


class TestConfig:
    def test_defaults_are_created_on_first_read(self, clients, job):
        body = clients[MemberRole.VIEWER].get(url(job, "screening-config")).json()
        assert body["auto_analyse"] is True and body["shortlist_threshold"] == 70 and body["auto_shortlist"] is False
        assert (body["weight_skills"], body["weight_experience"], body["weight_education"], body["weight_semantic"]) == (50, 25, 15, 10)
        assert body["warnings"] == [] and JobScreeningConfig.objects.filter(job=job).count() == 1

    def test_a_job_without_required_skills_carries_a_warning(self, clients, job):
        job.required_skills = []
        job.save()
        assert "no required skills" in clients[MemberRole.ADMIN].get(url(job, "screening-config")).json()["warnings"][0]

    @pytest.mark.parametrize("role", [MemberRole.ADMIN, MemberRole.HR_MANAGER])
    def test_managers_can_change_it(self, clients, job, role):
        response = clients[role].put(url(job, "screening-config"), {"shortlist_threshold": 80, "auto_shortlist": True}, format="json")
        assert response.status_code == 200 and response.json()["shortlist_threshold"] == 80
        config = JobScreeningConfig.objects.get(job=job)
        assert config.auto_shortlist is True and config.updated_by is not None

    @pytest.mark.parametrize("role", [MemberRole.RECRUITER, MemberRole.VIEWER])
    def test_others_cannot(self, clients, job, role):
        assert clients[role].put(url(job, "screening-config"), {"shortlist_threshold": 80}, format="json").status_code == 403

    def test_weights_must_total_100(self, clients, job):
        response = clients[MemberRole.ADMIN].put(url(job, "screening-config"), {"weight_skills": 60}, format="json")
        assert response.status_code == 400 and "add up to 100" in str(response.json())
        ok = clients[MemberRole.ADMIN].put(url(job, "screening-config"), {"weight_skills": 60, "weight_experience": 15}, format="json")
        assert ok.status_code == 200

    @pytest.mark.parametrize("body", [{"shortlist_threshold": 101}, {"shortlist_threshold": -1}, {"weight_skills": 150}, {"auto_analyse": "maybe"}])
    def test_invalid_values_are_a_400(self, clients, job, body):
        assert clients[MemberRole.ADMIN].put(url(job, "screening-config"), body, format="json").status_code == 400

    def test_the_database_also_refuses_weights_that_do_not_total_100(self, job):
        from django.db import IntegrityError, transaction

        with pytest.raises(IntegrityError), transaction.atomic():
            JobScreeningConfig.objects.create(job=job, weight_skills=90)

    def test_changing_weights_rescores_the_job(self, clients, job, scored, django_capture_on_commit_callbacks):
        high, middle, low = scored
        before = CVMatch.objects.get(application=middle).score
        with django_capture_on_commit_callbacks(execute=True):
            clients[MemberRole.ADMIN].put(
                url(job, "screening-config"),
                {"weight_skills": 100, "weight_experience": 0, "weight_education": 0, "weight_semantic": 0}, format="json",
            )  # fmt: skip
        after = CVMatch.objects.get(application=middle)
        assert float(after.score) == 66.67 and after.score != before and after.weights_used["skills"] == 100

    def test_changing_only_the_threshold_does_not_rescore(self, clients, job, scored, django_capture_on_commit_callbacks):
        with mock.patch("apps.Module6_CVAnalysis.tasks.rescore_job.delay") as delay, django_capture_on_commit_callbacks(execute=True):
            clients[MemberRole.ADMIN].put(url(job, "screening-config"), {"shortlist_threshold": 50}, format="json")
        delay.assert_not_called()


class TestRun:
    def test_missing_queues_only_cvs_without_a_finished_analysis(self, clients, job, analysed, application_factory, django_capture_on_commit_callbacks):
        done = analysed()
        never = application_factory(job, queued=False)
        failed = application_factory(job)
        unreadable = application_factory(job)
        CVAnalysis.objects.filter(application=failed).update(status="failed", attempts=3, failure_reason="x")
        CVAnalysis.objects.filter(application=unreadable).update(status="manual_review")
        with mock.patch("apps.Module6_CVAnalysis.tasks.analyse_cv.delay") as delay, django_capture_on_commit_callbacks(execute=True):
            response = clients[MemberRole.RECRUITER].post(url(job, "cv-screening/run"), {}, format="json")
        assert response.status_code == 202 and response.json() == {"mode": "missing", "queued": 2}
        assert {call.args[0] for call in delay.call_args_list} == {str(never.pk), str(failed.pk)}
        statuses = dict(CVAnalysis.objects.values_list("application_id", "status"))
        assert statuses[done.pk] == "completed" and statuses[unreadable.pk] == "manual_review" and statuses[failed.pk] == "queued"
        assert JobScreeningConfig.objects.get(job=job).run_requested_at is not None

    def test_full_reads_every_cv_again_except_one_being_processed(self, clients, job, analysed, application_factory):
        done = analysed()
        busy = application_factory(job)
        CVAnalysis.objects.filter(application=busy).update(status="processing")
        response = clients[MemberRole.ADMIN].post(url(job, "cv-screening/run"), {"mode": "full"}, format="json")
        assert response.json()["queued"] == 1
        assert CVAnalysis.objects.get(application=done).status == "queued" and CVAnalysis.objects.get(application=busy).status == "processing"

    def test_rescore_recomputes_without_reading_cvs(self, clients, job, scored, django_capture_on_commit_callbacks):
        job.required_skills = ["Python"]
        job.save()
        FakeProvider.reset()
        with django_capture_on_commit_callbacks(execute=True):
            response = clients[MemberRole.HR_MANAGER].post(url(job, "cv-screening/run"), {"mode": "rescore"}, format="json")
        assert response.json() == {"mode": "rescore", "queued": 3}
        assert all(call["method"] == "embed" for call in FakeProvider.calls)
        assert CVMatch.objects.get(application=scored[1]).skills_score == 100

    def test_a_job_without_applications_is_a_409(self, clients, job):
        response = clients[MemberRole.ADMIN].post(url(job, "cv-screening/run"), {}, format="json")
        assert response.status_code == 409 and response.json()["code"] == "no_applications"

    def test_viewers_cannot_start_a_run_and_a_bad_mode_is_a_400(self, clients, job, application_factory):
        application_factory(job)
        assert clients[MemberRole.VIEWER].post(url(job, "cv-screening/run"), {}, format="json").status_code == 403
        assert clients[MemberRole.ADMIN].post(url(job, "cv-screening/run"), {"mode": "everything"}, format="json").status_code == 400

    def test_nothing_to_do_queues_nothing(self, clients, job, analysed):
        analysed()
        assert clients[MemberRole.ADMIN].post(url(job, "cv-screening/run"), {}, format="json").json()["queued"] == 0
        assert JobScreeningConfig.objects.get(job=job).run_requested_at is None


class TestProgress:
    def test_counts_every_state(self, clients, job, analysed, application_factory):
        analysed()
        application_factory(job, queued=False)
        application_factory(job)
        waiting = application_factory(job)
        CVAnalysis.objects.filter(application=waiting).update(failure_reason="Waiting: the daily analysis limit was reached")
        unreadable = application_factory(job, cv_text="short")
        pipeline.analyse(unreadable.pk)
        body = clients[MemberRole.VIEWER].get(url(job, "cv-screening")).json()
        assert body == {
            "total_applications": 5, "not_analysed": 1, "queued": 2, "processing": 0, "completed": 1, "failed": 0,
            "manual_review": 1, "paused": 1, "stale_scores": 0, "in_progress": True, "percent_done": 50,
        }  # fmt: skip

    def test_scores_go_stale_when_the_job_changes(self, clients, job, scored):
        assert clients[MemberRole.ADMIN].get(url(job, "cv-screening")).json()["stale_scores"] == 0
        job.min_experience_years = 9
        job.save()
        body = clients[MemberRole.ADMIN].get(url(job, "cv-screening")).json()
        assert body["stale_scores"] == 3 and body["in_progress"] is False and body["percent_done"] == 100

    def test_an_empty_job(self, clients, job):
        body = clients[MemberRole.ADMIN].get(url(job, "cv-screening")).json()
        assert body["total_applications"] == 0 and body["percent_done"] == 100 and body["in_progress"] is False


class TestRanking:
    def test_best_first_with_unscored_last(self, clients, job, scored, application_factory):  # TC-25
        application_factory(job, full_name="Not Yet")
        rows = clients[MemberRole.VIEWER].get(url(job, "ranking")).json()["results"]
        assert [r["full_name"] for r in rows] == ["High Scorer", "Middle Scorer", "Low Scorer", "Not Yet"]
        assert [r["rank"] for r in rows] == [1, 2, 3, 4]
        scores = [r["score"] for r in rows[:3]]
        assert scores == sorted(scores, reverse=True) and rows[3]["score"] is None and rows[3]["analysis_status"] == "queued"
        assert set(rows[0]) == {"rank", "id", "reference", "full_name", "email", "status", "submitted_at", "score", "skills_score",
                                "experience_score", "education_score", "semantic_score", "cv_label", "analysis_status", "stale"}  # fmt: skip

    def test_the_ranking_updates_when_a_new_cv_is_scored(self, clients, job, scored, analysed):
        analysed(parsed_cv(technical_skills=ALL_SKILLS, total_experience_years=9), full_name="Newcomer")
        names = [r["full_name"] for r in clients[MemberRole.ADMIN].get(url(job, "ranking")).json()["results"]]
        assert names.index("Newcomer") < names.index("Middle Scorer")

    def test_ties_go_to_the_earlier_submission(self, clients, job, analysed):
        first = analysed(full_name="Earlier")
        second = analysed(full_name="Later")
        assert first.cv_match.score == second.cv_match.score
        assert [r["full_name"] for r in clients[MemberRole.ADMIN].get(url(job, "ranking")).json()["results"]] == ["Earlier", "Later"]

    def test_labels_follow_the_threshold(self, clients, job, scored):
        rows = {r["full_name"]: r for r in clients[MemberRole.ADMIN].get(url(job, "ranking")).json()["results"]}
        assert rows["High Scorer"]["cv_label"] == "meets_threshold" and rows["Low Scorer"]["cv_label"] == "not_shortlisted"
        assert rows["High Scorer"]["status"] == "under_review"

    def test_filters(self, clients, job, scored, application_factory):
        application_factory(job, queued=False, full_name="Untouched")
        client = clients[MemberRole.ADMIN]
        assert [r["full_name"] for r in client.get(url(job, "ranking"), {"min_score": 70}).json()["results"]] == ["High Scorer"]
        assert client.get(url(job, "ranking"), {"analysis_status": "completed"}).json()["count"] == 3
        assert [r["full_name"] for r in client.get(url(job, "ranking"), {"analysis_status": "none"}).json()["results"]] == ["Untouched"]
        assert client.get(url(job, "ranking"), {"status": "under_review"}).json()["count"] == 3
        assert client.get(url(job, "ranking"), {"status": "submitted"}).json()["count"] == 1

    @pytest.mark.parametrize("params", [{"min_score": "abc"}, {"min_score": 101}, {"status": "hired"}, {"analysis_status": "done"}])
    def test_bad_filters_are_a_400(self, clients, job, params):
        assert clients[MemberRole.ADMIN].get(url(job, "ranking"), params).status_code == 400

    def test_paging_keeps_the_rank(self, clients, job, analysed):
        for _ in range(3):
            analysed()
        page = clients[MemberRole.ADMIN].get(url(job, "ranking"), {"page": 2, "page_size": 2}).json()
        assert page["count"] == 3 and [r["rank"] for r in page["results"]] == [3]

    def test_stale_rows_are_marked(self, clients, job, scored):
        job.education_level = "master"
        job.save()
        assert all(r["stale"] for r in clients[MemberRole.ADMIN].get(url(job, "ranking")).json()["results"])

    def test_the_list_costs_the_same_number_of_queries_for_any_number_of_rows(self, clients, job, analysed):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        analysed()
        client = clients[MemberRole.ADMIN]
        with CaptureQueriesContext(connection) as one:
            client.get(url(job, "ranking"))
        for _ in range(4):
            analysed()
        with CaptureQueriesContext(connection) as five:
            client.get(url(job, "ranking"))
        assert len(five) == len(one)


class TestThreshold:
    def test_dry_run_changes_nothing_and_reports_what_would_happen(self, clients, job, scored):
        response = clients[MemberRole.HR_MANAGER].post(url(job, "shortlist/apply-threshold"), {"threshold": 70, "dry_run": True}, format="json")
        assert response.status_code == 200 and response.json() == {"threshold": 70, "would_shortlist": 1, "at_or_above": 1, "below": 2, "scored": 3}
        assert not Application.objects.filter(status="shortlisted").exists()
        assert JobScreeningConfig.objects.get(job=job).shortlist_threshold == 70

    def test_applying_shortlists_exactly_those_at_or_above_and_rejects_nobody(self, clients, job, scored, team):  # TC-26
        high, middle, low = scored
        _, users = team
        response = clients[MemberRole.ADMIN].post(url(job, "shortlist/apply-threshold"), {"threshold": 70}, format="json")
        assert response.json() == {"threshold": 70, "shortlisted": 1}
        statuses = dict(Application.objects.values_list("pk", "status"))
        assert statuses[high.pk] == "shortlisted" and statuses[middle.pk] == "under_review" and statuses[low.pk] == "under_review"
        last = high.status_history.last()
        assert (last.from_status, last.to_status, last.source, last.changed_by) == ("under_review", "shortlisted", "hr", users[MemberRole.ADMIN])
        assert "threshold" in last.note

    def test_exactly_at_the_threshold_counts(self, clients, job, analysed):
        application = analysed()
        CVMatch.objects.filter(application=application).update(score=70)
        assert clients[MemberRole.ADMIN].post(url(job, "shortlist/apply-threshold"), {"threshold": 70}, format="json").json()["shortlisted"] == 1

    def test_the_threshold_is_saved_and_the_saved_one_is_the_default(self, clients, job, scored):
        client = clients[MemberRole.ADMIN]
        client.post(url(job, "shortlist/apply-threshold"), {"threshold": 0}, format="json")
        assert JobScreeningConfig.objects.get(job=job).shortlist_threshold == 0
        assert Application.objects.filter(status="shortlisted").count() == 3
        assert client.post(url(job, "shortlist/apply-threshold"), {}, format="json").json() == {"threshold": 0, "shortlisted": 0}

    def test_applications_a_person_moved_elsewhere_are_left_alone(self, clients, job, scored):
        high, _, _ = scored
        Application.objects.filter(pk=high.pk).update(status="on_hold")
        assert clients[MemberRole.ADMIN].post(url(job, "shortlist/apply-threshold"), {"threshold": 70}, format="json").json()["shortlisted"] == 0
        assert Application.objects.get(pk=high.pk).status == "on_hold"

    def test_applying_twice_shortlists_nobody_twice(self, clients, job, scored):
        client = clients[MemberRole.ADMIN]
        client.post(url(job, "shortlist/apply-threshold"), {"threshold": 70}, format="json")
        assert client.post(url(job, "shortlist/apply-threshold"), {"threshold": 70}, format="json").json()["shortlisted"] == 0
        assert scored[0].status_history.filter(to_status="shortlisted").count() == 1

    def test_unscored_and_unreadable_cvs_are_never_shortlisted_by_threshold(self, clients, job, application_factory):
        unreadable = application_factory(job, cv_text="short")
        pipeline.analyse(unreadable.pk)
        assert clients[MemberRole.ADMIN].post(url(job, "shortlist/apply-threshold"), {"threshold": 0}, format="json").json()["shortlisted"] == 0

    @pytest.mark.parametrize("role", [MemberRole.RECRUITER, MemberRole.VIEWER])
    def test_only_managers_may_apply_it(self, clients, job, role):
        assert clients[role].post(url(job, "shortlist/apply-threshold"), {"threshold": 70}, format="json").status_code == 403

    @pytest.mark.parametrize("body", [{"threshold": 101}, {"threshold": -5}, {"threshold": "high"}, {"dry_run": "perhaps"}])
    def test_invalid_input_is_a_400(self, clients, job, body):
        assert clients[MemberRole.ADMIN].post(url(job, "shortlist/apply-threshold"), body, format="json").status_code == 400

    def test_one_batch_whatever_the_number_of_candidates(self, clients, job, analysed):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        analysed(parsed_cv(technical_skills=ALL_SKILLS))
        client = clients[MemberRole.ADMIN]
        with CaptureQueriesContext(connection) as one:
            client.post(url(job, "shortlist/apply-threshold"), {"threshold": 70}, format="json")
        for _ in range(4):
            analysed(parsed_cv(technical_skills=ALL_SKILLS))
        with CaptureQueriesContext(connection) as four:
            client.post(url(job, "shortlist/apply-threshold"), {"threshold": 70}, format="json")
        assert len(four) == len(one)


class TestAnalysisDetail:
    def test_the_detail_shows_what_was_read_and_how_it_scored(self, clients, analysed):
        application = analysed(parsed_cv(experience=[], total_experience_years=0))
        body = clients[MemberRole.VIEWER].get(f"/api/applications/{application.pk}/cv-analysis/").json()
        assert body["status"] == "completed" and body["cv_label"] == "not_shortlisted" and body["flags"] == []
        assert body["parsed"]["technical_skills"] == ["Python", "Django", "PostgreSQL"]
        match = body["match"]
        assert match["matched_skills"] == ["Python", "Django"] and match["missing_skills"] == ["React"] and match["stale"] is False
        assert match["explanation"] == "A solid match." and match["explanation_is_ai_generated"] is True
        assert "support, not replace" in body["notice"] and "embedding" not in body and "embedding" not in match

    def test_a_cv_that_was_never_analysed_is_a_clear_404(self, clients, application_factory, job):
        application = application_factory(job, queued=False)
        response = clients[MemberRole.ADMIN].get(f"/api/applications/{application.pk}/cv-analysis/")
        assert response.status_code == 404 and response.json()["code"] == "not_analysed"

    def test_manual_review_shows_the_reason_and_no_match(self, clients, application_factory, job):
        application = application_factory(job, cv_text="short")
        pipeline.analyse(application.pk)
        body = clients[MemberRole.ADMIN].get(f"/api/applications/{application.pk}/cv-analysis/").json()
        assert body["status"] == "manual_review" and body["failure_reason"] == "Scanned or unreadable CV" and body["match"] is None
        assert body["cv_label"] == "manual_review"

    def test_rerun(self, clients, analysed):
        application = analysed()
        with mock.patch("apps.Module6_CVAnalysis.tasks.analyse_cv.delay"):
            assert clients[MemberRole.RECRUITER].post(f"/api/applications/{application.pk}/cv-analysis/rerun/").status_code == 202
        assert CVAnalysis.objects.get(application=application).status == "queued"
        assert clients[MemberRole.VIEWER].post(f"/api/applications/{application.pk}/cv-analysis/rerun/").status_code == 403

    def test_rerun_while_processing_is_a_409(self, clients, application_factory, job):
        application = application_factory(job)
        CVAnalysis.objects.filter(application=application).update(status="processing")
        response = clients[MemberRole.ADMIN].post(f"/api/applications/{application.pk}/cv-analysis/rerun/")
        assert response.status_code == 409 and response.json()["code"] == "analysis_in_progress"


class TestIsolationAndAccess:
    @pytest.fixture
    def outsider(self, member_factory, auth_client):
        return auth_client(member_factory(MemberRole.ADMIN))

    def test_another_company_gets_404_everywhere_and_changes_nothing(self, outsider, job, analysed):
        application = analysed()
        calls = [
            ("get", url(job, "screening-config"), None), ("put", url(job, "screening-config"), {"shortlist_threshold": 1}),
            ("get", url(job, "cv-screening"), None), ("post", url(job, "cv-screening/run"), {"mode": "full"}),
            ("get", url(job, "ranking"), None), ("post", url(job, "shortlist/apply-threshold"), {"threshold": 0}),
            ("get", f"/api/applications/{application.pk}/cv-analysis/", None), ("post", f"/api/applications/{application.pk}/cv-analysis/rerun/", None),
        ]  # fmt: skip
        for method, path, body in calls:
            assert getattr(outsider, method)(path, body, format="json").status_code == 404, path
        application.refresh_from_db()
        assert application.status == "under_review" and CVAnalysis.objects.get().status == "completed"

    def test_unknown_ids_are_404(self, clients):
        client = clients[MemberRole.ADMIN]
        assert client.get(f"/api/jobs/{uuid.uuid4()}/ranking/").status_code == 404
        assert client.get(f"/api/applications/{uuid.uuid4()}/cv-analysis/").status_code == 404

    def test_candidates_and_anonymous_callers_are_kept_out(self, api_client, auth_client, user_factory, job):
        assert api_client.get(url(job, "ranking")).status_code == 401
        assert auth_client(user_factory()).get(url(job, "ranking")).status_code == 403


class TestApplicationEndpointsGainCvFields:
    def test_list_and_detail_show_score_and_label(self, clients, job, scored):
        client = clients[MemberRole.VIEWER]
        rows = {r["full_name"]: r for r in client.get(f"/api/jobs/{job.pk}/applications/").json()["results"]}
        assert rows["High Scorer"]["cv_label"] == "meets_threshold" and rows["High Scorer"]["cv_score"] >= 70
        detail = client.get(f"/api/applications/{scored[2].pk}/").json()
        assert detail["cv_label"] == "not_shortlisted" and detail["cv_score"] < 70
        assert [h["source"] for h in detail["status_history"]] == ["system", "system"]

    def test_sorting_by_score_puts_unscored_last_and_filtering_by_minimum_works(self, clients, job, scored, application_factory):
        application_factory(job, queued=False, full_name="Unscored")
        client = clients[MemberRole.ADMIN]
        names = [r["full_name"] for r in client.get(f"/api/jobs/{job.pk}/applications/", {"ordering": "-cv_score"}).json()["results"]]
        assert names == ["High Scorer", "Middle Scorer", "Low Scorer", "Unscored"]
        assert [r["full_name"] for r in client.get("/api/applications/", {"min_cv_score": 70}).json()["results"]] == ["High Scorer"]
        assert client.get("/api/applications/", {"min_cv_score": 500}).status_code == 400

    def test_the_application_list_does_not_cost_a_query_per_row(self, clients, job, analysed):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        analysed()
        client = clients[MemberRole.ADMIN]
        with CaptureQueriesContext(connection) as one:
            client.get("/api/applications/")
        for _ in range(4):
            analysed()
        with CaptureQueriesContext(connection) as five:
            client.get("/api/applications/")
        assert len(five) == len(one)

    def test_shortlisting_by_hand_shows_the_shortlisted_label(self, clients, analysed):
        application = analysed()
        clients[MemberRole.RECRUITER].patch(f"/api/applications/{application.pk}/status/", {"status": "shortlisted"}, format="json")
        assert clients[MemberRole.ADMIN].get(f"/api/applications/{application.pk}/").json()["cv_label"] == "shortlisted"

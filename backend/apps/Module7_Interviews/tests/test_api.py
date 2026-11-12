"""The company side: reading interviews, resend, extend, cancel, evaluate again, and who may do what."""
import uuid
from datetime import timedelta

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from apps.common.choices import MemberRole
from apps.Module5_Foundation.models import ActivityEvent, OutboundEmail

from ..models import InterviewSession
from .conftest import answer_turns

pytestmark = pytest.mark.django_db
PUBLIC = "/api/public/interviews/"


def sid(session):
    return f"/api/interviews/{session.pk}/"


@pytest.fixture
def outsider(member_factory, auth_client):
    return auth_client(member_factory(MemberRole.ADMIN))


class TestReading:
    def test_the_applications_interviews_newest_first_with_counts(self, clients, application, session_factory):
        old = session_factory(application, status="cancelled")
        new = session_factory(application, status="invited")
        answer_turns(new, 2)
        rows = clients[MemberRole.VIEWER].get(f"/api/applications/{application.pk}/interviews/").json()
        assert [r["id"] for r in rows] == [str(new.pk), str(old.pk)]
        assert rows[0]["answered_count"] == 2 and rows[0]["overall_score"] is None and rows[0]["recommendation"] is None

    def test_the_detail_is_the_transcript_with_scores_and_the_disclaimer(self, clients, application, session_factory):
        session = session_factory(application, status="evaluated", overall_score=80, recommendation="advance", report={"summary": "Good"})
        answer_turns(session, 3, score=8)
        body = clients[MemberRole.VIEWER].get(sid(session)).json()
        assert (body["overall_score"], body["recommendation"], body["report"]["summary"]) == (80.0, "advance", "Good")
        assert [t["index"] for t in body["turns"]] == [1, 2, 3]
        first = body["turns"][0]
        assert first["answer_text"] == "Answer 1" and first["score"] == 8.0 and first["feedback"] == "ok" and first["criteria"] == {"role_alignment": 8.0}
        assert "AI" in body["ai_disclaimer"] and "token" not in str(body).lower().replace("token_hash", "")
        assert session.raw_token not in str(body)

    def test_an_unevaluated_detail_has_empty_scores(self, clients, application, session):
        body = clients[MemberRole.VIEWER].get(sid(session)).json()
        assert body["turns"] == [] and body["overall_score"] is None and body["report"] == {}

    def test_the_job_list_filters_and_pages(self, clients, application_factory, job, session_factory):
        statuses = ["invited", "completed", "evaluated", "completed"]
        for status in statuses:
            session_factory(application_factory(job), status=status)
        client = clients[MemberRole.RECRUITER]
        url = f"/api/jobs/{job.pk}/interviews/"
        assert client.get(url).json()["count"] == 4
        assert client.get(url, {"status": "completed"}).json()["count"] == 2
        assert client.get(url, {"kind": "screening", "status": "invited"}).json()["count"] == 1
        assert client.get(url, {"kind": "technical"}).json()["count"] == 0
        page = client.get(url, {"page_size": 2}).json()
        assert len(page["results"]) == 2 and page["next"]

    @pytest.mark.parametrize("params", [{"kind": "nope"}, {"status": "nope"}])
    def test_an_unknown_filter_is_400(self, clients, job, params):
        response = clients[MemberRole.RECRUITER].get(f"/api/jobs/{job.pk}/interviews/", params)
        assert response.status_code == 400 and response.json()["code"] == "invalid_filter"

    def test_queries_do_not_grow_with_the_number_of_interviews(self, clients, application_factory, job, session_factory):
        client, url = clients[MemberRole.RECRUITER], f"/api/jobs/{job.pk}/interviews/"

        def count():
            with CaptureQueriesContext(connection) as queries:
                assert client.get(url).status_code == 200
            return len(queries)

        for _ in range(2):
            answer_turns(session_factory(application_factory(job)), 2)
        few = count()
        for _ in range(10):
            answer_turns(session_factory(application_factory(job)), 2)
        assert count() == few


class TestIsolation:
    @pytest.mark.parametrize(
        "method, tail",
        [("get", ""), ("post", "resend/"), ("post", "extend/"), ("post", "cancel/"), ("post", "reevaluate/")],
    )
    def test_another_companys_interview_is_404_on_every_endpoint(self, outsider, session, method, tail):
        response = getattr(outsider, method)(sid(session) + tail, {"days": 3} if tail == "extend/" else None, format="json")
        assert response.status_code == 404
        session.refresh_from_db()
        assert session.status == "invited"

    def test_another_companys_job_is_404(self, outsider, job):
        assert outsider.get(f"/api/jobs/{job.pk}/interviews/").status_code == 404

    def test_an_unknown_id_is_404(self, clients):
        assert clients[MemberRole.ADMIN].get(f"/api/interviews/{uuid.uuid4()}/").status_code == 404

    def test_candidates_and_anonymous_users_are_refused(self, api_client, auth_client, user_factory, session):
        assert api_client.get(sid(session)).status_code == 401
        assert auth_client(user_factory()).get(sid(session)).status_code == 403


class TestResend:
    def test_a_new_link_replaces_the_old_one_and_the_deadline_stays(self, clients, session, api_client):
        old_token, expiry = session.raw_token, session.expires_at
        response = clients[MemberRole.RECRUITER].post(sid(session) + "resend/")
        assert response.status_code == 200
        session.refresh_from_db()
        assert session.expires_at == expiry
        assert api_client.get(f"{PUBLIC}{old_token}/").status_code == 404  # the old link died
        email = OutboundEmail.objects.get(kind="interview_invitation")
        new_token = email.body_text.split("/interview/")[1].split()[0]
        assert new_token != old_token and api_client.get(f"{PUBLIC}{new_token}/").status_code == 200
        assert ActivityEvent.objects.filter(event_type="interview.resent").count() == 1

    @pytest.mark.parametrize("status", ["in_progress", "interrupted"])
    def test_an_open_interview_can_be_resent_in_any_open_state(self, clients, session, status):
        InterviewSession.objects.filter(pk=session.pk).update(status=status)
        assert clients[MemberRole.RECRUITER].post(sid(session) + "resend/").status_code == 200

    @pytest.mark.parametrize("status", ["completed", "evaluated", "cancelled", "expired", "incomplete"])
    def test_a_closed_interview_cannot_be_resent(self, clients, session, status):
        InterviewSession.objects.filter(pk=session.pk).update(status=status)
        response = clients[MemberRole.RECRUITER].post(sid(session) + "resend/")
        assert response.status_code == 409 and response.json()["code"] == "interview_closed"

    def test_after_the_deadline_it_must_be_extended_first(self, clients, session):
        InterviewSession.objects.filter(pk=session.pk).update(expires_at=timezone.now() - timedelta(hours=1))
        assert clients[MemberRole.RECRUITER].post(sid(session) + "resend/").json()["code"] == "link_expired"

    def test_viewers_cannot(self, clients, session):
        assert clients[MemberRole.VIEWER].post(sid(session) + "resend/").status_code == 403


class TestExtend:
    def test_the_deadline_moves_by_the_chosen_days(self, clients, session):
        before = session.expires_at
        body = clients[MemberRole.RECRUITER].post(sid(session) + "extend/", {"days": 5}, format="json").json()
        session.refresh_from_db()
        assert session.expires_at == before + timedelta(days=5) and body["expires_at"].startswith(session.expires_at.strftime("%Y-%m-%dT%H:%M"))
        assert ActivityEvent.objects.get(event_type="interview.extended").metadata["days"] == 5

    @pytest.mark.parametrize("days", [0, 15, -3, "x", None, 1.5, True])
    def test_only_1_to_14_whole_days(self, clients, session, days):
        response = clients[MemberRole.RECRUITER].post(sid(session) + "extend/", {"days": days}, format="json")
        assert response.status_code == 400
        session.refresh_from_db()
        assert session.expires_at > timezone.now() + timedelta(days=6)

    def test_an_expired_never_started_link_comes_back_as_invited(self, clients, session, api_client):
        InterviewSession.objects.filter(pk=session.pk).update(status="expired", expires_at=timezone.now() - timedelta(days=2))
        assert clients[MemberRole.RECRUITER].post(sid(session) + "extend/", {"days": 3}, format="json").status_code == 200
        session.refresh_from_db()
        assert session.status == "invited" and session.expires_at > timezone.now() + timedelta(days=0.9)
        assert api_client.get(f"{PUBLIC}{session.raw_token}/").status_code == 200

    def test_an_expired_started_interview_comes_back_as_interrupted(self, clients, session):
        InterviewSession.objects.filter(pk=session.pk).update(status="expired", started_at=timezone.now() - timedelta(days=3), expires_at=timezone.now() - timedelta(days=1))
        clients[MemberRole.RECRUITER].post(sid(session) + "extend/", {"days": 2}, format="json")
        session.refresh_from_db()
        assert session.status == "interrupted"

    def test_it_cannot_revive_an_old_link_when_a_newer_one_is_open(self, clients, session, session_factory):
        InterviewSession.objects.filter(pk=session.pk).update(status="expired")
        session_factory(session.application, status="invited")
        response = clients[MemberRole.RECRUITER].post(sid(session) + "extend/", {"days": 2}, format="json")
        assert response.status_code == 409 and response.json()["code"] == "open_session_exists"

    @pytest.mark.parametrize("status", ["completed", "evaluated", "cancelled", "incomplete"])
    def test_a_closed_interview_cannot_be_extended(self, clients, session, status):
        InterviewSession.objects.filter(pk=session.pk).update(status=status)
        assert clients[MemberRole.RECRUITER].post(sid(session) + "extend/", {"days": 2}, format="json").status_code == 409

    def test_viewers_cannot(self, clients, session):
        assert clients[MemberRole.VIEWER].post(sid(session) + "extend/", {"days": 2}, format="json").status_code == 403


class TestCancel:
    def test_the_link_dies_and_the_application_status_is_untouched(self, clients, session, api_client):
        application = session.application
        application.status = "interview"
        application.save()
        response = clients[MemberRole.RECRUITER].post(sid(session) + "cancel/")
        assert response.status_code == 200 and response.json()["status"] == "cancelled"
        assert api_client.get(f"{PUBLIC}{session.raw_token}/").json()["code"] == "interview_cancelled"
        application.refresh_from_db()
        assert application.status == "interview"
        assert ActivityEvent.objects.filter(event_type="interview.cancelled").count() == 1

    def test_a_cancelled_interview_frees_the_slot_for_a_new_invitation(self, clients, session):
        clients[MemberRole.RECRUITER].post(sid(session) + "cancel/")
        assert clients[MemberRole.RECRUITER].post(f"/api/applications/{session.application_id}/interviews/", {}, format="json").status_code == 201

    @pytest.mark.parametrize("status", ["completed", "evaluated", "cancelled", "expired", "evaluating"])
    def test_a_closed_interview_cannot_be_cancelled(self, clients, session, status):
        InterviewSession.objects.filter(pk=session.pk).update(status=status)
        assert clients[MemberRole.RECRUITER].post(sid(session) + "cancel/").status_code == 409

    def test_cancelling_works_mid_interview(self, clients, session, api_client):
        api_client.post(f"{PUBLIC}{session.raw_token}/start/")
        assert clients[MemberRole.RECRUITER].post(sid(session) + "cancel/").status_code == 200
        assert api_client.post(f"{PUBLIC}{session.raw_token}/answer/", {"turn_index": 1, "answer_text": "hi"}, format="json").status_code == 410


class TestReevaluate:
    def test_it_queues_an_evaluation_and_only_admin_or_hr_manager_may(self, clients, session, hooks, django_capture_on_commit_callbacks):
        hooks.install().score = 7.0
        InterviewSession.objects.filter(pk=session.pk).update(status="completed")
        answer_turns(session, 3)
        assert clients[MemberRole.RECRUITER].post(sid(session) + "reevaluate/").status_code == 403
        assert clients[MemberRole.VIEWER].post(sid(session) + "reevaluate/").status_code == 403
        with django_capture_on_commit_callbacks(execute=True):
            response = clients[MemberRole.HR_MANAGER].post(sid(session) + "reevaluate/")
        assert response.status_code == 202
        session.refresh_from_db()
        assert session.status == "evaluated" and float(session.overall_score) == 70.0

    def test_an_evaluated_interview_can_be_scored_again(self, clients, session, hooks, django_capture_on_commit_callbacks):
        hooks.install().score = 9.0
        InterviewSession.objects.filter(pk=session.pk).update(status="evaluated", overall_score=50, recommendation="hold")
        answer_turns(session, 3, score=5)
        with django_capture_on_commit_callbacks(execute=True):
            assert clients[MemberRole.ADMIN].post(sid(session) + "reevaluate/").status_code == 202
        session.refresh_from_db()
        assert float(session.overall_score) == 90.0 and session.recommendation == "advance"
        assert ActivityEvent.objects.filter(event_type="interview.reevaluated").count() == 1

    def test_a_failed_evaluation_can_be_started_over(self, clients, session, hooks, django_capture_on_commit_callbacks):
        hooks.install().score = 8.0
        InterviewSession.objects.filter(pk=session.pk).update(status="evaluation_failed", evaluation_attempts=3)
        answer_turns(session, 3)
        with django_capture_on_commit_callbacks(execute=True):
            clients[MemberRole.ADMIN].post(sid(session) + "reevaluate/")
        session.refresh_from_db()
        assert session.status == "evaluated" and session.evaluation_attempts == 1

    @pytest.mark.parametrize("status, code", [("invited", "not_completed"), ("in_progress", "not_completed"), ("cancelled", "not_completed"), ("expired", "not_completed"), ("evaluating", "evaluation_running")])
    def test_an_unfinished_interview_is_409(self, clients, session, status, code):
        InterviewSession.objects.filter(pk=session.pk).update(status=status)
        response = clients[MemberRole.ADMIN].post(sid(session) + "reevaluate/")
        assert response.status_code == 409 and response.json()["code"] == code

    def test_without_hooks_it_is_accepted_and_changes_nothing(self, clients, session, django_capture_on_commit_callbacks):
        InterviewSession.objects.filter(pk=session.pk).update(status="completed")
        answer_turns(session, 3)
        with django_capture_on_commit_callbacks(execute=True):
            assert clients[MemberRole.ADMIN].post(sid(session) + "reevaluate/").status_code == 202
        session.refresh_from_db()
        assert session.status == "completed" and session.overall_score is None


# --- The blocks on the application list and detail --------------------------------------------------------------
class TestApplicationBlocks:
    def test_no_interview_means_null_blocks(self, clients, application):
        detail = clients[MemberRole.VIEWER].get(f"/api/applications/{application.pk}/").json()
        assert detail["screening"] is None and detail["technical"] is None

    def test_the_latest_screening_shows_status_score_and_recommendation(self, clients, application, session_factory):
        session_factory(application, status="cancelled")
        latest = session_factory(application, status="evaluated", overall_score=72.5, recommendation="advance")
        for url in (f"/api/applications/{application.pk}/", f"/api/jobs/{application.job_id}/applications/"):
            data = clients[MemberRole.VIEWER].get(url).json()
            block = data["screening"] if "screening" in data else data["results"][0]["screening"]
            assert block == {"session_id": str(latest.pk), "status": "evaluated", "overall_score": 72.5, "recommendation": "advance"}

    def test_an_unevaluated_interview_has_empty_score_and_recommendation(self, clients, application, session):
        block = clients[MemberRole.VIEWER].get(f"/api/applications/{application.pk}/").json()["screening"]
        assert block["status"] == "invited" and block["overall_score"] is None and block["recommendation"] is None

    def test_the_list_costs_the_same_number_of_queries_however_many_interviews_there_are(self, clients, application_factory, job, session_factory):
        url = f"/api/jobs/{job.pk}/applications/"

        def count():
            with CaptureQueriesContext(connection) as queries:
                assert clients[MemberRole.VIEWER].get(url).status_code == 200
            return len(queries)

        for _ in range(2):
            session_factory(application_factory(job))
        few = count()
        for _ in range(10):
            app = application_factory(job)
            session_factory(app, status="cancelled")
            session_factory(app)
        assert count() == few

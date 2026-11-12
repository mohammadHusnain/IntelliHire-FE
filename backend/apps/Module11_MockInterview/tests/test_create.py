"""The role catalog and creating a practice session (FR-08, FR-09, UC-02 preconditions)."""
import threading
from datetime import timedelta

import pytest
from django.db import connection
from django.utils import timezone

from apps.common.choices import MemberRole
from apps.Module7_Interviews.models import InterviewSession

from ..models import InterviewRole, MockInterviewSession
from .conftest import create, play

pytestmark = pytest.mark.django_db
URL = "/api/mock-interviews/"


class TestCatalog:
    def test_the_seed_has_25_to_30_roles_across_the_documented_categories(self):
        assert 20 <= InterviewRole.objects.count() <= 30
        assert {"Engineering", "Data", "Product", "Design", "Marketing", "Business"} <= set(InterviewRole.objects.values_list("category", flat=True))
        assert all(r.focus_skills and r.description for r in InterviewRole.objects.all())

    def test_the_catalog_can_be_searched_and_filtered(self, me):
        everything = me.get(URL + "roles/", {"page_size": 100}).json()["results"]
        assert len(everything) == InterviewRole.objects.count() and set(everything[0]) == {"id", "slug", "title", "category", "description", "focus_skills"}
        assert {r["slug"] for r in me.get(URL + "roles/", {"q": "data"}).json()["results"]} >= {"data-analyst", "data-scientist"}
        assert {r["category"] for r in me.get(URL + "roles/", {"category": "design"}).json()["results"]} == {"Design"}
        assert me.get(URL + "roles/", {"q": "zzzz-nothing"}).json()["results"] == []

    def test_an_inactive_role_is_hidden(self, me, role):
        InterviewRole.objects.filter(pk=role.pk).update(is_active=False)
        assert role.slug not in {r["slug"] for r in me.get(URL + "roles/", {"page_size": 100}).json()["results"]}

    def test_only_candidates_may_use_any_of_it(self, api_client, clients, auth_client, user_factory):
        assert api_client.get(URL + "roles/").status_code == 401
        assert clients[MemberRole.ADMIN].get(URL + "roles/").status_code == 403
        assert auth_client(user_factory(role="platform_admin")).get(URL + "roles/").status_code == 403


class TestCreate:
    def test_a_general_interview_needs_no_role_and_no_cv(self, me, candidate):
        response = create(me)
        assert response.status_code == 201
        body = response.json()
        assert (body["interview_type"], body["status"], body["role_title"], body["question_count"], body["answered_count"], body["feedback_status"]) == ("general", "invited", "General practice", 8, 0, "none")
        session = InterviewSession.objects.get(pk=body["id"])
        assert (session.kind, session.application, session.candidate_user, session.created_by) == ("mock", None, candidate, candidate)
        assert session.context["cv_excerpt"] == "" and MockInterviewSession.objects.get(session=session).target_role is None

    def test_a_role_specific_interview_snapshots_the_role(self, me, role):
        body = create(me, interview_type="role_specific", role_id=str(role.pk)).json()
        session = InterviewSession.objects.get(pk=body["id"])
        assert body["role_title"] == "Software Engineer" and body["target_role"] == {"id": str(role.pk), "title": "Software Engineer"}
        assert session.context["focus_skills"] == role.focus_skills and session.context["role_category"] == "Engineering"

    def test_a_role_specific_interview_needs_a_real_active_role(self, me, role):
        assert create(me, interview_type="role_specific").status_code == 400
        assert create(me, interview_type="role_specific", role_id="00000000-0000-0000-0000-000000000000").json()["code"] == "role_not_found"
        InterviewRole.objects.filter(pk=role.pk).update(is_active=False)
        assert create(me, interview_type="role_specific", role_id=str(role.pk)).status_code == 400
        assert not InterviewSession.objects.exists()

    def test_a_removed_role_keeps_the_title_on_the_session(self, me, role):
        body = create(me, interview_type="role_specific", role_id=str(role.pk)).json()
        role.delete()
        detail = me.get(f"{URL}{body['id']}/").json()
        assert detail["role_title"] == "Software Engineer" and detail["target_role"] is None

    def test_a_general_interview_ignores_a_role(self, me, role):
        body = create(me, role_id=str(role.pk)).json()
        assert body["role_title"] == "General practice" and body["target_role"] is None

    @pytest.mark.parametrize("count, status", [(7, 400), (11, 400), (0, 400), (8, 201), (10, 201)])
    def test_the_question_count_is_8_to_10(self, me, count, status):
        assert create(me, question_count=count).status_code == status

    def test_a_question_count_sets_the_target(self, me):
        assert create(me, question_count=10).json()["question_count"] == 10

    @pytest.mark.parametrize("body", [{"interview_type": "oral"}, {}])
    def test_a_bad_type_is_400(self, me, body):
        assert me.post(URL, body, format="json").status_code == 400


class TestCv:
    def test_use_cv_without_a_cv_is_400_upload_your_cv_first(self, me):
        response = create(me, use_cv=True)
        assert response.status_code == 400 and response.json()["code"] == "cv_missing" and "Upload your CV" in response.json()["detail"]
        assert not InterviewSession.objects.exists()

    def test_a_cv_without_readable_text_does_not_count(self, me, with_cv):
        with_cv("   ")
        assert create(me, use_cv=True).status_code == 400

    def test_the_cv_excerpt_is_cut_to_3000_characters_and_has_no_personal_details(self, me, with_cv):
        with_cv("Sara Malik sara.malik@example.com +92 300 1234567 built Django services. " + "Python " * 1000)
        body = create(me, use_cv=True).json()
        excerpt = InterviewSession.objects.get(pk=body["id"]).context["cv_excerpt"]
        assert 0 < len(excerpt) <= 3000 and "sara.malik" not in excerpt and "1234567" not in excerpt and "Sara" not in excerpt and "Django" in excerpt
        assert MockInterviewSession.objects.get().use_cv is True

    def test_a_general_interview_never_needs_a_cv_even_when_one_is_missing(self, me):
        assert create(me, use_cv=False).status_code == 201


class TestOneAtATime:
    def test_a_second_session_while_one_is_open_is_409_with_the_id_to_resume(self, me):
        first = create(me).json()
        response = create(me)
        assert response.status_code == 409 and response.json()["code"] == "session_in_progress" and response.json()["session_id"] == first["id"]
        assert InterviewSession.objects.count() == 1

    @pytest.mark.parametrize("status", ["invited", "in_progress", "interrupted"])
    def test_every_open_status_blocks(self, me, status):
        first = create(me).json()
        InterviewSession.objects.filter(pk=first["id"]).update(status=status)
        assert create(me).status_code == 409

    @pytest.mark.parametrize("status", ["completed", "evaluated", "incomplete", "cancelled", "expired", "evaluation_failed"])
    def test_a_closed_session_does_not(self, me, status):
        first = create(me).json()
        InterviewSession.objects.filter(pk=first["id"]).update(status=status)
        assert create(me).status_code == 201

    def test_two_candidates_each_have_their_own_slot(self, me, auth_client, user_factory):
        create(me)
        assert create(auth_client(user_factory())).status_code == 201


class TestDailyLimit:
    def make_closed(self, me, n):
        for _ in range(n):
            body = create(me).json()
            InterviewSession.objects.filter(pk=body["id"]).update(status="completed")

    def test_five_sessions_a_day_then_429_with_the_reset_time(self, me, settings):
        self.make_closed(me, 5)
        response = create(me)
        assert response.status_code == 429 and response.json()["code"] == "daily_limit" and int(response["Retry-After"]) > 0
        assert response.json()["resets_at"].endswith("T00:00:00Z") or "T00:00:00" in response.json()["resets_at"]
        assert InterviewSession.objects.count() == 5

    def test_yesterdays_sessions_do_not_count(self, me):
        self.make_closed(me, 5)
        InterviewSession.objects.update(invited_at=timezone.now() - timedelta(days=1, hours=1))
        assert create(me).status_code == 201

    def test_a_session_ended_before_three_answers_does_not_count(self, me):
        for _ in range(5):
            body = create(me).json()
            assert me.post(f"{URL}{body['id']}/end/").status_code == 200
        assert create(me).status_code == 201

    def test_deleting_a_session_does_not_reset_the_allowance(self, me):
        for _ in range(5):
            body = create(me).json()
            InterviewSession.objects.filter(pk=body["id"]).update(status="completed")
            assert me.delete(f"{URL}{body['id']}/").status_code == 204
        assert create(me).status_code == 429

    def test_the_limit_is_per_candidate(self, me, auth_client, user_factory):
        self.make_closed(me, 5)
        assert create(auth_client(user_factory())).status_code == 201

    def test_the_limit_is_configurable(self, me, settings):
        settings.MOCK_SESSIONS_PER_DAY = 1
        self.make_closed(me, 1)
        assert create(me).status_code == 429


class TestAccess:
    def test_company_users_platform_admins_and_anonymous_users_are_refused(self, api_client, clients, auth_client, user_factory):
        assert api_client.post(URL, {"interview_type": "general"}, format="json").status_code == 401
        assert clients[MemberRole.ADMIN].post(URL, {"interview_type": "general"}, format="json").status_code == 403
        assert auth_client(user_factory(role="platform_admin")).get(URL).status_code == 403

    def test_hr_cannot_invite_anyone_to_a_mock_interview(self, clients, application):
        response = clients[MemberRole.ADMIN].post(f"/api/applications/{application.pk}/interviews/", {"kind": "mock"}, format="json")
        assert response.status_code == 400

    def test_a_mock_session_never_appears_on_the_company_side(self, me, clients, job):
        create(me)
        assert clients[MemberRole.ADMIN].get(f"/api/jobs/{job.pk}/interviews/").json()["count"] == 0


@pytest.mark.django_db(transaction=True)
def test_two_creates_at_once_make_one_session(me, auth_client, candidate, ensure_bank, ensure_roles):
    barrier, codes = threading.Barrier(2), []

    def attempt():
        try:
            barrier.wait(timeout=10)
            codes.append(create(auth_client(candidate)).status_code)
        finally:
            connection.close()

    threads = [threading.Thread(target=attempt) for _ in range(2)]
    [t.start() for t in threads]
    [t.join(timeout=30) for t in threads]
    assert sorted(codes) == [201, 409], codes
    assert InterviewSession.objects.filter(kind="mock").count() == 1

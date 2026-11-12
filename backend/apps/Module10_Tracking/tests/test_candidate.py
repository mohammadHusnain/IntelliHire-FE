"""What a signed-in candidate sees (FR-59 to FR-63, UC-11): their own applications, honestly labelled, and nothing else."""
import json
from datetime import timedelta

import pytest
from django.utils import timezone

from apps.common.choices import CompanyStatus, MemberRole
from apps.Module4_ApplicationManagement.models import ApplicationNote, ApplicationStatusChange
from apps.Module5_Foundation.models import Notification
from apps.Module6_CVAnalysis.models import CVMatch
from apps.Module7_Interviews.services import links
from apps.Module9_Evaluation.models import CandidateEvaluation, HRDecision

from ..services import dashboard

pytestmark = pytest.mark.django_db
LIST = "/api/candidate/applications/"


def move(application, status, user=None, note=""):
    ApplicationStatusChange.objects.create(application=application, from_status=application.status, to_status=status, changed_by=user, note=note, source="hr" if user else "system")
    application.status = status
    application.save()


class TestAccess:
    def test_applications_made_with_my_verified_email_show_up_even_before_linking(self, candidate_client, mine):
        rows = candidate_client.get(LIST).json()["results"]
        assert [r["id"] for r in rows] == [str(mine.pk)]

    def test_applications_linked_to_my_account_show_up_whatever_their_email(self, candidate_client, candidate, application_factory, job):
        other = application_factory(job, email="different@example.com", candidate_user=candidate)
        assert [r["id"] for r in candidate_client.get(LIST).json()["results"]] == [str(other.pk)]

    def test_someone_elses_application_never_shows_up(self, candidate_client, application_factory, job):
        application_factory(job, email="stranger@example.com")
        assert candidate_client.get(LIST).json()["results"] == []

    def test_two_accounts_each_see_only_their_own_email(self, auth_client, user_factory, application_factory, job):
        one, two = user_factory(email="one@example.com"), user_factory(email="two@example.com")
        a, b = application_factory(job, email="one@example.com"), application_factory(job, email="two@example.com")
        assert [r["id"] for r in auth_client(one).get(LIST).json()["results"]] == [str(a.pk)]
        assert [r["id"] for r in auth_client(two).get(LIST).json()["results"]] == [str(b.pk)]

    def test_an_unverified_email_does_not_open_its_applications(self, auth_client, user_factory, application_factory, job):
        user = user_factory(email="late@example.com", email_verified=False, status="pending_verification")
        application_factory(job, email="late@example.com")
        # a candidate who has not verified cannot log in at all: the endpoint answers for the account, but email matching is off
        from apps.Module10_Tracking.services import access

        assert not access.of_candidate(user).exists()

    def test_no_applications_is_an_empty_list_not_an_error(self, candidate_client):
        response = candidate_client.get(LIST)
        assert response.status_code == 200 and response.json()["results"] == [] and response.json()["count"] == 0

    def test_newest_first_with_pages_and_a_status_filter(self, candidate_client, candidate, application_factory, job_factory, team):
        company, users = team
        made = []
        for n in range(3):
            made.append(application_factory(job_factory(company, users[MemberRole.ADMIN], status="open"), email=candidate.email, status="submitted"))
        move(made[0], "shortlisted")
        body = candidate_client.get(LIST, {"page_size": 2}).json()
        assert body["count"] == 3 and len(body["results"]) == 2 and body["next"]
        assert [r["id"] for r in candidate_client.get(LIST, {"status": "shortlisted"}).json()["results"]] == [str(made[0].pk)]
        assert candidate_client.get(LIST, {"status": "nope"}).json()["code"] == "invalid_filter"

    def test_companies_platform_admins_and_anonymous_users_are_refused(self, api_client, clients, auth_client, user_factory):
        assert api_client.get(LIST).status_code == 401
        assert clients[MemberRole.ADMIN].get(LIST).status_code == 403
        assert auth_client(user_factory(role="platform_admin")).get(LIST).status_code == 403

    def test_someone_elses_detail_is_404(self, candidate_client, application_factory, job):
        other = application_factory(job, email="stranger@example.com")
        assert candidate_client.get(f"{LIST}{other.pk}/").status_code == 404


class TestRowAndDetail:
    def test_the_row_has_the_documented_fields_only(self, candidate_client, mine):
        row = candidate_client.get(LIST).json()["results"][0]
        assert set(row) == {"id", "reference", "job_title", "company_name", "applied_at", "status", "status_label", "current_stage", "pending_invitation"}
        assert (row["status_label"], row["current_stage"], row["pending_invitation"]) == ("Submitted", "cv", False)

    @pytest.mark.parametrize("status, label", [("submitted", "Submitted"), ("under_review", "Reviewing"), ("shortlisted", "Shortlisted"), ("interview", "Interview scheduled"), ("selected", "Decision: Selected"), ("rejected", "Decision: Not selected"), ("on_hold", "Decision: On hold")])
    def test_status_labels(self, candidate_client, mine, status, label):
        move(mine, status)
        assert candidate_client.get(f"{LIST}{mine.pk}/").json()["status_label"] == label

    def test_the_detail_has_stages_a_timeline_and_no_decision_yet(self, candidate_client, mine, team):
        _, users = team
        move(mine, "under_review")
        move(mine, "shortlisted", users[MemberRole.RECRUITER], note="Great portfolio, call the referee")
        body = candidate_client.get(f"{LIST}{mine.pk}/").json()
        assert [s["state"] for s in body["stages"]] == ["done", "current", "waiting", "waiting"] and body["current_stage"] == "screening"
        assert [t["label"] for t in body["timeline"]] == ["Reviewing", "Shortlisted"] or [t["label"] for t in body["timeline"]][-2:] == ["Reviewing", "Shortlisted"]
        assert body["decision"] is None and body["pending_invitation"] is None

    def test_the_decision_appears_only_after_hr_recorded_one_and_never_with_the_note(self, candidate_client, mine, team):
        _, users = team
        assert candidate_client.get(f"{LIST}{mine.pk}/").json()["decision"] is None
        HRDecision.objects.create(application=mine, job=mine.job, decision="rejected", decided_by=users[MemberRole.ADMIN], note="Internal: salary too high")
        move(mine, "rejected", users[MemberRole.ADMIN], note="Internal: salary too high")
        response = candidate_client.get(f"{LIST}{mine.pk}/")
        body = response.json()
        assert body["decision"]["label"] == "Decision: Not selected" and body["decision"]["decided_at"]
        assert "salary" not in response.content.decode() and body["current_stage"] is None

    def test_nothing_from_the_company_side_leaks(self, candidate_client, mine, team, cv_match=None):
        _, users = team
        CVMatch.objects.create(
            application=mine, score=91.37, skills_score=91.37, experience_score=91.37, education_score=91.37, semantic_score=91.37, matched_skills=["SecretSkill"],
            missing_skills=[], weights_used={}, job_signature="x", explanation="CVEXPLAIN",
        )  # fmt: skip
        CandidateEvaluation.objects.create(application=mine, job=mine.job, cv_score=91.37, composite_score=88.55, weights_used={}, report={"summary": "REPORTTEXT"}, report_status="ready")
        ApplicationNote.objects.create(application=mine, author=users[MemberRole.RECRUITER], text="NOTETEXT")
        move(mine, "shortlisted", users[MemberRole.RECRUITER], note="HRNOTE")
        everything = candidate_client.get(f"{LIST}{mine.pk}/").content.decode() + candidate_client.get(LIST).content.decode() + candidate_client.get("/api/candidate/dashboard/").content.decode()
        for secret in ("91.37", "88.55", "SecretSkill", "CVEXPLAIN", "REPORTTEXT", "NOTETEXT", "HRNOTE", users[MemberRole.RECRUITER].full_name, "score", "recommendation"):
            assert secret not in everything, secret

    def test_a_suspended_company_keeps_the_application_visible_but_hides_the_interview(self, candidate_client, mine, session_factory):
        session_factory(mine, kind="screening", status="invited")
        company = mine.job.company
        company.status, company.suspension_reason = CompanyStatus.SUSPENDED, "Policy violation under review."
        company.save()
        body = candidate_client.get(f"{LIST}{mine.pk}/").json()
        assert body["status_label"] == "Submitted" and body["pending_invitation"] is None
        assert candidate_client.get(LIST).json()["results"][0]["pending_invitation"] is False

    def test_a_waiting_invitation_shows_kind_and_expiry_but_never_the_token(self, candidate_client, mine, session_factory):
        session = session_factory(mine, kind="screening", status="invited")
        body = candidate_client.get(f"{LIST}{mine.pk}/").json()
        assert body["pending_invitation"]["kind"] == "screening" and body["pending_invitation"]["can_get_link"] is True
        assert session.raw_token not in json.dumps(body) and candidate_client.get(LIST).json()["results"][0]["pending_invitation"] is True

    def test_an_expired_or_started_interview_is_not_waiting(self, candidate_client, mine, session_factory):
        session_factory(mine, kind="screening", status="invited", expires_at=timezone.now() - timedelta(hours=1))
        session_factory(mine, kind="technical", status="in_progress")
        assert candidate_client.get(f"{LIST}{mine.pk}/").json()["pending_invitation"] is None

    def test_queries_do_not_grow_with_the_number_of_applications(self, candidate_client, candidate, application_factory, job_factory, team, session_factory):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        company, users = team

        def count():
            with CaptureQueriesContext(connection) as queries:
                assert candidate_client.get(LIST).status_code == 200
            return len(queries)

        for _ in range(2):
            session_factory(application_factory(job_factory(company, users[MemberRole.ADMIN], status="open"), email=candidate.email), status="invited")
        few = count()
        for _ in range(8):
            session_factory(application_factory(job_factory(company, users[MemberRole.ADMIN], status="open"), email=candidate.email), status="invited")
        assert count() == few


class TestDashboard:
    url = "/api/candidate/dashboard/"

    def test_counts_by_label_waiting_invitations_and_unread_notifications(self, candidate_client, candidate, mine, application_factory, job_factory, team, session_factory):
        company, users = team
        second = application_factory(job_factory(company, users[MemberRole.ADMIN], status="open"), email=candidate.email, status="shortlisted")
        session_factory(second, kind="screening", status="invited")
        Notification.objects.create(user=candidate, kind="x", title="a")
        Notification.objects.create(user=candidate, kind="x", title="b", read_at=timezone.now())
        body = candidate_client.get(self.url).json()
        assert body["total"] == 2 and body["counts"]["Submitted"] == 1 and body["counts"]["Shortlisted"] == 1 and body["counts"]["Decision: Selected"] == 0
        assert len(body["pending_invitations"]) == 1 and body["pending_invitations"][0]["kind"] == "screening" and body["pending_invitations"][0]["reference"] == second.reference
        assert body["unread_notifications"] == 1 and body["recent_mock_sessions"] == []

    def test_an_empty_dashboard_is_all_zeros(self, candidate_client):
        body = candidate_client.get(self.url).json()
        assert body["total"] == 0 and set(body["counts"].values()) == {0} and body["pending_invitations"] == []

    def test_profile_completeness(self, candidate, candidate_client):
        from apps.Module1_Authentication.models import CandidateProfile

        profile, _ = CandidateProfile.objects.get_or_create(user=candidate)
        assert candidate_client.get(self.url).json()["profile"]["percent"] == 0
        profile.headline, profile.phone, profile.location, profile.skills = "Dev", "+923001234567", "Lahore", ["Python"]
        profile.save()
        result = candidate_client.get(self.url).json()["profile"]
        assert result["percent"] == 40 and "bio" in result["missing"] and "headline" not in result["missing"]

    def test_a_registered_provider_supplies_the_recent_mock_sessions_at_most_three(self, candidate_client, monkeypatch):
        monkeypatch.setattr(dashboard, "RECENT_MOCK_PROVIDERS", [lambda user: [{"id": n} for n in range(5)]])
        assert [m["id"] for m in candidate_client.get(self.url).json()["recent_mock_sessions"]] == [0, 1, 2]

    def test_companies_and_anonymous_users_are_refused(self, api_client, clients):
        assert api_client.get(self.url).status_code == 401 and clients[MemberRole.ADMIN].get(self.url).status_code == 403


class TestGetMyLink:
    def url(self, application):
        return f"{LIST}{application.pk}/invitation/link/"

    def test_a_fresh_link_works_and_the_old_one_stops(self, candidate_client, mine, session_factory, api_client):
        session = session_factory(mine, kind="screening", status="invited")
        old = session.raw_token
        response = candidate_client.post(self.url(mine))
        assert response.status_code == 200
        body = response.json()
        new = body["url"].rsplit("/", 1)[1]
        assert new != old and body["kind"] == "screening" and "/interview/" in body["url"]
        assert api_client.get(f"/api/public/interviews/{old}/").status_code == 404
        assert api_client.get(f"/api/public/interviews/{new}/").status_code == 200
        session.refresh_from_db()
        assert session.token_hash == links.hash_token(new)

    def test_it_works_for_an_interrupted_session_too(self, candidate_client, mine, session_factory):
        session_factory(mine, kind="technical", status="interrupted")
        assert candidate_client.post(self.url(mine)).json()["kind"] == "technical"

    def test_with_nothing_waiting_it_is_404(self, candidate_client, mine, session_factory):
        assert candidate_client.post(self.url(mine)).json()["code"] == "no_pending_interview"
        session_factory(mine, kind="screening", status="in_progress")
        assert candidate_client.post(self.url(mine)).status_code == 404

    def test_someone_elses_application_is_404(self, candidate_client, application_factory, job, session_factory):
        other = application_factory(job, email="stranger@example.com")
        session_factory(other, status="invited")
        assert candidate_client.post(self.url(other)).status_code == 404

    def test_a_suspended_company_gets_no_link(self, candidate_client, mine, session_factory):
        session_factory(mine, kind="screening", status="invited")
        company = mine.job.company
        company.status, company.suspension_reason = CompanyStatus.SUSPENDED, "Policy violation under review."
        company.save()
        assert candidate_client.post(self.url(mine)).status_code == 404

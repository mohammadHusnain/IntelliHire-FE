"""Rules that span modules: what happens to jobs and applications when accounts, roles and companies change."""
from datetime import timedelta

import pytest
from django.utils import timezone

from apps.common.choices import MemberRole
from apps.common.tests.helpers import code_in, link_in
from apps.Module3_JobPosting.models import JobPosting
from apps.Module4_ApplicationManagement.models import Application

from apps.Module3_JobPosting.tests.helpers import future, payload

pytestmark = pytest.mark.django_db
JOBS, APPLICATIONS, DASHBOARD = "/api/jobs/", "/api/applications/", "/api/company/dashboard/"


@pytest.fixture
def live(team, job_factory, apply):
    """An open job with one application."""
    company, users = team
    job = job_factory(company, users[MemberRole.RECRUITER], status="open", title="Live job")
    assert apply(job).status_code == 201
    return job, Application.objects.get(job=job)


class TestCompanySuspension:
    """Platform admin suspends the whole company (Module 2) -> jobs and applications (Modules 3 and 4) stop."""

    def test_hr_endpoints_close_and_the_public_form_stops_accepting(self, team, clients, admin_client, live, apply, api_client):
        job, application = live
        company, _ = team
        assert admin_client.post(f"/api/platform-admin/companies/{company.pk}/suspend/", {"reason": "Policy review under way."}, format="json").status_code == 200
        for role in MemberRole.values:
            for url in (JOBS, APPLICATIONS, DASHBOARD, f"{JOBS}{job.pk}/", f"{APPLICATIONS}{application.pk}/", f"{APPLICATIONS}{application.pk}/resume/"):
                assert clients[role].get(url).status_code == 403, (role, url)
        public = api_client.get(f"/api/public/jobs/{job.form_slug}/").json()
        assert public["accepting"] is False
        assert apply(job, email="late@example.com").status_code == 410
        assert JobPosting.objects.filter(pk=job.pk).exists() and Application.objects.filter(pk=application.pk).exists()

    def test_reactivation_restores_everything(self, team, clients, admin_client, live, apply):
        job, application = live
        company, _ = team
        admin_client.post(f"/api/platform-admin/companies/{company.pk}/suspend/", {"reason": "Policy review under way."}, format="json")
        admin_client.post(f"/api/platform-admin/companies/{company.pk}/reactivate/")
        assert clients[MemberRole.ADMIN].get(f"{APPLICATIONS}{application.pk}/").status_code == 200
        assert apply(job, email="again@example.com").status_code == 201
        assert clients[MemberRole.ADMIN].get(DASHBOARD).json()["applicants"]["total"] == 2

    def test_a_suspended_company_cannot_be_suspended_twice_and_data_survives(self, team, admin_client, live):
        company, _ = team
        admin_client.post(f"/api/platform-admin/companies/{company.pk}/suspend/", {"reason": "Policy review under way."}, format="json")
        again = admin_client.post(f"/api/platform-admin/companies/{company.pk}/suspend/", {"reason": "Policy review under way."}, format="json")
        assert again.status_code == 409 and Application.objects.count() == 1


class TestUserAndMemberChanges:
    def test_a_suspended_user_loses_access_at_once_but_their_jobs_stay(self, team, clients, admin_client, live):
        job, _ = live
        _, users = team
        recruiter = users[MemberRole.RECRUITER]
        assert clients[MemberRole.RECRUITER].get(JOBS).status_code == 200
        assert admin_client.post(f"/api/platform-admin/users/{recruiter.pk}/suspend/").status_code == 200
        assert clients[MemberRole.RECRUITER].get(JOBS).status_code == 401  # a still-valid token stops working (TC-07)
        job.refresh_from_db()
        assert job.created_by == recruiter and clients[MemberRole.ADMIN].get(f"{JOBS}{job.pk}/").json()["created_by"]["id"] == str(recruiter.pk)
        admin_client.post(f"/api/platform-admin/users/{recruiter.pk}/reactivate/")
        from apps.Module1_Authentication import auth_tokens

        assert auth_tokens.issue_tokens(recruiter)["access"]

    def test_a_deactivated_member_is_locked_out_of_jobs_and_applications(self, team, clients, live):
        job, application = live
        _, users = team
        member = users[MemberRole.HR_MANAGER].company_membership
        assert clients[MemberRole.HR_MANAGER].get(f"{APPLICATIONS}{application.pk}/").status_code == 200
        assert clients[MemberRole.ADMIN].patch(f"/api/company/members/{member.pk}/", {"is_active": False}, format="json").status_code == 200
        for url in (JOBS, f"{JOBS}{job.pk}/", f"{APPLICATIONS}{application.pk}/", DASHBOARD):
            assert clients[MemberRole.HR_MANAGER].get(url).status_code == 403
        clients[MemberRole.ADMIN].patch(f"/api/company/members/{member.pk}/", {"is_active": True}, format="json")
        assert clients[MemberRole.HR_MANAGER].get(JOBS).status_code == 200

    def test_a_role_change_takes_effect_on_the_next_request(self, team, clients, live):
        job, application = live
        _, users = team
        member = users[MemberRole.VIEWER].company_membership
        viewer = clients[MemberRole.VIEWER]
        assert viewer.post(JOBS, payload(), format="json").status_code == 403
        assert viewer.patch(f"{APPLICATIONS}{application.pk}/status/", {"status": "shortlisted"}, format="json").status_code == 403
        clients[MemberRole.ADMIN].patch(f"/api/company/members/{member.pk}/", {"role": "recruiter"}, format="json")
        assert viewer.post(JOBS, payload(), format="json").status_code == 201
        assert viewer.patch(f"{APPLICATIONS}{application.pk}/status/", {"status": "shortlisted"}, format="json").status_code == 200
        clients[MemberRole.ADMIN].patch(f"/api/company/members/{member.pk}/", {"role": "viewer"}, format="json")
        assert viewer.post(JOBS, payload(), format="json").status_code == 403
        assert viewer.get(JOBS).status_code == 200

    def test_a_newly_invited_recruiter_can_work_on_jobs_straight_away(self, team, clients, live, api_client, django_capture_on_commit_callbacks):
        from django.core import mail

        job, application = live
        with django_capture_on_commit_callbacks(execute=True):
            clients[MemberRole.ADMIN].post("/api/company/invitations/", {"email": "new.hr@example.com", "full_name": "New HR", "role": "recruiter"}, format="json")
        token = link_in(mail.outbox[-1])[1]["token"]
        assert api_client.post(f"/api/public/invitations/{token}/accept/", {"full_name": "New HR", "password": "Sunny-Day-4711", "confirm_password": "Sunny-Day-4711"}, format="json").status_code == 201
        login = api_client.post("/api/auth/login/", {"email": "new.hr@example.com", "password": "Sunny-Day-4711"}, format="json")
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.json()['access']}")
        assert api_client.post(JOBS, payload(publish=True), format="json").status_code == 201
        assert api_client.patch(f"{APPLICATIONS}{application.pk}/status/", {"status": "under_review"}, format="json").status_code == 200
        assert api_client.get(DASHBOARD).json()["jobs"]["open"] == 2

    def test_the_last_admin_rule_does_not_block_job_work(self, team, clients, live):
        assert clients[MemberRole.ADMIN].post(f"{JOBS}{live[0].pk}/close/").status_code == 200


class TestRejectedCompanyJourney:
    def test_rejection_resubmission_approval_then_jobs(self, api_client, admin_client, auth_client, django_capture_on_commit_callbacks):
        from django.core import mail
        from apps.Module1_Authentication.models import User

        body = {"company_name": "Journey Co", "industry": "Software", "official_email": "owner@journey.example", "admin_full_name": "Owner One",
                "admin_phone": "+92 300 1234567", "password": "Sunny-Day-4711", "confirm_password": "Sunny-Day-4711"}
        with django_capture_on_commit_callbacks(execute=True):
            assert api_client.post("/api/auth/register/company/", body, format="json").status_code == 201
        verify = next(m for m in mail.outbox if "verification code" in m.subject)
        assert api_client.post("/api/auth/verify-email/", {"email": "owner@journey.example", "code": code_in(verify)}, format="json").status_code == 200
        company_id = admin_client.get("/api/platform-admin/companies/").json()["results"][0]["id"]
        admin_client.post(f"/api/platform-admin/companies/{company_id}/reject/", {"reason": "Details could not be verified."}, format="json")
        login = {"email": "owner@journey.example", "password": "Sunny-Day-4711"}
        assert api_client.post("/api/auth/login/", login, format="json").json()["code"] == "rejected"
        resubmit = {"official_email": login["email"], "password": login["password"], "company_name": "Journey Co Ltd", "industry": "Software", "admin_full_name": "Owner One", "admin_phone": "+92 300 1234567"}
        assert api_client.post("/api/auth/register/company/resubmit/", resubmit, format="json").status_code == 200
        assert api_client.post("/api/auth/login/", login, format="json").json()["code"] == "pending_approval"
        assert admin_client.post(f"/api/platform-admin/companies/{company_id}/approve/").status_code == 200
        tokens = api_client.post("/api/auth/login/", login, format="json")
        assert tokens.status_code == 200
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens.json()['access']}")
        created = api_client.post(JOBS, payload(publish=True), format="json")
        assert created.status_code == 201 and created.json()["status"] == "open"
        assert User.objects.filter(email="owner@journey.example", status="active").exists()


class TestJobLifecycleAcrossModules:
    def test_closing_stops_applications_and_reopening_restores_them(self, team, clients, live, apply, api_client):
        job, _ = live
        assert clients[MemberRole.ADMIN].post(f"{JOBS}{job.pk}/close/").status_code == 200
        assert apply(job, email="closed@example.com").status_code == 410
        assert api_client.get(f"/api/public/jobs/{job.form_slug}/").json()["accepting"] is False
        assert clients[MemberRole.ADMIN].get(DASHBOARD).json()["jobs"] == {"open": 0, "draft": 0, "closed": 1}
        assert clients[MemberRole.ADMIN].post(f"{JOBS}{job.pk}/reopen/", {"deadline": future(10).isoformat()}, format="json").status_code == 200
        assert apply(job, email="reopened@example.com").status_code == 201
        assert clients[MemberRole.ADMIN].get(f"{JOBS}{job.pk}/").json()["applications_count"] == 2

    def test_a_job_past_its_deadline_refuses_applications_before_and_after_the_command(self, team, clients, live, apply):
        from apps.Module3_JobPosting.services.lifecycle import close_expired_jobs

        job, _ = live
        JobPosting.objects.filter(pk=job.pk).update(deadline=timezone.now() - timedelta(minutes=1))
        assert apply(job, email="a@example.com").status_code == 410
        assert close_expired_jobs() == 1
        assert apply(job, email="b@example.com").status_code == 410
        assert clients[MemberRole.ADMIN].get(f"{JOBS}{job.pk}/").json()["close_reason"] == "deadline"

    def test_a_duplicated_job_starts_empty_and_the_original_keeps_its_applications(self, team, clients, live):
        job, _ = live
        copy = clients[MemberRole.RECRUITER].post(f"{JOBS}{job.pk}/duplicate/").json()
        assert copy["applications_count"] == 0 and copy["status"] == "draft"
        assert clients[MemberRole.ADMIN].get(f"{JOBS}{job.pk}/").json()["applications_count"] == 1
        assert clients[MemberRole.ADMIN].get(f"{JOBS}{copy['id']}/applications/").json()["count"] == 0

    def test_a_job_with_applications_can_never_be_deleted(self, team, clients, live):
        job, application = live
        for role in (MemberRole.ADMIN, MemberRole.HR_MANAGER):
            assert clients[role].delete(f"{JOBS}{job.pk}/").status_code == 409
        clients[MemberRole.ADMIN].post(f"{JOBS}{job.pk}/close/")
        assert clients[MemberRole.ADMIN].delete(f"{JOBS}{job.pk}/").status_code == 409
        assert Application.objects.filter(pk=application.pk).exists()

    def test_the_custom_field_lock_starts_with_the_first_real_application(self, team, clients, job_factory, apply):
        company, users = team
        job = job_factory(company, users[MemberRole.ADMIN], status="open", fields=[{"label": "Notes", "key": "notes", "field_type": "short_text"}])
        field = job.custom_fields.get()
        url = f"{JOBS}{job.pk}/fields/{field.pk}/"
        assert clients[MemberRole.ADMIN].patch(url, {"required": True}, format="json").status_code == 200
        clients[MemberRole.ADMIN].patch(url, {"required": False}, format="json")
        assert apply(job, notes="hello").status_code == 201
        assert clients[MemberRole.ADMIN].patch(url, {"required": True}, format="json").status_code == 409
        assert clients[MemberRole.ADMIN].delete(url).status_code == 409


class TestAccountsAndApplications:
    def test_a_candidate_who_applies_while_logged_in_is_linked_and_stays_after_suspension(self, team, clients, auth_client, user_factory, admin_client, live, apply):
        job, _ = live
        candidate = user_factory()
        assert apply(job, client=auth_client(candidate), email="cand@example.com").status_code == 201
        application = Application.objects.get(email="cand@example.com")
        assert application.candidate_user == candidate
        admin_client.post(f"/api/platform-admin/users/{candidate.pk}/suspend/")
        assert clients[MemberRole.VIEWER].get(f"{APPLICATIONS}{application.pk}/").status_code == 200

    def test_a_candidate_cannot_reach_any_hr_endpoint(self, auth_client, user_factory, live):
        job, application = live
        client = auth_client(user_factory())
        for url in (JOBS, f"{JOBS}{job.pk}/", APPLICATIONS, f"{APPLICATIONS}{application.pk}/", f"{APPLICATIONS}{application.pk}/resume/", DASHBOARD):
            assert client.get(url).status_code == 403, url

    def test_the_platform_admin_has_no_read_access_to_company_jobs_or_applications(self, admin_client, live):
        job, application = live  # decision D-043: not in Phase 1
        for url in (JOBS, f"{JOBS}{job.pk}/", APPLICATIONS, f"{APPLICATIONS}{application.pk}/", DASHBOARD):
            assert admin_client.get(url).status_code == 403, url

    def test_a_company_user_applying_is_not_linked_as_a_candidate(self, clients, live, apply):
        job, _ = live
        assert apply(job, client=clients[MemberRole.RECRUITER], email="staff@example.com").status_code == 201
        assert Application.objects.get(email="staff@example.com").candidate_user is None

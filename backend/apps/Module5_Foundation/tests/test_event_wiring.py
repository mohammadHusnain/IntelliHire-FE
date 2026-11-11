"""Every important Phase 1 action leaves exactly one audit event, with the right actor and no personal data."""
from datetime import timedelta
from unittest import mock

import pytest
from django.utils import timezone

from apps.common.choices import CompanyStatus, MemberRole, UserRole
from apps.Module3_JobPosting.services import lifecycle
from apps.Module3_JobPosting.tests.conftest import job_factory  # noqa: F401
from apps.Module3_JobPosting.tests.helpers import future
from apps.Module4_ApplicationManagement.models import Application
from apps.Module4_ApplicationManagement.tests.helpers import app_url, apply_url, form
from apps.Module5_Foundation.models import ActivityEvent

pytestmark = pytest.mark.django_db


def events(event_type):
    return list(ActivityEvent.objects.filter(event_type=event_type))


def one(event_type):
    found = events(event_type)
    assert len(found) == 1, found
    return found[0]


def no_personal_data(event, *needles):
    text = f"{event.summary} {event.metadata}".lower()
    for needle in needles:
        assert needle.lower() not in text


def test_a_candidate_registering(api_client):
    response = api_client.post("/api/auth/register/candidate/", {"full_name": "Sara Malik", "email": "sara@example.com", "password": "Str0ng!pass-123", "confirm_password": "Str0ng!pass-123"}, format="json")
    assert response.status_code == 201
    event = one("user.registered")
    assert event.actor.email == "sara@example.com" and event.target_type == "user" and event.metadata == {"role": "candidate"}
    no_personal_data(event, "sara@example.com", "Sara Malik")


def test_a_company_registering(api_client):
    response = api_client.post(
        "/api/auth/register/company/",
        {"company_name": "Acme Labs", "industry": "Software", "official_email": "boss@acme.example", "admin_full_name": "Boss", "admin_phone": "+920000000000", "password": "Str0ng!pass-123", "confirm_password": "Str0ng!pass-123"},
        format="json",
    )
    assert response.status_code == 201, response.content
    event = one("company.registered")
    assert event.company.name == "Acme Labs" and event.actor.email == "boss@acme.example" and event.target_id == event.company_id
    no_personal_data(event, "boss@acme.example")


def test_a_failed_registration_leaves_no_event(api_client, user_factory):
    user_factory(email="taken@example.com")
    response = api_client.post("/api/auth/register/candidate/", {"full_name": "X Y", "email": "taken@example.com", "password": "Str0ng!pass-123", "confirm_password": "Str0ng!pass-123"}, format="json")
    assert response.status_code == 400 and events("user.registered") == []


class TestCompanyReview:
    @pytest.fixture
    def setup(self, company_factory, user_factory, auth_client):
        admin = user_factory(role=UserRole.PLATFORM_ADMIN)
        company = company_factory(status=CompanyStatus.PENDING)
        return auth_client(admin), admin, company, f"/api/platform-admin/companies/{company.pk}/"

    def test_approve_suspend_reactivate(self, setup):
        client, admin, company, base = setup
        assert client.post(base + "approve/").status_code == 200
        assert client.post(base + "suspend/", {"reason": "Policy violation under review."}, format="json").status_code == 200
        assert client.post(base + "reactivate/").status_code == 200
        for kind in ("approved", "suspended", "reactivated"):
            event = one(f"company.{kind}")
            assert event.actor == admin and event.company == company
        no_personal_data(one("company.suspended"), "Policy violation")

    def test_reject(self, setup):
        client, admin, company, base = setup
        assert client.post(base + "reject/", {"reason": "Incomplete registration details."}, format="json").status_code == 200
        event = one("company.rejected")
        assert event.actor == admin and event.company == company
        no_personal_data(event, "Incomplete registration")

    def test_a_refused_review_leaves_no_event(self, setup):
        client, _, _, base = setup
        assert client.post(base + "reactivate/").status_code == 409
        assert events("company.reactivated") == []


def test_suspending_and_reactivating_a_user(user_factory, auth_client):
    admin, target = user_factory(role=UserRole.PLATFORM_ADMIN), user_factory()
    client = auth_client(admin)
    assert client.post(f"/api/platform-admin/users/{target.pk}/suspend/").status_code == 200
    assert client.post(f"/api/platform-admin/users/{target.pk}/reactivate/").status_code == 200
    assert one("user.suspended").actor == admin and one("user.reactivated").actor == admin
    assert one("user.suspended").target_id == target.pk
    no_personal_data(one("user.suspended"), target.email)


class TestJobs:
    @pytest.fixture
    def team(self, member_factory):
        admin = member_factory(MemberRole.ADMIN)
        return admin.company_membership.company, admin

    def test_publishing_and_closing(self, team, job_factory, auth_client):
        company, admin = team
        job = job_factory(company, admin, title="Backend Developer", description="x" * 100, responsibilities="y" * 50, deadline=future(14))
        client = auth_client(admin)
        assert client.post(f"/api/jobs/{job.pk}/publish/").status_code == 200
        assert client.post(f"/api/jobs/{job.pk}/close/").status_code == 200
        published, closed = one("job.published"), one("job.closed")
        assert published.actor == admin and published.company == company and published.target_id == job.pk
        assert closed.actor == admin and closed.metadata == {"reason": "manual"}

    def test_expired_jobs_closed_by_the_scheduler_have_no_actor(self, team, job_factory):
        company, admin = team
        job = job_factory(company, admin, status="open", deadline=timezone.now() - timedelta(minutes=1))
        assert lifecycle.close_expired_jobs() == 1
        event = one("job.closed")
        assert event.actor is None and event.company == company and event.target_id == job.pk and event.metadata == {"reason": "deadline"}

    def test_the_scheduled_task_closes_jobs_and_a_second_run_does_nothing(self, team, job_factory):
        from apps.Module5_Foundation import tasks

        company, admin = team
        job_factory(company, admin, status="open", deadline=timezone.now() - timedelta(minutes=1))
        assert tasks.close_expired_jobs() == 1 and tasks.close_expired_jobs() == 0
        assert len(events("job.closed")) == 1


class TestApplications:
    @pytest.fixture
    def job(self, member_factory, job_factory):
        admin = member_factory(MemberRole.ADMIN)
        return job_factory(admin.company_membership.company, admin, status="open", title="Data Engineer"), admin

    def test_submitting_an_application(self, api_client, job):
        job, _ = job
        response = api_client.post(apply_url(job), form(), format="multipart")
        assert response.status_code == 201, response.content
        event = one("application.submitted")
        assert event.actor is None and event.company == job.company and event.metadata == {"reference": response.json()["reference"]}
        no_personal_data(event, "Sara", "Example.com", "+92")

    def test_a_rejected_application_leaves_no_event(self, api_client, job):
        job, _ = job
        assert api_client.post(apply_url(job), form(email=None), format="multipart").status_code == 400
        assert events("application.submitted") == []

    def test_changing_the_status(self, api_client, auth_client, job):
        job, admin = job
        api_client.post(apply_url(job), form(), format="multipart")
        application = Application.objects.get()
        assert auth_client(admin).patch(app_url(application, "status"), {"status": "shortlisted", "note": "Strong CV"}, format="json").status_code == 200
        event = one("application.status_changed")
        assert event.actor == admin and event.metadata["from"] == "submitted" and event.metadata["to"] == "shortlisted"
        assert event.target_id == application.pk and event.company == job.company
        no_personal_data(event, "Strong CV", "Sara")

    def test_the_same_status_twice_logs_nothing_the_second_time(self, api_client, auth_client, job):
        job, admin = job
        api_client.post(apply_url(job), form(), format="multipart")
        application = Application.objects.get()
        client = auth_client(admin)
        client.patch(app_url(application, "status"), {"status": "shortlisted"}, format="json")
        assert client.patch(app_url(application, "status"), {"status": "shortlisted"}, format="json").status_code == 400
        assert len(events("application.status_changed")) == 1


def test_an_audit_failure_never_breaks_the_action(api_client):
    with mock.patch.object(ActivityEvent.objects, "create", side_effect=RuntimeError("audit store down")):
        response = api_client.post("/api/auth/register/candidate/", {"full_name": "Sara Malik", "email": "s2@example.com", "password": "Str0ng!pass-123", "confirm_password": "Str0ng!pass-123"}, format="json")
    assert response.status_code == 201


def test_registration_emails_are_marked_sensitive_and_wiped_after_sending(api_client, django_capture_on_commit_callbacks):
    from apps.Module5_Foundation.models import OutboundEmail

    with django_capture_on_commit_callbacks(execute=True):
        api_client.post("/api/auth/register/candidate/", {"full_name": "Sara Malik", "email": "s3@example.com", "password": "Str0ng!pass-123", "confirm_password": "Str0ng!pass-123"}, format="json")
    row = OutboundEmail.objects.get(kind="email_verification")
    assert row.sensitive and row.status == "sent" and row.body_text == "" and row.body_purged

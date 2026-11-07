"""Module 3 reads applications through one hook; with Module 4 installed it reports and enforces real data."""
import pytest

from apps.common.choices import MemberRole
from apps.Module3_JobPosting.models import ApplicationField
from apps.Module3_JobPosting.services.applications_link import has_applications

from .conftest import full_answers
from .helpers import apply_url, form

pytestmark = pytest.mark.django_db
JOBS = "/api/jobs/"


def apply(client, job, email, **extra):
    response = client.post(apply_url(job), form(email=email, **extra), format="multipart")
    assert response.status_code == 201, response.content


def fields_url(job, suffix=""):
    return f"/api/jobs/{job.pk}/fields/{f'{suffix}/' if suffix else ''}"


class TestApplicationsCount:
    def test_the_job_list_and_detail_show_real_counts(self, api_client, clients, open_job, team, job_factory):
        company, _ = team
        quiet = job_factory(company, status="open", title="Quiet job")
        for index in range(3):
            apply(api_client, open_job, f"p{index}@example.com")
        rows = {row["title"]: row for row in clients[MemberRole.ADMIN].get(JOBS).json()["results"]}
        assert rows[open_job.title]["applications_count"] == 3 and rows["Quiet job"]["applications_count"] == 0
        assert clients[MemberRole.VIEWER].get(f"{JOBS}{open_job.pk}/").json()["applications_count"] == 3
        assert quiet.pk and has_applications(open_job) is True and has_applications(quiet) is False

    def test_jobs_can_be_ordered_by_application_count(self, api_client, clients, open_job, team, job_factory):
        company, _ = team
        busy = job_factory(company, status="open", title="Busy")
        for index in range(2):
            apply(api_client, busy, f"b{index}@example.com")
        apply(api_client, open_job, "single@example.com")
        titles = lambda q: [row["title"] for row in clients[MemberRole.ADMIN].get(JOBS, {"ordering": q, "status": "open"}).json()["results"]]  # noqa: E731
        assert titles("-applications_count") == ["Busy", open_job.title]
        assert titles("applications_count") == [open_job.title, "Busy"]

    def test_the_count_is_not_inflated_by_custom_files_or_history(self, api_client, clients, form_job):
        api_client.post(apply_url(form_job), full_answers(), format="multipart")
        assert clients[MemberRole.ADMIN].get(f"{JOBS}{form_job.pk}/").json()["applications_count"] == 1

    def test_counts_never_leak_across_companies(self, api_client, open_job, member_factory, auth_client, job_factory):
        apply(api_client, open_job, "a@example.com")
        outsider = member_factory(MemberRole.ADMIN)
        mine = job_factory(outsider.company_membership.company, status="open")
        assert auth_client(outsider).get(f"{JOBS}{mine.pk}/").json()["applications_count"] == 0


class TestFieldsLockAfterTheFirstApplication:
    """Doc §3.3: once an application exists, answers must stay valid."""

    @pytest.fixture
    def locked(self, api_client, clients, team, job_factory):
        company, _ = team
        job = job_factory(company, status="open", fields=[
            {"label": "Level", "key": "level", "field_type": "single_choice", "options": ["A", "B", "C"]},
            {"label": "Notes", "key": "notes", "field_type": "short_text"},
        ])
        apply(api_client, job, "first@example.com")
        return job

    def assert_locked(self, response):
        assert response.status_code == 409 and response.json()["code"] == "field_locked", response.content

    def test_nothing_is_locked_before_the_first_application(self, clients, team, job_factory):
        company, _ = team
        job = job_factory(company, status="open", fields=[{"label": "X", "key": "x", "field_type": "short_text"}])
        field = job.custom_fields.get()
        client = clients[MemberRole.ADMIN]
        assert client.patch(fields_url(job, field.pk), {"required": True, "field_type": "long_text"}, format="json").status_code == 200
        assert client.delete(fields_url(job, field.pk)).status_code == 204

    def test_a_field_cannot_be_deleted(self, clients, locked):
        field = locked.custom_fields.get(key="notes")
        self.assert_locked(clients[MemberRole.ADMIN].delete(fields_url(locked, field.pk)))
        assert ApplicationField.objects.filter(pk=field.pk).exists()

    def test_the_type_cannot_change(self, clients, locked):
        field = locked.custom_fields.get(key="notes")
        self.assert_locked(clients[MemberRole.ADMIN].patch(fields_url(locked, field.pk), {"field_type": "long_text"}, format="json"))

    def test_an_optional_field_cannot_become_required(self, clients, locked):
        field = locked.custom_fields.get(key="notes")
        self.assert_locked(clients[MemberRole.ADMIN].patch(fields_url(locked, field.pk), {"required": True}, format="json"))

    def test_options_cannot_be_removed(self, clients, locked):
        field = locked.custom_fields.get(key="level")
        self.assert_locked(clients[MemberRole.ADMIN].patch(fields_url(locked, field.pk), {"options": ["A", "B"]}, format="json"))
        assert ApplicationField.objects.get(pk=field.pk).options == ["A", "B", "C"]

    def test_a_new_required_field_cannot_be_added(self, clients, locked):
        self.assert_locked(clients[MemberRole.ADMIN].post(fields_url(locked), {"label": "New", "field_type": "short_text", "required": True}, format="json"))

    def test_the_allowed_changes_still_work(self, clients, locked):
        client = clients[MemberRole.ADMIN]
        level = locked.custom_fields.get(key="level")
        assert client.patch(fields_url(locked, level.pk), {"label": "Seniority", "help_text": "Pick one"}, format="json").status_code == 200
        assert client.patch(fields_url(locked, level.pk), {"options": ["A", "B", "C", "D"]}, format="json").status_code == 200
        assert client.post(fields_url(locked), {"label": "Extra", "field_type": "short_text"}, format="json").status_code == 201
        ids = [f.pk for f in locked.custom_fields.order_by("-order")]
        assert client.post(fields_url(locked, "reorder"), {"field_ids": ids}, format="json").status_code == 200

    def test_existing_applications_still_validate_after_allowed_changes(self, api_client, clients, locked):
        level = locked.custom_fields.get(key="level")
        clients[MemberRole.ADMIN].patch(fields_url(locked, level.pk), {"options": ["A", "B", "C", "D"]}, format="json")
        response = api_client.post(apply_url(locked), form(email="second@example.com", level="D"), format="multipart")
        assert response.status_code == 201

    def test_the_lock_only_affects_the_job_that_has_applications(self, clients, locked, team, job_factory):
        company, _ = team
        other = job_factory(company, status="open", fields=[{"label": "X", "key": "x", "field_type": "short_text"}])
        field = other.custom_fields.get()
        assert clients[MemberRole.ADMIN].delete(fields_url(other, field.pk)).status_code == 204

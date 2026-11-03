from datetime import timedelta

import pytest
from django.utils import timezone

from apps.common.choices import MemberRole
from apps.Module3_JobPosting.models import JobPosting

from .helpers import future, job_url

pytestmark = pytest.mark.django_db


@pytest.fixture
def draft(team, job_factory):
    company, users = team
    return job_factory(company, users[MemberRole.ADMIN], title="Draft Job")


@pytest.fixture
def open_job(team, job_factory):
    company, users = team
    return job_factory(company, users[MemberRole.ADMIN], status="open", title="Open Job", salary_min=100, salary_max=200)


def patch(client, job, **body):
    return client.patch(job_url(job), body, format="json")


class TestPermissions:
    @pytest.mark.parametrize("role", [MemberRole.ADMIN, MemberRole.HR_MANAGER, MemberRole.RECRUITER])
    def test_editors_can_edit(self, clients, draft, role):
        assert patch(clients[role], draft, title="New title").status_code == 200

    def test_viewer_cannot_edit(self, clients, draft):
        response = patch(clients[MemberRole.VIEWER], draft, title="Hacked")
        assert response.status_code == 403 and response.json()["detail"] == "Unauthorized access."
        draft.refresh_from_db()
        assert draft.title == "Draft Job"

    def test_anonymous_cannot_edit(self, api_client, draft):
        assert patch(api_client, draft, title="x").status_code == 401


class TestDraftEdit:
    def test_everything_is_editable_on_a_draft(self, clients, draft):
        changes = {
            "title": "Renamed", "department": "Sales", "description": "New description",
            "responsibilities": "New duties", "employment_type": "contract", "work_mode": "remote",
            "location": "Anywhere", "required_skills": ["Go"], "soft_skills": [], "min_experience_years": 5,
            "education_level": "master", "salary_min": 1, "salary_max": 2, "salary_currency": "USD",
            "show_salary": True, "openings": 4,
        }
        response = patch(clients[MemberRole.ADMIN], draft, **changes)
        assert response.status_code == 200
        body = response.json()
        assert {key: body[key] for key in changes} == changes

    def test_empty_patch_is_a_noop_and_partial_patch_keeps_other_fields(self, clients, draft):
        before = clients[MemberRole.ADMIN].get(job_url(draft)).json()
        assert patch(clients[MemberRole.ADMIN], draft).status_code == 200
        body = patch(clients[MemberRole.ADMIN], draft, openings=3).json()
        assert body["openings"] == 3 and body["title"] == before["title"] and body["department"] == before["department"]

    def test_draft_deadline_can_be_set_and_cleared(self, clients, draft):
        deadline = future(10).replace(microsecond=0)
        assert patch(clients[MemberRole.ADMIN], draft, deadline=deadline.isoformat()).json()["deadline"]
        assert patch(clients[MemberRole.ADMIN], draft, deadline=None).json()["deadline"] is None

    def test_draft_deadline_must_be_in_the_future(self, clients, draft):
        response = patch(clients[MemberRole.ADMIN], draft, deadline=(timezone.now() - timedelta(hours=1)).isoformat())
        assert response.status_code == 400 and "deadline" in response.json()

    def test_salary_is_checked_against_the_stored_value(self, clients, draft):
        patch(clients[MemberRole.ADMIN], draft, salary_min=500)
        assert patch(clients[MemberRole.ADMIN], draft, salary_max=100).status_code == 400
        assert patch(clients[MemberRole.ADMIN], draft, salary_max=900).status_code == 200

    def test_server_owned_fields_are_ignored(self, clients, draft, company_factory):
        other = company_factory()
        body = patch(
            clients[MemberRole.ADMIN], draft, status="open", form_slug="hacked", company=str(other.pk), created_by="x"
        ).json()
        draft.refresh_from_db()
        assert draft.status == "draft" and draft.form_slug is None and draft.company != other
        assert body["status"] == "draft"

    def test_updated_by_is_recorded(self, team, clients, draft):
        _, users = team
        patch(clients[MemberRole.RECRUITER], draft, title="By recruiter")
        draft.refresh_from_db()
        assert draft.updated_by == users[MemberRole.RECRUITER] and draft.created_by == users[MemberRole.ADMIN]

    @pytest.mark.parametrize("body,field", [({"title": ""}, "title"), ({"employment_type": "gig"}, "employment_type"), ({"openings": 0}, "openings")])
    def test_validation(self, clients, draft, body, field):
        response = patch(clients[MemberRole.ADMIN], draft, **body)
        assert response.status_code == 400 and field in response.json()


class TestOpenJobEdit:
    def test_allowed_fields_are_editable_and_the_slug_never_changes(self, clients, open_job):
        slug = open_job.form_slug
        new_deadline = future(30).replace(microsecond=0)
        response = patch(
            clients[MemberRole.RECRUITER], open_job, title="Renamed", description="Updated", responsibilities="x",
            required_skills=["Rust"], soft_skills=["Calm"], salary_min=300, salary_max=400, salary_currency="USD",
            show_salary=False, location="Karachi", deadline=new_deadline.isoformat(),
        )
        assert response.status_code == 200
        open_job.refresh_from_db()
        assert open_job.form_slug == slug and open_job.status == "open"
        assert (open_job.title, open_job.location, open_job.deadline) == ("Renamed", "Karachi", new_deadline)

    @pytest.mark.parametrize(
        "field,value",
        [
            ("department", "Sales"), ("employment_type", "contract"), ("work_mode", "remote"),
            ("min_experience_years", 9), ("education_level", "phd"), ("openings", 7),
        ],
    )
    def test_other_fields_are_locked_after_publishing(self, clients, open_job, field, value):
        response = patch(clients[MemberRole.ADMIN], open_job, **{field: value})
        assert response.status_code == 409 and response.json()["code"] == "field_locked"
        assert field in response.json()["detail"]
        open_job.refresh_from_db()
        assert getattr(open_job, field) != value

    def test_sending_the_unchanged_value_of_a_locked_field_is_fine(self, clients, open_job):
        response = patch(clients[MemberRole.ADMIN], open_job, department=open_job.department, title="Fine")
        assert response.status_code == 200

    def test_a_mixed_request_changes_nothing_when_one_field_is_locked(self, clients, open_job):
        response = patch(clients[MemberRole.ADMIN], open_job, title="Should not apply", department="Sales")
        assert response.status_code == 409
        open_job.refresh_from_db()
        assert open_job.title == "Open Job"

    def test_deadline_can_only_move_to_a_future_time(self, clients, open_job):
        response = patch(clients[MemberRole.ADMIN], open_job, deadline=(timezone.now() - timedelta(hours=1)).isoformat())
        assert response.status_code == 400 and "deadline" in response.json()

    def test_deadline_cannot_exceed_six_months(self, clients, open_job):
        response = patch(clients[MemberRole.ADMIN], open_job, deadline=future(200).isoformat())
        assert response.status_code == 400 and "deadline" in response.json()

    @pytest.mark.parametrize("body,field", [({"description": ""}, "description"), ({"required_skills": []}, "required_skills"), ({"title": " "}, "title")])
    def test_an_open_job_must_stay_publishable(self, clients, open_job, body, field):
        response = patch(clients[MemberRole.ADMIN], open_job, **body)
        assert response.status_code == 400 and field in response.json()
        open_job.refresh_from_db()
        assert open_job.description and open_job.required_skills

    def test_open_job_with_a_remote_mode_needs_no_location(self, clients, open_job):
        JobPosting.objects.filter(pk=open_job.pk).update(work_mode="remote")
        assert patch(clients[MemberRole.ADMIN], open_job, location="").status_code == 200

    def test_open_job_past_its_deadline_is_read_only(self, clients, open_job):
        JobPosting.objects.filter(pk=open_job.pk).update(deadline=timezone.now() - timedelta(minutes=1))
        response = patch(clients[MemberRole.ADMIN], open_job, title="Too late")
        assert response.status_code == 409 and response.json()["code"] == "deadline_passed"


class TestClosedJobEdit:
    def test_closed_job_is_read_only(self, team, clients, job_factory):
        company, _ = team
        job = job_factory(company, status="closed")
        response = patch(clients[MemberRole.ADMIN], job, title="Nope")
        assert response.status_code == 409 and response.json()["code"] == "job_closed"
        job.refresh_from_db()
        assert job.title != "Nope"

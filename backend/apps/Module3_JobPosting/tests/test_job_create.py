from datetime import timedelta

import pytest
from django.utils import timezone

from apps.common.choices import CompanyStatus, MemberRole
from apps.Module3_JobPosting.models import JobPosting

from .helpers import JOBS, future, payload

pytestmark = pytest.mark.django_db


class TestAccess:
    def test_anonymous_is_401(self, api_client):
        assert api_client.post(JOBS, payload(), format="json").status_code == 401

    def test_candidate_and_platform_admin_are_403(self, auth_client, user_factory):
        from apps.common.choices import UserRole

        candidate = auth_client(user_factory())
        admin = auth_client(user_factory(role=UserRole.PLATFORM_ADMIN))
        for client in (candidate, admin):
            response = client.post(JOBS, payload(), format="json")
            assert response.status_code == 403 and response.json()["detail"] == "Unauthorized access."

    @pytest.mark.parametrize("role", [MemberRole.ADMIN, MemberRole.HR_MANAGER, MemberRole.RECRUITER])
    def test_editors_can_create(self, clients, role):
        assert clients[role].post(JOBS, payload(), format="json").status_code == 201

    def test_viewer_cannot_create(self, clients):
        response = clients[MemberRole.VIEWER].post(JOBS, payload(), format="json")
        assert response.status_code == 403 and response.json()["detail"] == "Unauthorized access."
        assert JobPosting.objects.count() == 0

    @pytest.mark.parametrize("status", [CompanyStatus.SUSPENDED, CompanyStatus.PENDING, CompanyStatus.REJECTED])
    def test_company_must_be_approved(self, member_factory, auth_client, status):
        user = member_factory(MemberRole.ADMIN, company_status=status)
        assert auth_client(user).post(JOBS, payload(), format="json").status_code == 403


class TestDraft:
    def test_title_and_department_are_enough_for_a_draft(self, clients):
        response = clients[MemberRole.RECRUITER].post(JOBS, {"title": "Intern", "department": "Data"}, format="json")
        assert response.status_code == 201
        body = response.json()
        assert body["status"] == "draft" and body["share_url"] == "" and body["form_slug"] is None
        assert body["applications_count"] == 0 and body["custom_fields"] == [] and body["deadline"] is None
        assert body["min_experience_years"] == 0 and body["openings"] == 1 and body["education_level"] == "none"

    def test_company_and_creator_come_from_the_logged_in_user(self, team, clients):
        company, users = team
        recruiter = users[MemberRole.RECRUITER]
        body = clients[MemberRole.RECRUITER].post(JOBS, payload(), format="json").json()
        job = JobPosting.objects.get(pk=body["id"])
        assert job.company == company and job.created_by == recruiter and job.updated_by == recruiter
        assert body["created_by"] == {"id": str(recruiter.pk), "full_name": recruiter.full_name}

    def test_server_owned_fields_in_the_body_are_ignored(self, team, clients, company_factory):
        other = company_factory()
        body = clients[MemberRole.ADMIN].post(
            JOBS,
            payload(company=str(other.pk), status="open", form_slug="hacked", created_by="x", close_reason="manual", published_at="2020-01-01T00:00:00Z"),
            format="json",
        ).json()
        job = JobPosting.objects.get(pk=body["id"])
        assert job.company == team[0] and job.status == "draft" and job.form_slug is None
        assert job.close_reason is None and job.published_at is None

    def test_full_payload_is_stored(self, clients):
        body = clients[MemberRole.ADMIN].post(JOBS, payload(), format="json").json()
        assert body["required_skills"] == ["Python", "Django", "PostgreSQL"]
        assert (body["salary_min"], body["salary_max"], body["salary_currency"], body["show_salary"]) == (150000, 250000, "PKR", True)
        assert (body["employment_type"], body["work_mode"], body["openings"]) == ("full_time", "hybrid", 2)

    def test_deadline_with_offset_is_stored_in_utc(self, clients):
        local = (timezone.now() + timedelta(days=10)).astimezone(timezone.get_fixed_timezone(300)).replace(microsecond=0)
        body = clients[MemberRole.ADMIN].post(JOBS, payload(deadline=local.isoformat()), format="json").json()
        stored = JobPosting.objects.get(pk=body["id"]).deadline
        assert stored == local and stored.utcoffset() == timedelta(0)
        assert body["deadline"].endswith("Z") or body["deadline"].endswith("+00:00")

    def test_skills_are_trimmed_and_deduplicated(self, clients):
        body = clients[MemberRole.ADMIN].post(JOBS, payload(required_skills=[" Python ", "python", "SQL"], soft_skills=["Teamwork", "teamwork"]), format="json").json()
        assert body["required_skills"] == ["Python", "SQL"] and body["soft_skills"] == ["Teamwork"]


class TestValidation:
    @pytest.mark.parametrize(
        "overrides,field",
        [
            ({"title": ""}, "title"),
            ({"title": "x" * 151}, "title"),
            ({"department": ""}, "department"),
            ({"department": "x" * 101}, "department"),
            ({"employment_type": "gig"}, "employment_type"),
            ({"work_mode": "moon"}, "work_mode"),
            ({"education_level": "wizard"}, "education_level"),
            ({"min_experience_years": 31}, "min_experience_years"),
            ({"min_experience_years": -1}, "min_experience_years"),
            ({"openings": 0}, "openings"),
            ({"salary_min": -5}, "salary_min"),
            ({"salary_max": 10, "salary_min": 20}, "salary_max"),
            ({"deadline": "not-a-date"}, "deadline"),
            ({"deadline": (timezone.now() - timedelta(days=1)).isoformat()}, "deadline"),
            ({"required_skills": [""]}, "required_skills"),
            ({"required_skills": ["x" * 51]}, "required_skills"),
            ({"required_skills": [f"s{i}" for i in range(31)]}, "required_skills"),
            ({"required_skills": "Python"}, "required_skills"),
            ({"description": "x" * 10001}, "description"),
            ({"location": "x" * 201}, "location"),
            ({"salary_currency": "x" * 11}, "salary_currency"),
        ],
    )
    def test_invalid_input_is_400_with_the_field_name(self, clients, overrides, field):
        response = clients[MemberRole.ADMIN].post(JOBS, payload(**overrides), format="json")
        assert response.status_code == 400 and field in response.json()
        assert JobPosting.objects.count() == 0

    def test_missing_title_and_department_are_both_reported(self, clients):
        response = clients[MemberRole.ADMIN].post(JOBS, {}, format="json")
        assert response.status_code == 400 and {"title", "department"} <= set(response.json())

    def test_salary_equal_min_and_max_is_allowed(self, clients):
        assert clients[MemberRole.ADMIN].post(JOBS, payload(salary_min=100, salary_max=100), format="json").status_code == 201


class TestCreateAndPublish:
    def test_tc14_recruiter_creates_and_publishes_a_job_with_a_14_day_deadline(self, clients):
        deadline = future(14).replace(microsecond=0)
        response = clients[MemberRole.RECRUITER].post(JOBS, payload(deadline=deadline.isoformat(), publish=True), format="json")
        assert response.status_code == 201
        body = response.json()
        assert body["status"] == "open" and body["published_at"] and body["form_slug"]
        assert body["share_url"].endswith(f"/apply/{body['form_slug']}")
        assert JobPosting.objects.get(pk=body["id"]).deadline == deadline
        assert body["days_left"] == 14
        listing = clients[MemberRole.RECRUITER].get(JOBS).json()["results"]
        assert [(job["id"], job["status"]) for job in listing] == [(body["id"], "open")]

    def test_incomplete_publish_is_400_and_creates_nothing(self, clients):
        response = clients[MemberRole.ADMIN].post(JOBS, {"title": "T", "department": "D", "publish": True}, format="json")
        assert response.status_code == 400
        assert {"description", "required_skills", "employment_type", "location", "deadline"} <= set(response.json())
        assert JobPosting.objects.count() == 0

    def test_publish_false_saves_a_draft(self, clients):
        body = clients[MemberRole.ADMIN].post(JOBS, payload(publish=False), format="json").json()
        assert body["status"] == "draft"

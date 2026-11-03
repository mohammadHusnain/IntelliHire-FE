from datetime import timedelta

import pytest
from django.utils import timezone

from apps.common.choices import CompanyStatus, MemberRole

from .helpers import JOBS, future, job_url

pytestmark = pytest.mark.django_db


@pytest.fixture
def jobs(team, job_factory):
    company, users = team
    admin = users[MemberRole.ADMIN]
    return {
        "draft": job_factory(company, admin, title="Draft Data Analyst", department="Data", employment_type="part_time"),
        "open": job_factory(company, admin, status="open", title="Senior Django Engineer", department="Engineering", deadline=future(5)),
        "later": job_factory(company, admin, status="open", title="QA Engineer", department="Quality", employment_type="contract", deadline=future(20)),
        "closed": job_factory(company, admin, status="closed", title="Old Designer", department="Design", employment_type="internship"),
    }


def titles(response):
    return [job["title"] for job in response.json()["results"]]


class TestAccess:
    def test_anonymous_and_outsiders(self, api_client, auth_client, user_factory):
        assert api_client.get(JOBS).status_code == 401
        assert auth_client(user_factory()).get(JOBS).status_code == 403

    @pytest.mark.parametrize("role", MemberRole.values)
    def test_every_member_can_list_and_read(self, clients, jobs, role):
        assert clients[role].get(JOBS).status_code == 200
        assert clients[role].get(job_url(jobs["open"])).status_code == 200

    @pytest.mark.parametrize("status", [CompanyStatus.SUSPENDED])
    def test_suspended_company_loses_access_but_keeps_its_jobs(self, team, clients, jobs, status):
        company, _ = team
        company.status, company.suspension_reason = status, "Policy violation under review."
        company.save()
        assert clients[MemberRole.ADMIN].get(JOBS).status_code == 403
        from apps.Module3_JobPosting.models import JobPosting

        assert JobPosting.objects.filter(company=company).count() == 4


class TestList:
    def test_lists_every_job_of_the_company_newest_first(self, clients, jobs):
        response = clients[MemberRole.VIEWER].get(JOBS)
        assert titles(response) == ["Old Designer", "QA Engineer", "Senior Django Engineer", "Draft Data Analyst"]
        assert response.json()["count"] == 4

    def test_items_expose_count_days_left_and_share_url(self, clients, jobs):
        rows = {row["title"]: row for row in clients[MemberRole.ADMIN].get(JOBS).json()["results"]}
        assert set(rows["QA Engineer"]) == {
            "id", "title", "department", "employment_type", "work_mode", "location", "status", "deadline",
            "days_left", "applications_count", "share_url", "created_at", "published_at",
        }
        assert rows["Senior Django Engineer"]["days_left"] == 5 and rows["QA Engineer"]["days_left"] == 20
        assert rows["Draft Data Analyst"]["days_left"] is None and rows["Draft Data Analyst"]["share_url"] == ""
        assert rows["Old Designer"]["days_left"] is None
        assert rows["Senior Django Engineer"]["share_url"].endswith("/apply/" + jobs["open"].form_slug)
        assert all(row["applications_count"] == 0 for row in rows.values())

    def test_days_left_rounds_up_and_never_goes_negative(self, team, job_factory, clients):
        company, _ = team
        job_factory(company, status="open", title="Soon", deadline=timezone.now() + timedelta(hours=2))
        job_factory(company, status="open", title="Passed", deadline=timezone.now() - timedelta(hours=2))
        rows = {r["title"]: r for r in clients[MemberRole.ADMIN].get(JOBS).json()["results"]}
        assert rows["Soon"]["days_left"] == 1 and rows["Passed"]["days_left"] == 0

    @pytest.mark.parametrize(
        "query,expected",
        [
            ({"status": "open"}, {"Senior Django Engineer", "QA Engineer"}),
            ({"status": "draft"}, {"Draft Data Analyst"}),
            ({"status": "closed"}, {"Old Designer"}),
            ({"department": "engineering"}, {"Senior Django Engineer"}),
            ({"department": "ENGINEERING"}, {"Senior Django Engineer"}),
            ({"employment_type": "contract"}, {"QA Engineer"}),
            ({"status": "open", "employment_type": "full_time"}, {"Senior Django Engineer"}),
            ({"search": "django"}, {"Senior Django Engineer"}),
            ({"search": "ENGINEER"}, {"Senior Django Engineer", "QA Engineer"}),
            ({"search": "zzz"}, set()),
        ],
    )
    def test_filters_and_search(self, clients, jobs, query, expected):
        assert set(titles(clients[MemberRole.ADMIN].get(JOBS, query))) == expected

    @pytest.mark.parametrize("query", [{"status": "archived"}, {"employment_type": "gig"}])
    def test_invalid_filter_value_is_400(self, clients, jobs, query):
        assert clients[MemberRole.ADMIN].get(JOBS, query).status_code == 400

    def test_ordering_by_deadline_and_created_date(self, clients, jobs):
        client = clients[MemberRole.ADMIN]
        open_only = {"status": "open"}
        assert titles(client.get(JOBS, {**open_only, "ordering": "deadline"})) == ["Senior Django Engineer", "QA Engineer"]
        assert titles(client.get(JOBS, {**open_only, "ordering": "-deadline"})) == ["QA Engineer", "Senior Django Engineer"]
        assert titles(client.get(JOBS, {"ordering": "created_at"}))[0] == "Draft Data Analyst"
        assert client.get(JOBS, {"ordering": "applications_count"}).status_code == 200
        assert client.get(JOBS, {"ordering": "nonsense"}).status_code == 200

    def test_pagination(self, clients, jobs):
        body = clients[MemberRole.ADMIN].get(JOBS, {"page_size": 3}).json()
        assert body["count"] == 4 and len(body["results"]) == 3 and body["next"]

    def test_only_own_company_jobs(self, clients, jobs, member_factory, auth_client, job_factory):
        outsider = member_factory(MemberRole.ADMIN)
        job_factory(outsider.company_membership.company, outsider, title="Foreign Job")
        assert "Foreign Job" not in titles(clients[MemberRole.ADMIN].get(JOBS))
        assert titles(auth_client(outsider).get(JOBS)) == ["Foreign Job"]


class TestDetail:
    def test_detail_has_everything_including_custom_fields(self, team, clients, job_factory):
        company, users = team
        job = job_factory(
            company, users[MemberRole.ADMIN], status="open",
            fields=[{"label": "LinkedIn Profile URL", "key": "linkedin_profile_url", "field_type": "url"}],
        )
        body = clients[MemberRole.VIEWER].get(job_url(job)).json()
        assert body["id"] == str(job.pk) and body["form_slug"] == job.form_slug
        assert [f["key"] for f in body["custom_fields"]] == ["linkedin_profile_url"]
        assert {"description", "responsibilities", "required_skills", "soft_skills", "salary_min", "openings", "close_reason", "created_by", "updated_at"} <= set(body)

    def test_unknown_job_is_404(self, clients):
        assert clients[MemberRole.ADMIN].get(job_url("00000000-0000-0000-0000-000000000000")).status_code == 404

    def test_created_by_survives_a_deactivated_creator(self, team, clients, job_factory):
        company, users = team
        recruiter = users[MemberRole.RECRUITER]
        job = job_factory(company, recruiter)
        membership = recruiter.company_membership
        membership.is_active = False
        membership.save()
        body = clients[MemberRole.ADMIN].get(job_url(job)).json()
        assert body["created_by"]["id"] == str(recruiter.pk)

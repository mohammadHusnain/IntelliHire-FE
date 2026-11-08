"""The company dashboard (Doc §2.3, FR-16, TC-12) reads Modules 3 and 4; it must agree with their own endpoints."""
from datetime import timedelta

import pytest
from django.utils import timezone

from apps.common.choices import MemberRole
from apps.Module3_JobPosting.models import JobPosting
from apps.Module4_ApplicationManagement.models import Application

DASHBOARD = "/api/company/dashboard/"
PIPELINE = ["submitted", "under_review", "shortlisted", "interview", "selected", "rejected", "on_hold"]
pytestmark = pytest.mark.django_db


def days(n):
    return timezone.now() + timedelta(days=n)


@pytest.fixture
def busy(team, job_factory, apply, clients):
    """Open jobs closing in 3, 5, 20 and 10 days (and one already past), a draft and a closed job, with applications."""
    company, users = team
    admin = users[MemberRole.ADMIN]
    jobs = {
        "soon": job_factory(company, admin, status="open", title="Closes in 3 days", deadline=days(3)),
        "sooner": job_factory(company, admin, status="open", title="Closes in 5 days", deadline=days(5)),
        "later": job_factory(company, admin, status="open", title="Closes in 20 days", deadline=days(20)),
        "edge": job_factory(company, admin, status="open", title="Closes in 10 days", deadline=days(10)),
        "lagging": job_factory(company, admin, status="open", title="Past deadline, not yet closed", deadline=timezone.now() - timedelta(hours=1)),
        "draft": job_factory(company, admin, title="A draft", deadline=days(2)),
        "closed": job_factory(company, admin, status="open", title="Closed job"),
    }
    plan = [("soon", 2), ("later", 1), ("closed", 1)]
    for key, count in plan:
        for index in range(count):
            response = apply(jobs[key], email=f"{key}{index}@example.com", full_name=f"{key.title()} Person {index}")
            assert response.status_code == 201, response.content
    assert clients[MemberRole.ADMIN].post(f"/api/jobs/{jobs['closed'].pk}/close/").status_code == 200
    Application.objects.filter(job=jobs["soon"]).update(status="shortlisted")
    older = Application.objects.filter(job=jobs["later"]).get()
    Application.objects.filter(pk=older.pk).update(submitted_at=timezone.now() - timedelta(days=9), status="interview")
    return jobs


def get(client):
    response = client.get(DASHBOARD)
    assert response.status_code == 200, response.content
    return response.json()


class TestRealNumbers:
    def test_job_counts_follow_the_stored_status(self, clients, busy):
        assert get(clients[MemberRole.VIEWER])["jobs"] == {"open": 5, "draft": 1, "closed": 1}

    def test_applicants_total_new_and_pipeline(self, clients, busy):
        body = get(clients[MemberRole.ADMIN])
        assert body["applicants"] == {"total": 4, "new_last_7_days": 3}
        assert body["pipeline"] == {
            "submitted": 1, "under_review": 0, "shortlisted": 2, "interview": 1,
            "selected": 0, "rejected": 0, "on_hold": 0,
        }
        assert list(body["pipeline"]) == PIPELINE

    def test_closing_soon_lists_only_open_jobs_due_within_seven_days_soonest_first(self, clients, busy):
        rows = get(clients[MemberRole.ADMIN])["closing_soon"]
        assert [row["title"] for row in rows] == ["Closes in 3 days", "Closes in 5 days"]
        assert [row["application_count"] for row in rows] == [2, 0]
        assert set(rows[0]) == {"id", "title", "deadline", "application_count"} and rows[0]["id"] == str(busy["soon"].pk)

    def test_recent_applications_are_the_latest_five_newest_first(self, clients, busy, apply):
        for index in range(4):
            apply(busy["soon"], email=f"extra{index}@example.com", full_name=f"Extra {index}")
        rows = get(clients[MemberRole.ADMIN])["recent_applications"]
        assert len(rows) == 5
        assert set(rows[0]) == {"id", "candidate_name", "job_title", "submitted_at", "status"}
        stamps = [row["submitted_at"] for row in rows]
        assert stamps == sorted(stamps, reverse=True)
        assert rows[0]["candidate_name"] == "Extra 3" and rows[0]["job_title"] == "Closes in 3 days"

    def test_the_company_and_team_blocks_are_unchanged(self, clients, busy):
        body = get(clients[MemberRole.ADMIN])
        assert body["company"]["status"] == "approved" and body["team"]["active_members"] == 4

    def test_a_status_change_moves_the_pipeline(self, clients, busy):
        first = Application.objects.filter(job=busy["closed"]).get()
        before = get(clients[MemberRole.ADMIN])["pipeline"]
        clients[MemberRole.RECRUITER].patch(f"/api/applications/{first.pk}/status/", {"status": "selected"}, format="json")
        after = get(clients[MemberRole.ADMIN])["pipeline"]
        assert (after["submitted"], after["selected"]) == (before["submitted"] - 1, before["selected"] + 1)

    def test_closing_or_publishing_moves_the_job_counts(self, clients, busy, team):
        client = clients[MemberRole.ADMIN]
        client.post(f"/api/jobs/{busy['sooner'].pk}/close/")
        body = get(client)
        assert body["jobs"]["open"] == 4 and body["jobs"]["closed"] == 2
        assert [row["title"] for row in body["closing_soon"]] == ["Closes in 3 days"]

    def test_the_auto_close_command_is_reflected(self, clients, busy):
        from apps.Module3_JobPosting.services.lifecycle import close_expired_jobs

        assert close_expired_jobs() == 1
        assert get(clients[MemberRole.ADMIN])["jobs"] == {"open": 4, "draft": 1, "closed": 2}


class TestAgreesWithTheOtherEndpoints:
    def test_job_counts_match_the_job_list(self, clients, busy):
        client = clients[MemberRole.ADMIN]
        counts = {status: client.get("/api/jobs/", {"status": status}).json()["count"] for status in ("open", "draft", "closed")}
        assert get(client)["jobs"] == counts

    def test_pipeline_and_total_match_the_application_lists(self, clients, busy):
        client = clients[MemberRole.ADMIN]
        body = get(client)
        assert body["applicants"]["total"] == client.get("/api/applications/").json()["count"]
        for status, number in body["pipeline"].items():
            assert number == client.get("/api/applications/", {"status": status}).json()["count"], status
        summed = {status: 0 for status in PIPELINE}
        for job in JobPosting.objects.filter(company=busy["soon"].company):
            for status, number in client.get(f"/api/jobs/{job.pk}/applications/").json()["status_counts"].items():
                if status != "total":
                    summed[status] += number
        assert summed == body["pipeline"]

    def test_recent_applications_are_the_first_rows_of_the_company_list(self, clients, busy):
        client = clients[MemberRole.ADMIN]
        listed = client.get("/api/applications/", {"page_size": 5}).json()["results"]
        recent = get(client)["recent_applications"]
        assert [(r["candidate_name"], r["job_title"], r["status"]) for r in recent] == [
            (r["full_name"], r["job"]["title"], r["status"]) for r in listed
        ]
        # the id is the application's own id: it opens that application
        assert [r["id"] for r in recent] == [r["id"] for r in listed]
        assert client.get(f"/api/applications/{recent[0]['id']}/").status_code == 200

    def test_closing_soon_counts_match_the_job_list(self, clients, busy):
        client = clients[MemberRole.ADMIN]
        by_title = {row["title"]: row["applications_count"] for row in client.get("/api/jobs/").json()["results"]}
        for row in get(client)["closing_soon"]:
            assert row["application_count"] == by_title[row["title"]]

    def test_every_role_sees_the_same_numbers(self, clients, busy):
        bodies = [get(clients[role]) for role in MemberRole.values]
        assert all(body["jobs"] == bodies[0]["jobs"] and body["pipeline"] == bodies[0]["pipeline"] for body in bodies)


class TestIsolationAndLimits:
    def test_another_companys_data_is_never_counted(self, clients, busy, member_factory, auth_client):
        outsider = auth_client(member_factory(MemberRole.ADMIN))
        body = get(outsider)
        assert body["jobs"] == {"open": 0, "draft": 0, "closed": 0}
        assert body["applicants"] == {"total": 0, "new_last_7_days": 0} and body["closing_soon"] == [] and body["recent_applications"] == []

    def test_a_suspended_company_gets_403(self, team, clients, busy):
        company, _ = team
        company.status, company.suspension_reason = "suspended", "Policy violation under review."
        company.save()
        assert clients[MemberRole.ADMIN].get(DASHBOARD).status_code == 403

    def test_closing_soon_is_bounded(self, team, clients, job_factory):
        company, users = team
        for index in range(25):
            job_factory(company, users[MemberRole.ADMIN], status="open", deadline=days(2) + timedelta(minutes=index))
        assert len(get(clients[MemberRole.ADMIN])["closing_soon"]) == 20

    def test_the_number_of_queries_does_not_grow_with_the_data(self, team, clients, busy, apply, django_assert_max_num_queries):
        client = clients[MemberRole.ADMIN]
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        with CaptureQueriesContext(connection) as small:
            get(client)
        for index in range(12):
            apply(busy["soon"], email=f"bulk{index}@example.com")
        with CaptureQueriesContext(connection) as large:
            get(client)
        assert len(large) == len(small) and len(large) <= 14, (len(small), len(large))


def test_tc12_admin_updates_the_profile_a_viewer_cannot_and_the_dashboard_has_every_block(clients, busy):
    assert clients[MemberRole.ADMIN].patch("/api/company/profile/", {"headquarters": "Lahore"}, format="json").status_code == 200
    denied = clients[MemberRole.VIEWER].patch("/api/company/profile/", {"headquarters": "Karachi"}, format="json")
    assert denied.status_code == 403 and denied.json()["detail"] == "Unauthorized access."
    body = get(clients[MemberRole.VIEWER])
    assert set(body) == {"company", "jobs", "applicants", "pipeline", "closing_soon", "recent_applications", "team"}
    assert body["company"]["profile_completion"] == 20

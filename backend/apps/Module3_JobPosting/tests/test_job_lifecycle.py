import re
from datetime import timedelta
from io import StringIO
from unittest import mock

import pytest
from django.core.management import call_command
from django.utils import timezone

from apps.common.choices import MemberRole
from apps.Module3_JobPosting.models import ApplicationField, JobPosting
from apps.Module3_JobPosting.services import lifecycle

from .helpers import future, job_url

pytestmark = pytest.mark.django_db


@pytest.fixture
def draft(team, job_factory):
    company, users = team
    return job_factory(company, users[MemberRole.ADMIN], deadline=future(14), title="Ready")


class TestPublish:
    def test_publish_opens_the_job_and_returns_the_share_url(self, clients, draft):
        response = clients[MemberRole.RECRUITER].post(job_url(draft, "publish"))
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "open" and body["published_at"] and body["close_reason"] is None
        assert re.fullmatch(r"[A-Za-z0-9_-]{10}", body["form_slug"])
        assert body["share_url"].endswith(f"/apply/{body['form_slug']}")

    @pytest.mark.parametrize("role", [MemberRole.ADMIN, MemberRole.HR_MANAGER, MemberRole.RECRUITER])
    def test_editors_can_publish(self, clients, draft, role):
        assert clients[role].post(job_url(draft, "publish")).status_code == 200

    def test_viewer_cannot_publish(self, clients, draft):
        assert clients[MemberRole.VIEWER].post(job_url(draft, "publish")).status_code == 403
        draft.refresh_from_db()
        assert draft.status == "draft"

    def test_publish_is_only_allowed_from_draft(self, clients, draft):
        clients[MemberRole.ADMIN].post(job_url(draft, "publish"))
        again = clients[MemberRole.ADMIN].post(job_url(draft, "publish"))
        assert again.status_code == 409 and again.json()["code"] == "invalid_state"

    @pytest.mark.parametrize(
        "overrides,field",
        [
            ({"description": ""}, "description"),
            ({"description": "   "}, "description"),
            ({"required_skills": []}, "required_skills"),
            ({"employment_type": ""}, "employment_type"),
            ({"deadline": None}, "deadline"),
            ({"deadline": timezone.now() + timedelta(minutes=30)}, "deadline"),
            ({"deadline": timezone.now() - timedelta(days=1)}, "deadline"),
            ({"deadline": timezone.now() + timedelta(days=200)}, "deadline"),
            ({"location": ""}, "location"),
            ({"location": "", "work_mode": ""}, "location"),
        ],
    )
    def test_incomplete_jobs_are_refused_with_the_failing_field(self, clients, draft, overrides, field):
        JobPosting.objects.filter(pk=draft.pk).update(**overrides)
        response = clients[MemberRole.ADMIN].post(job_url(draft, "publish"))
        assert response.status_code == 400 and field in response.json()
        draft.refresh_from_db()
        assert draft.status == "draft" and draft.form_slug is None

    def test_remote_job_needs_no_location(self, clients, draft):
        JobPosting.objects.filter(pk=draft.pk).update(location="", work_mode="remote")
        assert clients[MemberRole.ADMIN].post(job_url(draft, "publish")).status_code == 200

    def test_deadline_exactly_over_the_one_hour_lead_is_accepted(self, clients, draft):
        JobPosting.objects.filter(pk=draft.pk).update(deadline=timezone.now() + timedelta(hours=1, minutes=1))
        assert clients[MemberRole.ADMIN].post(job_url(draft, "publish")).status_code == 200

    def test_all_problems_are_reported_together(self, clients, team, job_factory):
        company, _ = team
        bare = job_factory(company, description="", required_skills=[], employment_type="", location="")
        body = clients[MemberRole.ADMIN].post(job_url(bare, "publish")).json()
        assert {"description", "required_skills", "employment_type", "location", "deadline"} <= set(body)

    def test_slug_collision_is_retried(self, clients, draft, team, job_factory):
        company, _ = team
        job_factory(company, status="open", form_slug="TAKENSLUG1")
        with mock.patch.object(lifecycle, "_new_slug", side_effect=["TAKENSLUG1", "TAKENSLUG1", "FreshSlug_9"]):
            response = clients[MemberRole.ADMIN].post(job_url(draft, "publish"))
        assert response.status_code == 200 and response.json()["form_slug"] == "FreshSlug_9"

    def test_five_collisions_give_a_clear_error_and_leave_a_draft(self, clients, draft, team, job_factory):
        company, _ = team
        job_factory(company, status="open", form_slug="TAKENSLUG1")
        with mock.patch.object(lifecycle, "_new_slug", return_value="TAKENSLUG1") as generator:
            response = clients[MemberRole.ADMIN].post(job_url(draft, "publish"))
        assert generator.call_count == 5
        assert response.status_code == 503 and response.json()["code"] == "slug_unavailable"
        draft.refresh_from_db()
        assert draft.status == "draft" and draft.form_slug is None and draft.published_at is None

    def test_slugs_are_random_and_distinct(self, clients, team, job_factory):
        company, _ = team
        slugs = set()
        for _ in range(8):
            job = job_factory(company, deadline=future(14))
            slugs.add(clients[MemberRole.ADMIN].post(job_url(job, "publish")).json()["form_slug"])
        assert len(slugs) == 8


class TestClose:
    def test_manual_close(self, clients, team, job_factory):
        company, _ = team
        job = job_factory(company, status="open")
        response = clients[MemberRole.RECRUITER].post(job_url(job, "close"))
        assert response.status_code == 200
        body = response.json()
        assert (body["status"], body["close_reason"]) == ("closed", "manual") and body["closed_at"]
        assert body["form_slug"] == job.form_slug

    @pytest.mark.parametrize("status", ["draft", "closed"])
    def test_only_open_jobs_can_be_closed(self, clients, team, job_factory, status):
        company, _ = team
        job = job_factory(company, status=status)
        response = clients[MemberRole.ADMIN].post(job_url(job, "close"))
        assert response.status_code == 409 and response.json()["code"] == "invalid_state"

    def test_viewer_cannot_close(self, clients, team, job_factory):
        company, _ = team
        job = job_factory(company, status="open")
        assert clients[MemberRole.VIEWER].post(job_url(job, "close")).status_code == 403

    def test_an_open_job_past_its_deadline_can_still_be_closed_by_hand(self, clients, team, job_factory):
        company, _ = team
        job = job_factory(company, status="open", deadline=timezone.now() - timedelta(minutes=5))
        assert clients[MemberRole.ADMIN].post(job_url(job, "close")).json()["close_reason"] == "manual"


class TestReopen:
    @pytest.fixture
    def closed(self, team, job_factory):
        company, _ = team
        return job_factory(company, status="closed")

    @pytest.mark.parametrize("role", [MemberRole.ADMIN, MemberRole.HR_MANAGER])
    def test_admin_and_hr_manager_can_reopen_with_a_new_deadline(self, clients, closed, role):
        deadline = future(10).replace(microsecond=0)
        response = clients[role].post(job_url(closed, "reopen"), {"deadline": deadline.isoformat()}, format="json")
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "open" and body["form_slug"] == closed.form_slug
        assert body["close_reason"] is None and body["closed_at"] is None
        closed.refresh_from_db()
        assert closed.deadline == deadline

    @pytest.mark.parametrize("role", [MemberRole.RECRUITER, MemberRole.VIEWER])
    def test_recruiter_and_viewer_cannot_reopen(self, clients, closed, role):
        response = clients[role].post(job_url(closed, "reopen"), {"deadline": future(5).isoformat()}, format="json")
        assert response.status_code == 403
        closed.refresh_from_db()
        assert closed.status == "closed"

    @pytest.mark.parametrize("deadline", [None, "garbage", "past", "far"])
    def test_deadline_must_be_a_valid_future_time(self, clients, closed, deadline):
        value = {
            None: None, "garbage": "garbage", "past": (timezone.now() - timedelta(days=1)).isoformat(), "far": future(400).isoformat()
        }[deadline]
        body = {} if deadline is None else {"deadline": value}
        response = clients[MemberRole.ADMIN].post(job_url(closed, "reopen"), body, format="json")
        assert response.status_code == 400 and "deadline" in response.json()
        closed.refresh_from_db()
        assert closed.status == "closed"

    @pytest.mark.parametrize("status", ["draft", "open"])
    def test_only_closed_jobs_can_be_reopened(self, clients, team, job_factory, status):
        company, _ = team
        job = job_factory(company, status=status)
        response = clients[MemberRole.ADMIN].post(job_url(job, "reopen"), {"deadline": future(5).isoformat()}, format="json")
        assert response.status_code == 409 and response.json()["code"] == "invalid_state"

    def test_a_deadline_closed_job_can_be_reopened_and_closes_again_on_the_next_expiry(self, clients, team, job_factory):
        company, _ = team
        job = job_factory(company, status="open", deadline=timezone.now() - timedelta(minutes=1))
        call_command("close_expired_jobs", stdout=StringIO())
        job.refresh_from_db()
        assert job.close_reason == "deadline"
        response = clients[MemberRole.ADMIN].post(job_url(job, "reopen"), {"deadline": future(3).isoformat()}, format="json")
        assert response.status_code == 200 and response.json()["close_reason"] is None


class TestDelete:
    def test_admin_and_hr_manager_delete_drafts_with_their_fields(self, clients, team, job_factory):
        company, _ = team
        for role in (MemberRole.ADMIN, MemberRole.HR_MANAGER):
            job = job_factory(company, fields=[{"label": "X", "key": "x", "field_type": "short_text"}])
            assert clients[role].delete(job_url(job)).status_code == 204
            assert not JobPosting.objects.filter(pk=job.pk).exists()
        assert ApplicationField.objects.count() == 0

    @pytest.mark.parametrize("role", [MemberRole.RECRUITER, MemberRole.VIEWER])
    def test_recruiter_and_viewer_cannot_delete(self, clients, team, job_factory, role):
        company, _ = team
        job = job_factory(company)
        assert clients[role].delete(job_url(job)).status_code == 403
        assert JobPosting.objects.filter(pk=job.pk).exists()

    @pytest.mark.parametrize("status", ["open", "closed"])
    def test_published_jobs_are_never_deleted(self, clients, team, job_factory, status):
        company, _ = team
        job = job_factory(company, status=status)
        response = clients[MemberRole.ADMIN].delete(job_url(job))
        assert response.status_code == 409 and response.json()["code"] == "invalid_state"
        assert JobPosting.objects.filter(pk=job.pk).exists()


class TestDuplicate:
    def test_copy_is_a_fresh_draft_with_the_same_content_and_fields(self, team, clients, job_factory):
        company, users = team
        source = job_factory(
            company, users[MemberRole.ADMIN], status="open", title="Original", salary_min=1, salary_max=2,
            fields=[
                {"label": "Portfolio", "key": "portfolio", "field_type": "url", "required": True, "help_text": "Link"},
                {"label": "Level", "key": "level", "field_type": "single_choice", "options": ["A", "B"]},
            ],
        )
        response = clients[MemberRole.RECRUITER].post(job_url(source, "duplicate"))
        assert response.status_code == 201
        body = response.json()
        assert body["id"] != str(source.pk) and body["title"] == "Original (copy)"
        assert body["status"] == "draft" and body["form_slug"] is None and body["deadline"] is None
        assert body["published_at"] is None and body["share_url"] == ""
        assert [(f["key"], f["field_type"], f["required"], f["options"]) for f in body["custom_fields"]] == [
            ("portfolio", "url", True, []), ("level", "single_choice", False, ["A", "B"]),
        ]
        copy = JobPosting.objects.get(pk=body["id"])
        assert copy.created_by == users[MemberRole.RECRUITER] and copy.salary_max == 2
        assert source.custom_fields.count() == 2  # the original is untouched

    def test_long_titles_are_shortened_to_fit(self, team, clients, job_factory):
        company, _ = team
        source = job_factory(company, title="T" * 150)
        body = clients[MemberRole.ADMIN].post(job_url(source, "duplicate")).json()
        assert len(body["title"]) == 150 and body["title"].endswith(" (copy)")

    def test_works_from_a_closed_job_and_viewer_is_refused(self, team, clients, job_factory):
        company, _ = team
        source = job_factory(company, status="closed")
        assert clients[MemberRole.VIEWER].post(job_url(source, "duplicate")).status_code == 403
        assert clients[MemberRole.ADMIN].post(job_url(source, "duplicate")).status_code == 201

    def test_copy_can_be_edited_without_touching_the_original_fields(self, team, clients, job_factory):
        company, _ = team
        source = job_factory(company, fields=[{"label": "X", "key": "x", "field_type": "short_text"}])
        copy_id = clients[MemberRole.ADMIN].post(job_url(source, "duplicate")).json()["id"]
        field_id = clients[MemberRole.ADMIN].get(job_url(copy_id, "fields")).json()[0]["id"]
        clients[MemberRole.ADMIN].patch(job_url(copy_id, f"fields/{field_id}"), {"label": "Changed"}, format="json")
        assert source.custom_fields.get().label == "X"


class TestCloseExpiredJobs:
    def test_tc16_command_closes_expired_open_jobs_with_reason_deadline(self, team, job_factory):
        company, _ = team
        expired = job_factory(company, status="open", deadline=timezone.now() - timedelta(minutes=1))
        out = StringIO()
        call_command("close_expired_jobs", stdout=out)
        expired.refresh_from_db()
        assert (expired.status, expired.close_reason) == ("closed", "deadline") and expired.closed_at
        assert "Closed 1 expired job(s)." in out.getvalue()

    def test_only_open_jobs_past_their_deadline_are_touched(self, team, job_factory):
        company, _ = team
        later = job_factory(company, status="open", deadline=future(2))
        draft = job_factory(company, deadline=timezone.now() - timedelta(days=1))
        closed = job_factory(company, status="closed", deadline=timezone.now() - timedelta(days=1))
        expired = [job_factory(company, status="open", deadline=timezone.now() - timedelta(hours=h)) for h in (1, 5, 30)]
        assert lifecycle.close_expired_jobs() == 3
        for job in (later, draft, closed):
            before = (job.status, job.close_reason)
            job.refresh_from_db()
            assert (job.status, job.close_reason) == before
        assert all(JobPosting.objects.get(pk=j.pk).status == "closed" for j in expired)

    def test_running_it_twice_changes_nothing_the_second_time(self, team, job_factory):
        company, _ = team
        job_factory(company, status="open", deadline=timezone.now() - timedelta(minutes=1))
        assert lifecycle.close_expired_jobs() == 1 and lifecycle.close_expired_jobs() == 0

    def test_it_is_a_single_bulk_update(self, team, job_factory, django_assert_num_queries):
        company, _ = team
        for _ in range(5):
            job_factory(company, status="open", deadline=timezone.now() - timedelta(minutes=1))
        with django_assert_num_queries(1):
            assert lifecycle.close_expired_jobs() == 5

    def test_an_expired_open_job_is_not_accepting_even_before_the_command_runs(self, team, job_factory):
        company, _ = team
        job = job_factory(company, status="open", deadline=timezone.now() - timedelta(minutes=1))
        assert job.status == "open" and job.is_accepting_applications is False

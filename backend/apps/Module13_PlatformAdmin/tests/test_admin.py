"""The platform admin panel (FR-71 to FR-76, UC-13, TC-46): dashboard, details, monitors, moderation, log, health, AI settings."""
import io
import threading
import uuid
from datetime import timedelta

import pytest
from django.core.management import call_command
from django.db import connection
from django.utils import timezone

from apps.common.choices import CompanyStatus, MemberRole, UserRole, UserStatus
from apps.Module12_Communities.models import Community, CommunityPost
from apps.Module12_Communities.services import posts as community_posts
from apps.Module3_JobPosting.models import JobPosting
from apps.Module4_ApplicationManagement.models import Application
from apps.Module5_Foundation.models import ActivityEvent, AIRequestLog, AISettings, PromptTemplate, SystemAlert
from apps.Module5_Foundation.ai.config import get_config
from apps.Module5_Foundation.events import log_event

from ..models import BackupRecord, FlagStatus, ModerationFlag
from ..services import metrics, moderation
from .conftest import ADMIN

pytestmark = pytest.mark.django_db


@pytest.fixture
def flag(job, platform_admin):
    return moderation.raise_flag(target_type="job", target_id=job.pk, reason="Looks like a scam", source="admin", reported_by=platform_admin)[0]


class TestAccess:
    URLS = ["dashboard/", "jobs/", "communities/", "moderation/", "activity/", "health/", "alerts/", "ai-settings/", "prompts/", "ai-usage/"]

    def test_everything_needs_a_platform_admin(self, api_client, admin_client, clients, auth_client, candidate):
        for url in self.URLS:
            assert api_client.get(ADMIN + url).status_code == 401, url
            assert clients[MemberRole.ADMIN].get(ADMIN + url).status_code == 403, url
            assert auth_client(candidate).get(ADMIN + url).status_code == 403, url
            assert admin_client.get(ADMIN + url).status_code == 200, url


class TestDashboard:
    def test_it_counts_every_block(self, admin_client, team, job, community, candidate):
        body = admin_client.get(ADMIN + "dashboard/").json()
        assert body["users"]["by_role"][UserRole.CANDIDATE] >= 1 and body["users"]["total"] >= 1
        assert body["companies"]["by_status"][CompanyStatus.APPROVED] == 1 and body["companies"]["pending_review"] == 0
        assert body["jobs"]["open"] == 1 and body["communities"]["total"] == 1
        assert body["applications"]["last_7_days"] == 0 and body["moderation"]["open_flags"] == 0 and body["alerts"]["active"] == 0
        assert set(body["ai_last_24h"]) == {"calls", "failures", "average_latency_ms", "prompt_tokens", "completion_tokens"}

    def test_the_ai_summary_covers_the_last_24_hours_only(self, admin_client):
        AIRequestLog.objects.create(feature="cv_extract", provider="fake", status="ok", latency_ms=100, prompt_tokens=10, completion_tokens=5)
        old = AIRequestLog.objects.create(feature="cv_extract", provider="fake", status="failed", latency_ms=900)
        AIRequestLog.objects.filter(pk=old.pk).update(created_at=timezone.now() - timedelta(days=2))
        body = admin_client.get(ADMIN + "dashboard/").json()["ai_last_24h"]
        assert body["calls"] == 1 and body["failures"] == 0 and body["average_latency_ms"] == 100 and body["prompt_tokens"] == 10

    def test_interviews_are_counted_per_kind_for_30_days(self, admin_client, team, job):
        from apps.Module7_Interviews.models import InterviewSession

        app = Application.objects.create(job=job, reference="IH-A00001", full_name="A", email="a@example.com", phone="+923001234567", education_level="bachelor", institution="I", graduation_year=2020, resume_original_name="cv.pdf")
        InterviewSession.objects.create(kind="screening", application=app, token_hash="a" * 64, status="evaluated", role_title="r", question_target=6, expires_at=timezone.now(), completed_at=timezone.now())
        assert admin_client.get(ADMIN + "dashboard/").json()["interviews_30_days"] == {"screening": 1}

    def test_the_query_count_does_not_grow_with_the_data(self, admin_client, team, job_factory):
        from django.test.utils import CaptureQueriesContext

        company, users = team

        def count():
            with CaptureQueriesContext(connection) as queries:
                assert admin_client.get(ADMIN + "dashboard/").status_code == 200
            return len(queries)

        few = count()
        for _ in range(10):
            job_factory(company, users[MemberRole.ADMIN], status="open")
        assert count() == few


class TestDetails:
    def test_a_candidate_detail_shows_counts_activity_and_flags(self, admin_client, candidate, job):
        Application.objects.create(job=job, reference="IH-B00001", full_name="Sara", email=candidate.email, phone="+923001234567", education_level="bachelor", institution="I", graduation_year=2020, resume_original_name="cv.pdf")
        log_event("user.suspended", actor=None, target=candidate, summary="Account suspended")
        moderation.raise_flag(target_type="user", target_id=candidate.pk, reason="Spam", source="admin")
        body = admin_client.get(f"{ADMIN}users/{candidate.pk}/detail/").json()
        assert body["email"] == candidate.email and body["counts"]["applications"] == 1 and body["company"] is None
        assert "user.suspended" in [e["event_type"] for e in body["recent_activity"]] and len(body["open_flags"]) == 1

    def test_a_staff_detail_shows_the_membership_and_jobs_created(self, admin_client, team, job):
        _, users = team
        body = admin_client.get(f"{ADMIN}users/{users[MemberRole.ADMIN].pk}/detail/").json()
        assert body["company"]["role"] == MemberRole.ADMIN and body["counts"]["jobs_created"] == 1

    def test_an_unknown_user_is_404(self, admin_client):
        assert admin_client.get(f"{ADMIN}users/{uuid.uuid4()}/detail/").status_code == 404

    def test_the_company_onboarding_view(self, admin_client, team, job, community):
        company, users = team
        body = admin_client.get(f"{ADMIN}companies/{company.pk}/onboarding/").json()
        assert 0 <= body["profile_completion"] <= 100 and body["members_by_role"][MemberRole.ADMIN] == 1
        assert body["jobs_by_status"]["open"] == 1 and body["communities"] == 1 and body["applications_total"] == 0
        assert len(body["staff"]) == 4 and {s["role"] for s in body["staff"]} == {"admin", "hr_manager", "recruiter", "viewer"}


class TestMonitors:
    def test_jobs_list_filters_and_detail(self, admin_client, team, job, job_factory):
        company, users = team
        job_factory(company, users[MemberRole.ADMIN], status="draft", title="Secret Draft")
        rows = admin_client.get(ADMIN + "jobs/").json()
        assert rows["count"] == 2 and {r["title"] for r in rows["results"]} == {"Backend Developer", "Secret Draft"}
        assert admin_client.get(ADMIN + "jobs/", {"status": "open"}).json()["count"] == 1
        assert admin_client.get(ADMIN + "jobs/", {"q": "backend"}).json()["count"] == 1
        assert admin_client.get(ADMIN + "jobs/", {"company": str(company.pk)}).json()["count"] == 2
        assert admin_client.get(ADMIN + "jobs/", {"created_from": str(timezone.now().date())}).json()["count"] == 2
        assert admin_client.get(ADMIN + "jobs/", {"created_to": "2020-01-01"}).json()["count"] == 0
        detail = admin_client.get(f"{ADMIN}jobs/{job.pk}/").json()
        assert detail["title"] == "Backend Developer" and detail["applications_by_status"] == {} and detail["open_flags"] == []

    @pytest.mark.parametrize("params", [{"status": "nope"}, {"created_from": "yesterday"}])
    def test_a_bad_job_filter_is_400(self, admin_client, params):
        assert admin_client.get(ADMIN + "jobs/", params).json()["code"] == "invalid_filter"

    def test_communities_list_and_detail(self, admin_client, community, team):
        post = community_posts.create(community, community.created_by, {"kind": "job", "title": "Role", "body": "Apply"})
        rows = admin_client.get(ADMIN + "communities/").json()
        assert rows["count"] == 1 and rows["results"][0]["member_count"] == 0
        assert admin_client.get(ADMIN + "communities/", {"q": "alum"}).json()["count"] == 1
        detail = admin_client.get(f"{ADMIN}communities/{community.pk}/").json()
        assert detail["posts_total"] == 1 and [p["id"] for p in detail["recent_posts"]] == [str(post.pk)] and detail["members_active"] == 0

    def test_unknown_ids_are_404(self, admin_client):
        assert admin_client.get(f"{ADMIN}jobs/{uuid.uuid4()}/").status_code == 404
        assert admin_client.get(f"{ADMIN}communities/{uuid.uuid4()}/").status_code == 404

    def test_a_platform_admin_cannot_edit_a_companys_job(self, admin_client, job):
        assert admin_client.patch(f"/api/jobs/{job.pk}/", {"title": "x"}, format="json").status_code == 403


class TestFlagsAndModeration:
    def test_an_admin_flags_something_and_it_lands_in_the_queue(self, admin_client, job):
        response = admin_client.post(ADMIN + "flags/", {"target_type": "job", "target_id": str(job.pk), "reason": "Looks fake"}, format="json")
        assert response.status_code == 201
        body = response.json()
        assert body["status"] == "open" and body["source"] == "admin" and body["target"] == {"exists": True, "label": "Backend Developer"}
        assert admin_client.get(ADMIN + "moderation/").json()["count"] == 1
        assert ActivityEvent.objects.filter(event_type="report.created").count() == 1

    def test_flagging_something_that_does_not_exist_is_404(self, admin_client):
        assert admin_client.post(ADMIN + "flags/", {"target_type": "job", "target_id": str(uuid.uuid4()), "reason": "x"}, format="json").status_code == 404
        assert admin_client.post(ADMIN + "flags/", {"target_type": "alien", "target_id": str(uuid.uuid4()), "reason": "x"}, format="json").status_code == 400

    def test_the_queue_filters_by_status_and_target(self, admin_client, flag):
        assert admin_client.get(ADMIN + "moderation/", {"status": "open"}).json()["count"] == 1
        assert admin_client.get(ADMIN + "moderation/", {"status": "actioned"}).json()["count"] == 0
        assert admin_client.get(ADMIN + "moderation/", {"target_type": "job"}).json()["count"] == 1
        assert admin_client.get(ADMIN + "moderation/", {"target_type": "nope"}).json()["code"] == "invalid_filter"

    def test_review_then_dismiss_with_a_note(self, admin_client, flag):
        assert admin_client.post(f"{ADMIN}moderation/{flag.pk}/review/").json()["status"] == "reviewing"
        assert admin_client.post(f"{ADMIN}moderation/{flag.pk}/review/").status_code == 409
        body = admin_client.post(f"{ADMIN}moderation/{flag.pk}/resolve/", {"note": "Nothing wrong"}, format="json").json()
        assert body["status"] == "dismissed" and body["action_taken"] == "none" and body["resolved_by"] == "Platform Admin"
        assert admin_client.post(f"{ADMIN}moderation/{flag.pk}/resolve/", {"note": "again"}, format="json").status_code == 409

    def test_resolving_always_needs_a_note(self, admin_client, flag):
        assert admin_client.post(f"{ADMIN}moderation/{flag.pk}/resolve/", {}, format="json").status_code == 400
        assert admin_client.post(f"{ADMIN}moderation/{flag.pk}/resolve/", {"note": "  ", "action": "act"}, format="json").status_code == 400

    def test_acting_on_a_job_flag_closes_the_job_through_the_existing_service(self, admin_client, flag, job):
        body = admin_client.post(f"{ADMIN}moderation/{flag.pk}/resolve/", {"note": "Scam", "action": "act"}, format="json").json()
        job.refresh_from_db()
        assert body["status"] == "actioned" and body["action_taken"] == "closed_job" and job.status == "closed"
        assert ActivityEvent.objects.filter(event_type="moderation.resolved").count() == 1

    def test_acting_on_a_user_flag_suspends_the_account(self, admin_client, candidate):
        flag = moderation.raise_flag(target_type="user", target_id=candidate.pk, reason="Abuse", source="admin")[0]
        admin_client.post(f"{ADMIN}moderation/{flag.pk}/resolve/", {"note": "Confirmed", "action": "act"}, format="json")
        candidate.refresh_from_db()
        assert candidate.status == UserStatus.SUSPENDED

    def test_acting_on_a_company_flag_suspends_the_company(self, admin_client, team):
        company, _ = team
        flag = moderation.raise_flag(target_type="company", target_id=company.pk, reason="Fake", source="admin")[0]
        admin_client.post(f"{ADMIN}moderation/{flag.pk}/resolve/", {"note": "Confirmed fake", "action": "act"}, format="json")
        company.refresh_from_db()
        assert company.status == CompanyStatus.SUSPENDED and company.suspension_reason == "Confirmed fake"

    def test_acting_on_a_community_flag_removes_it_and_on_a_post_archives_it(self, admin_client, community):
        post = community_posts.create(community, community.created_by, {"kind": "event", "title": "Bad", "body": "x"})
        post_flag = moderation.raise_flag(target_type="community_post", target_id=post.pk, reason="Spam", source="admin")[0]
        admin_client.post(f"{ADMIN}moderation/{post_flag.pk}/resolve/", {"note": "Spam", "action": "act"}, format="json")
        assert CommunityPost.objects.get(pk=post.pk).status == "archived"
        flag = moderation.raise_flag(target_type="community", target_id=community.pk, reason="Abuse", source="admin")[0]
        admin_client.post(f"{ADMIN}moderation/{flag.pk}/resolve/", {"note": "Confirmed", "action": "act"}, format="json")
        assert Community.objects.get(pk=community.pk).status == "removed"

    def test_a_flag_whose_target_is_gone_can_only_be_dismissed(self, admin_client, job, team):
        flag = moderation.raise_flag(target_type="job", target_id=job.pk, reason="x", source="admin")[0]
        JobPosting.objects.filter(pk=job.pk).delete()
        assert admin_client.get(ADMIN + "moderation/").json()["results"][0]["target"] == {"exists": False, "label": ""}
        assert admin_client.post(f"{ADMIN}moderation/{flag.pk}/resolve/", {"note": "gone", "action": "act"}, format="json").json()["code"] == "target_gone"
        assert admin_client.post(f"{ADMIN}moderation/{flag.pk}/resolve/", {"note": "gone"}, format="json").json()["status"] == "dismissed"

    def test_an_unknown_flag_is_404(self, admin_client):
        assert admin_client.post(f"{ADMIN}moderation/{uuid.uuid4()}/review/").status_code == 404


class TestReports:
    URL = "/api/reports/"

    def test_any_signed_in_user_can_report_and_it_lands_in_the_queue(self, auth_client, candidate, job, admin_client):
        response = auth_client(candidate).post(self.URL, {"target_type": "job", "target_id": str(job.pk), "reason": "Fake job"}, format="json")
        assert response.status_code == 201 and response.json()["created"] is True
        row = admin_client.get(ADMIN + "moderation/").json()["results"][0]
        assert row["source"] == "reported" and row["reported_by"] == "Sara Malik"

    def test_the_same_report_twice_in_24_hours_returns_the_first_flag(self, auth_client, candidate, job):
        client = auth_client(candidate)
        body = {"target_type": "job", "target_id": str(job.pk), "reason": "Fake"}
        first = client.post(self.URL, body, format="json").json()
        second = client.post(self.URL, body, format="json").json()
        assert second["id"] == first["id"] and second["created"] is False and ModerationFlag.objects.count() == 1

    def test_an_older_duplicate_starts_a_new_flag(self, auth_client, candidate, job):
        client = auth_client(candidate)
        body = {"target_type": "job", "target_id": str(job.pk), "reason": "Fake"}
        client.post(self.URL, body, format="json")
        ModerationFlag.objects.update(created_at=timezone.now() - timedelta(hours=25))
        assert client.post(self.URL, body, format="json").json()["created"] is True and ModerationFlag.objects.count() == 2

    def test_only_jobs_communities_and_posts_can_be_reported(self, auth_client, candidate, job):
        assert auth_client(candidate).post(self.URL, {"target_type": "user", "target_id": str(candidate.pk), "reason": "x"}, format="json").status_code == 400

    def test_reporting_is_throttled(self, auth_client, candidate, job, job_factory, team):
        company, users = team
        client = auth_client(candidate)
        codes = []
        for _ in range(6):
            other = job_factory(company, users[MemberRole.ADMIN], status="open")
            codes.append(client.post(self.URL, {"target_type": "job", "target_id": str(other.pk), "reason": "Fake"}, format="json").status_code)
        assert codes[:5] == [201] * 5 and codes[5] == 429

    def test_anonymous_users_cannot_use_the_signed_in_report(self, api_client, job):
        assert api_client.post(self.URL, {"target_type": "job", "target_id": str(job.pk), "reason": "x"}, format="json").status_code == 401

    def test_a_visitor_reports_a_public_job_and_gets_the_same_answer_either_way(self, api_client, job, admin_client):
        known = api_client.post("/api/public/report-job/", {"form_slug": job.form_slug, "reason": "Fake"}, format="json")
        unknown = api_client.post("/api/public/report-job/", {"form_slug": "nope", "reason": "Fake"}, format="json")
        assert known.status_code == unknown.status_code == 201 and known.json() == unknown.json()
        flags = ModerationFlag.objects.all()
        assert flags.count() == 1 and flags[0].reported_by_id is None and len(flags[0].reporter_fingerprint) == 64

    def test_a_visitor_reporting_the_same_job_twice_is_deduplicated(self, api_client, job):
        for _ in range(2):
            api_client.post("/api/public/report-job/", {"form_slug": job.form_slug, "reason": "Fake"}, format="json")
        assert ModerationFlag.objects.count() == 1

    def test_the_public_form_is_throttled(self, api_client, job):
        codes = [api_client.post("/api/public/report-job/", {"form_slug": job.form_slug, "reason": "x"}, format="json").status_code for _ in range(6)]
        assert codes[:5] == [201] * 5 and codes[5] == 429


class TestActivityLog:
    def events(self, team, candidate):
        company, users = team
        log_event("job.published", actor=users[MemberRole.ADMIN], company=company, summary="Job published")
        log_event("user.suspended", actor=None, target=candidate, summary="Account suspended")

    def test_the_log_filters_and_pages(self, admin_client, team, candidate):
        self.events(team, candidate)
        company, users = team
        assert admin_client.get(ADMIN + "activity/").json()["count"] == 2
        assert admin_client.get(ADMIN + "activity/", {"event_type": "job.published"}).json()["count"] == 1
        assert admin_client.get(ADMIN + "activity/", {"actor": str(users[MemberRole.ADMIN].pk)}).json()["count"] == 1
        assert admin_client.get(ADMIN + "activity/", {"company": str(company.pk)}).json()["count"] == 1
        assert admin_client.get(ADMIN + "activity/", {"from": str(timezone.now().date())}).json()["count"] == 2
        assert admin_client.get(ADMIN + "activity/", {"to": "2020-01-01"}).json()["count"] == 0
        assert admin_client.get(ADMIN + "activity/", {"from": "nonsense"}).json()["code"] == "invalid_filter"

    def test_the_list_hides_metadata_and_the_detail_shows_it(self, admin_client, team, candidate):
        log_event("job.published", actor=None, summary="Job published", metadata={"job_id": "abc"})
        row = admin_client.get(ADMIN + "activity/").json()["results"][0]
        assert "metadata" not in row
        detail = admin_client.get(f"{ADMIN}activity/{row['id']}/").json()
        assert detail["metadata"] == {"job_id": "abc"}
        assert admin_client.get(f"{ADMIN}activity/999999/").status_code == 404

    def test_the_log_cannot_be_edited_or_deleted_through_the_api(self, admin_client, team, candidate):
        self.events(team, candidate)
        row_id = admin_client.get(ADMIN + "activity/").json()["results"][0]["id"]
        for method in ("patch", "put", "delete"):
            assert getattr(admin_client, method)(f"{ADMIN}activity/{row_id}/", {}, format="json").status_code == 405

    def test_the_export_is_safe_csv_and_honours_the_filters(self, admin_client, team, candidate):
        log_event("job.published", actor=None, summary="=cmd()|calc", metadata={})
        self.events(team, candidate)
        response = admin_client.get(ADMIN + "activity/export/")
        text = response.content.decode("utf-8")
        assert response["Content-Type"].startswith("text/csv") and "attachment" in response["Content-Disposition"]
        assert text.startswith("﻿") and "'=cmd()|calc" in text and len(text.strip().splitlines()) == 4
        filtered = admin_client.get(ADMIN + "activity/export/", {"event_type": "user.suspended"}).content.decode("utf-8")
        assert len(filtered.strip().splitlines()) == 2

    def test_an_entry_can_be_flagged_and_one_without_a_target_cannot(self, admin_client, candidate):
        log_event("user.suspended", actor=None, target=candidate, summary="Account suspended")
        log_event("job.published", actor=None, summary="No target")
        rows = admin_client.get(ADMIN + "activity/").json()["results"]
        no_target = next(r for r in rows if r["summary"] == "No target")
        with_target = next(r for r in rows if r["target_id"])
        assert admin_client.post(f"{ADMIN}activity/{no_target['id']}/flag/", {"reason": "x"}, format="json").json()["code"] == "no_target"
        response = admin_client.post(f"{ADMIN}activity/{with_target['id']}/flag/", {"reason": "Check this"}, format="json")
        assert response.status_code == 201 and response.json()["target_type"] == "user"


class TestHealthAndAlerts:
    def test_health_reports_every_block_and_still_answers_200(self, admin_client):
        body = admin_client.get(ADMIN + "health/").json()
        assert body["database"]["ok"] is True and body["storage"]["ok"] is True
        assert set(body) == {"database", "storage", "broker", "worker", "email", "ai_last_hour", "resources", "alerts", "backup", "checked_at"}
        assert body["ai_last_hour"]["failure_rate"] == 0.0 and body["backup"]["warning"]
        assert set(body["resources"]) == {"cpu_percent", "memory_percent", "disk_percent"}

    def test_the_ai_failure_rate_uses_the_last_hour(self, admin_client):
        for status in ("ok", "failed", "failed", "ok"):
            AIRequestLog.objects.create(feature="cv_extract", provider="fake", status=status)
        body = admin_client.get(ADMIN + "health/").json()["ai_last_hour"]
        assert body["calls"] == 4 and body["failures"] == 2 and body["failure_rate"] == 0.5 and body["last_successful_at"]

    def test_the_backup_warning_clears_with_a_recent_success(self, admin_client):
        BackupRecord.objects.create(started_at=timezone.now() - timedelta(minutes=10), finished_at=timezone.now(), status="success", size_bytes=1024)
        body = admin_client.get(ADMIN + "health/").json()["backup"]
        assert body["warning"] == "" and body["size_bytes"] == 1024

    def test_an_old_backup_still_warns(self, admin_client):
        BackupRecord.objects.create(started_at=timezone.now() - timedelta(days=2), finished_at=timezone.now() - timedelta(hours=30), status="success")
        assert admin_client.get(ADMIN + "health/").json()["backup"]["warning"]

    def test_the_record_backup_command_writes_a_row(self, admin_client):
        out = io.StringIO()
        call_command("record_backup", "--status", "success", "--size-bytes", "2048", "--location", "s3://backups/x", stdout=out)
        record = BackupRecord.objects.get()
        assert record.status == "success" and record.size_bytes == 2048 and "Recorded backup" in out.getvalue()
        assert admin_client.get(ADMIN + "health/").json()["backup"]["warning"] == ""

    def test_alerts_are_listed_and_acknowledged(self, admin_client):
        alert = SystemAlert.objects.create(kind="worker_down", severity="critical", message="No worker heartbeat")
        assert admin_client.get(ADMIN + "alerts/", {"active": "true"}).json()["count"] == 1
        body = admin_client.post(f"{ADMIN}alerts/{alert.pk}/acknowledge/").json()
        assert body["acknowledged_at"] and admin_client.post(f"{ADMIN}alerts/{uuid.uuid4()}/acknowledge/").status_code == 404
        assert admin_client.get(ADMIN + "alerts/", {"active": "false"}).json()["count"] == 0


class TestAISettings:
    def test_reading_and_changing_the_settings_is_audited(self, admin_client, platform_admin):
        assert admin_client.get(ADMIN + "ai-settings/").json()["screening_min_score"] == 60
        response = admin_client.put(ADMIN + "ai-settings/", {"screening_min_score": 70, "screening_questions": 7}, format="json")
        assert response.status_code == 200 and response.json()["screening_min_score"] == 70
        event = ActivityEvent.objects.get(event_type="ai.settings_changed")
        assert event.actor == platform_admin and event.metadata["changed"]["screening_min_score"] == {"from": 60, "to": 70}
        assert get_config().screening_min_score == 70  # the cache was cleared

    @pytest.mark.parametrize("body", [{"chat_model": "made-up-model"}, {"screening_min_score": 120}, {"temperature_questions": 5}, {"screening_questions": 1}, {"timeout_seconds": 1}])
    def test_invalid_settings_are_400_and_change_nothing(self, admin_client, body):
        assert admin_client.put(ADMIN + "ai-settings/", body, format="json").status_code == 400
        assert not AISettings.objects.exclude(screening_min_score=60).exists()

    def test_api_keys_are_never_part_of_the_surface(self, admin_client):
        text = admin_client.get(ADMIN + "ai-settings/").content.decode().lower()
        assert "key" not in text and "secret" not in text


class TestPrompts:
    def active(self, key="cv_extract"):
        return PromptTemplate.objects.get(key=key, is_active=True)

    def test_keys_are_listed_with_their_active_version(self, admin_client):
        rows = admin_client.get(ADMIN + "prompts/").json()
        assert {r["key"] for r in rows} >= {"cv_extract", "cv_explain", "evaluation_report"}
        assert all(r["active_version"] == 1 and r["versions"] == 1 for r in rows)

    def test_versions_of_one_prompt_and_an_unknown_key(self, admin_client):
        rows = admin_client.get(ADMIN + "prompts/cv_extract/").json()
        assert len(rows) == 1 and rows[0]["is_active"] is True and rows[0]["system_text"]
        assert admin_client.get(ADMIN + "prompts/nope/").status_code == 404

    def test_a_new_version_becomes_active_and_keeps_the_old_one(self, admin_client, platform_admin):
        current = self.active()
        body = {"system_text": current.system_text + "\nBe brief.", "user_text": current.user_text, "output_schema": current.output_schema}
        response = admin_client.post(ADMIN + "prompts/cv_extract/", body, format="json")
        assert response.status_code == 201 and response.json()["version"] == 2 and response.json()["is_active"] is True
        assert PromptTemplate.objects.filter(key="cv_extract").count() == 2 and PromptTemplate.objects.get(key="cv_extract", version=1).is_active is False
        assert ActivityEvent.objects.filter(event_type="ai.settings_changed").exists()

    def test_a_version_that_drops_a_placeholder_is_refused(self, admin_client):
        current = self.active()
        response = admin_client.post(ADMIN + "prompts/cv_extract/", {"system_text": current.system_text, "user_text": "no placeholder here", "output_schema": current.output_schema}, format="json")
        assert response.status_code == 400 and "cv_text" in str(response.json())
        assert PromptTemplate.objects.filter(key="cv_extract").count() == 1

    @pytest.mark.parametrize("schema", [{}, {"type": "not-a-type"}, "text"])
    def test_an_invalid_schema_is_refused(self, admin_client, schema):
        current = self.active()
        response = admin_client.post(ADMIN + "prompts/cv_extract/", {"system_text": current.system_text, "user_text": current.user_text, "output_schema": schema}, format="json")
        assert response.status_code == 400

    def test_rollback_reactivates_an_earlier_version(self, admin_client):
        current = self.active()
        admin_client.post(ADMIN + "prompts/cv_extract/", {"system_text": current.system_text + " x", "user_text": current.user_text, "output_schema": current.output_schema}, format="json")
        response = admin_client.post(ADMIN + "prompts/cv_extract/rollback/", {"version": 1}, format="json")
        assert response.status_code == 200 and response.json()["version"] == 1 and response.json()["is_active"] is True
        assert PromptTemplate.objects.filter(key="cv_extract").count() == 2 and self.active().version == 1
        assert admin_client.post(ADMIN + "prompts/cv_extract/rollback/", {"version": 1}, format="json").json()["code"] == "already_active"
        assert admin_client.post(ADMIN + "prompts/cv_extract/rollback/", {"version": 99}, format="json").status_code == 404

    def test_the_live_prompt_follows_the_active_version(self, admin_client):
        from apps.Module5_Foundation.ai.prompts import active_template

        current = self.active()
        admin_client.post(ADMIN + "prompts/cv_extract/", {"system_text": "Brand new text {cv_text}", "user_text": current.user_text, "output_schema": current.output_schema}, format="json")
        assert active_template("cv_extract").version == 2


class TestAIUsage:
    def test_rows_per_feature_per_day_and_an_empty_report(self, admin_client):
        assert admin_client.get(ADMIN + "ai-usage/").json() == []
        for feature, status, latency in (("cv_extract", "ok", 100), ("cv_extract", "failed", 300), ("answer_eval", "ok", 50)):
            AIRequestLog.objects.create(feature=feature, provider="fake", status=status, latency_ms=latency, prompt_tokens=10, completion_tokens=2)
        rows = admin_client.get(ADMIN + "ai-usage/").json()
        assert len(rows) == 2
        extract = next(r for r in rows if r["feature"] == "cv_extract")
        assert extract["calls"] == 2 and extract["failures"] == 1 and extract["average_latency_ms"] == 200 and extract["prompt_tokens"] == 20
        assert admin_client.get(ADMIN + "ai-usage/", {"feature": "answer_eval"}).json()[0]["calls"] == 1
        assert admin_client.get(ADMIN + "ai-usage/", {"to": "2020-01-01"}).json() == []
        assert admin_client.get(ADMIN + "ai-usage/", {"from": "nope"}).json()["code"] == "invalid_filter"


class TestPhase1Rules:
    def test_an_admin_cannot_suspend_themselves_or_another_platform_admin(self, admin_client, platform_admin, user_factory):
        other = user_factory(role=UserRole.PLATFORM_ADMIN)
        assert admin_client.post(f"/api/platform-admin/users/{platform_admin.pk}/suspend/").json()["code"] == "cannot_suspend_self"
        assert admin_client.post(f"/api/platform-admin/users/{other.pk}/suspend/").json()["code"] == "cannot_suspend_admin"


@pytest.mark.django_db(transaction=True)
def test_two_admins_resolving_one_flag_act_once(job, platform_admin, user_factory, auth_client):
    flag = moderation.raise_flag(target_type="job", target_id=job.pk, reason="x", source="admin")[0]
    second = user_factory(role=UserRole.PLATFORM_ADMIN)
    barrier, codes = threading.Barrier(2), []

    def resolve(user):
        try:
            barrier.wait(timeout=10)
            codes.append(auth_client(user).post(f"{ADMIN}moderation/{flag.pk}/resolve/", {"note": "Scam", "action": "act"}, format="json").status_code)
        finally:
            connection.close()

    threads = [threading.Thread(target=resolve, args=(u,)) for u in (platform_admin, second)]
    [t.start() for t in threads]
    [t.join(timeout=30) for t in threads]
    assert sorted(codes) == [200, 409], codes
    assert ActivityEvent.objects.filter(event_type="moderation.resolved").count() == 1
    assert ModerationFlag.objects.get(pk=flag.pk).status == "actioned"

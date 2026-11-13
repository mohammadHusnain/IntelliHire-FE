"""The 48-hour interview reminder (FR-62) and the wording rules of the emails a candidate gets (FR-63)."""
import threading
from datetime import timedelta

import pytest
from django.db import connection
from django.utils import timezone

from apps.common.choices import CompanyStatus, MemberRole
from apps.Module5_Foundation.models import ActivityEvent, Notification, NotificationPreference, OutboundEmail
from apps.Module7_Interviews.models import InterviewSession
from apps.Module7_Interviews.services import links

from .. import tasks
from ..services import reminders

pytestmark = pytest.mark.django_db


def soon(hours=30):
    return timezone.now() + timedelta(hours=hours)


class TestReminders:
    def test_an_unstarted_interview_expiring_within_48_hours_gets_one_reminder_with_a_new_link(self, session_factory, application, api_client):
        session = session_factory(application, status="invited", expires_at=soon(30))
        old = session.raw_token
        assert reminders.send_due() == 1
        email = OutboundEmail.objects.get(kind="interview_reminder")
        new = email.body_text.split("/interview/")[1].split()[0]
        assert email.to_email == application.email and email.sensitive and "replaces" in email.body_text and "Please start before" in email.body_text
        session.refresh_from_db()
        assert session.reminder_sent_at and session.token_hash == links.hash_token(new)
        assert api_client.get(f"/api/public/interviews/{old}/").status_code == 404 and api_client.get(f"/api/public/interviews/{new}/").status_code == 200
        assert ActivityEvent.objects.filter(event_type="interview.reminded").count() == 1

    def test_it_is_sent_once_however_often_the_sweep_runs(self, session_factory, application):
        session_factory(application, status="invited", expires_at=soon(10))
        assert [reminders.send_due() for _ in range(3)] == [1, 0, 0]
        assert OutboundEmail.objects.filter(kind="interview_reminder").count() == 1

    @pytest.mark.parametrize(
        "fields",
        [
            {"expires_at": soon(72)},  # not close enough yet
            {"expires_at": timezone.now() - timedelta(hours=1)},  # already expired
            {"status": "in_progress"}, {"status": "interrupted"}, {"status": "completed"}, {"status": "cancelled"},
            {"started_at": timezone.now() - timedelta(hours=1)},
            {"reminder_sent_at": timezone.now()},
        ],
    )  # fmt: skip
    def test_it_skips_anything_that_does_not_need_one(self, session_factory, application, fields):
        session_factory(application, **{"status": "invited", "expires_at": soon(10), **fields})
        assert reminders.send_due() == 0 and not OutboundEmail.objects.filter(kind="interview_reminder").exists()

    def test_a_suspended_company_gets_no_reminder(self, session_factory, application):
        session_factory(application, status="invited", expires_at=soon(10))
        company = application.job.company
        company.status, company.suspension_reason = CompanyStatus.SUSPENDED, "Policy violation under review."
        company.save()
        assert reminders.send_due() == 0

    def test_a_candidate_with_an_account_is_notified_without_the_link(self, session_factory, application, user_factory):
        candidate = user_factory()
        session = session_factory(application, status="invited", expires_at=soon(10), candidate_user=candidate)
        reminders.send_due()
        notification = Notification.objects.get(user=candidate, kind="interview_reminder")
        assert session.raw_token not in notification.body and "interview/" not in notification.body + notification.link

    def test_a_candidate_can_opt_out_of_in_app_reminders_but_still_receives_the_transactional_email(self, session_factory, application, user_factory):
        candidate = user_factory()
        NotificationPreference.objects.create(user=candidate, in_app_reminders=False)
        session_factory(application, status="invited", expires_at=soon(10), candidate_user=candidate)
        assert reminders.send_due() == 1
        assert not Notification.objects.filter(user=candidate, kind="interview_reminder").exists()
        assert OutboundEmail.objects.filter(kind="interview_reminder").exists()

    def test_technical_interviews_are_reminded_too(self, session_factory, application):
        session_factory(application, kind="technical", status="invited", expires_at=soon(10))
        assert reminders.send_due() == 1 and "technical interview" in OutboundEmail.objects.get(kind="interview_reminder").subject

    def test_the_scheduled_task_runs_it_and_is_registered(self, session_factory, application, settings):
        session_factory(application, status="invited", expires_at=soon(10))
        assert tasks.sweep() == 1
        assert settings.CELERY_BEAT_SCHEDULE["tracking-sweep"] == {"task": "tracking.sweep", "schedule": 900.0}


@pytest.mark.django_db(transaction=True)
def test_two_sweeps_at_once_send_one_email(session_factory, application, ensure_bank):
    session_factory(application, status="invited", expires_at=soon(10))
    barrier, counts = threading.Barrier(2), []

    def sweep():
        try:
            barrier.wait(timeout=10)
            counts.append(reminders.send_due())
        finally:
            connection.close()

    threads = [threading.Thread(target=sweep) for _ in range(2)]
    [t.start() for t in threads]
    [t.join(timeout=30) for t in threads]
    assert sum(counts) == 1 and OutboundEmail.objects.filter(kind="interview_reminder").count() == 1
    assert InterviewSession.objects.get().reminder_sent_at


class TestDecisionEmailWording:
    """FR-63: plain decision wording, no scores, respectful rejections, nothing from the HR side."""

    def decide(self, clients, application, decision, django_capture_on_commit_callbacks, note=""):
        with django_capture_on_commit_callbacks(execute=True):
            clients[MemberRole.ADMIN].post(f"/api/applications/{application.pk}/decision/", {"decision": decision, "note": note}, format="json")
        return OutboundEmail.objects.get(kind="application_decision")

    @pytest.mark.parametrize("decision", ["selected", "rejected", "on_hold"])
    def test_every_decision_email_is_plain_and_free_of_internal_detail(self, clients, application, decision, django_capture_on_commit_callbacks):
        email = self.decide(clients, application, decision, django_capture_on_commit_callbacks, note="INTERNAL score 12 weak")
        text = email.subject + email.body_text
        assert application.job.title in text and application.job.company.name in text and application.reference in text
        for forbidden in ("INTERNAL", "score", "%", "AI", "ranking", "rejected", "reject"):
            assert forbidden not in text, forbidden
        assert "recruiting team" in email.body_text

    def test_a_rejection_is_respectful(self, clients, application, django_capture_on_commit_callbacks):
        body = self.decide(clients, application, "rejected", django_capture_on_commit_callbacks).body_text
        assert "Thank you" in body and "careful consideration" in body and "wish you every success" in body

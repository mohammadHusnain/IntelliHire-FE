from datetime import timedelta

import pytest
from django.core import mail
from django.core.cache import cache
from django.core.management import call_command
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.Module5_Foundation import alerts, tasks
from apps.Module5_Foundation.models import AIRequestLog, AlertKind, OutboundEmail, SystemAlert

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _emails_go_out_at_once(monkeypatch):
    """Alert emails are queued for after commit; run that step immediately so the tests can read the outbox."""
    monkeypatch.setattr(transaction, "on_commit", lambda func, *args, **kwargs: func())


def ai_calls(ok, failed, minutes_ago=1):
    when = timezone.now() - timedelta(minutes=minutes_ago)
    rows = [AIRequestLog(feature="f", provider="fake", status="ok", created_at=when) for _ in range(ok)]
    rows += [AIRequestLog(feature="f", provider="fake", status="failed", created_at=when) for _ in range(failed)]
    AIRequestLog.objects.bulk_create(rows)


def active(kind):
    return SystemAlert.objects.filter(kind=kind, is_active=True).first()


class TestAiFailureRate:
    def test_a_high_failure_rate_raises_one_critical_alert_and_emails_admins(self, platform_admin):
        ai_calls(ok=8, failed=4)
        alerts.check_alerts()
        alert = active(AlertKind.AI_FAILURE_RATE)
        assert alert.severity == "critical" and "4 of 12" in alert.message
        assert [m.to for m in mail.outbox] == [[platform_admin.email]]

    def test_running_again_neither_duplicates_the_alert_nor_the_email(self, platform_admin):
        ai_calls(ok=8, failed=4)
        alerts.check_alerts()
        alerts.check_alerts()
        assert SystemAlert.objects.count() == 1 and len(mail.outbox) == 1

    def test_the_message_is_refreshed_while_active(self, platform_admin):
        ai_calls(ok=8, failed=4)
        alerts.check_alerts()
        ai_calls(ok=0, failed=4)
        alerts.check_alerts()
        assert "8 of 16" in active(AlertKind.AI_FAILURE_RATE).message and len(mail.outbox) == 1

    def test_it_resolves_when_the_rate_recovers(self, platform_admin):
        ai_calls(ok=8, failed=4)
        alerts.check_alerts()
        ai_calls(ok=40, failed=0)
        alerts.check_alerts()
        alert = SystemAlert.objects.get()
        assert alert.is_active is False and alert.resolved_at

    def test_a_new_incident_after_a_resolved_one_alerts_again(self, platform_admin):
        ai_calls(ok=8, failed=4)
        alerts.check_alerts()
        AIRequestLog.objects.all().delete()
        alerts.check_alerts()
        ai_calls(ok=8, failed=4)
        alerts.check_alerts()
        assert SystemAlert.objects.count() == 2 and len(mail.outbox) == 2

    def test_too_few_calls_never_alert(self):
        ai_calls(ok=0, failed=9)
        alerts.check_alerts()
        assert SystemAlert.objects.count() == 0

    def test_exactly_twenty_percent_is_not_enough(self):
        ai_calls(ok=8, failed=2)
        alerts.check_alerts()
        assert SystemAlert.objects.count() == 0

    def test_old_calls_are_outside_the_window(self):
        ai_calls(ok=0, failed=20, minutes_ago=30)
        alerts.check_alerts()
        assert SystemAlert.objects.count() == 0

    def test_content_policy_blocks_are_not_outages(self):
        AIRequestLog.objects.bulk_create([AIRequestLog(feature="f", provider="fake", status="policy_blocked") for _ in range(15)])
        alerts.check_alerts()
        assert SystemAlert.objects.count() == 0

    def test_no_platform_admin_is_logged_not_crashed(self, caplog):
        ai_calls(ok=8, failed=4)
        alerts.check_alerts()
        assert active(AlertKind.AI_FAILURE_RATE) and "no active platform admin" in caplog.text and mail.outbox == []


class TestEmailBacklog:
    def overdue(self, count, minutes=31):
        OutboundEmail.objects.bulk_create(
            [OutboundEmail(to_email=f"u{i}@example.com", subject="S", next_attempt_at=timezone.now() - timedelta(minutes=minutes)) for i in range(count)]
        )

    def test_overdue_emails_raise_a_warning_without_emailing(self, platform_admin):
        self.overdue(3)
        alerts.check_alerts()
        alert = active(AlertKind.EMAIL_QUEUE_BACKLOG)
        assert alert.severity == "warning" and "3 email" in alert.message and mail.outbox == []

    def test_a_big_backlog_is_critical_and_escalation_emails_once(self, platform_admin):
        self.overdue(3)
        alerts.check_alerts()
        self.overdue(20)
        alerts.check_alerts()
        alerts.check_alerts()
        assert active(AlertKind.EMAIL_QUEUE_BACKLOG).severity == "critical" and len(mail.outbox) == 1

    def test_emails_waiting_for_a_future_retry_are_not_overdue(self):
        OutboundEmail.objects.create(to_email="a@example.com", subject="S", next_attempt_at=timezone.now() + timedelta(hours=2))
        alerts.check_alerts()
        assert SystemAlert.objects.count() == 0

    def test_it_resolves_once_the_queue_drains(self):
        self.overdue(2)
        alerts.check_alerts()
        OutboundEmail.objects.update(status="sent")
        alerts.check_alerts()
        assert SystemAlert.objects.get().is_active is False


class TestWorkerHeartbeat:
    @pytest.fixture(autouse=True)
    def _real_worker_mode(self, settings):
        settings.CELERY_TASK_ALWAYS_EAGER = False

    def test_eager_mode_has_no_worker_to_watch(self, settings):
        settings.CELERY_TASK_ALWAYS_EAGER = True
        alerts.check_alerts(evaluate_worker=True)
        assert SystemAlert.objects.count() == 0

    def test_a_missing_heartbeat_gets_a_grace_period_after_a_deploy(self, platform_admin):
        alerts.check_alerts(evaluate_worker=True)
        assert SystemAlert.objects.count() == 0 and cache.get(alerts.HEARTBEAT_MISSING_KEY)

    def test_a_missing_heartbeat_alerts_after_the_grace_period(self, platform_admin):
        cache.set(alerts.HEARTBEAT_MISSING_KEY, (timezone.now() - timedelta(minutes=6)).timestamp())
        alerts.check_alerts(evaluate_worker=True)
        assert active(AlertKind.WORKER_DOWN).severity == "critical"
        # With no worker (and no broker in tests) the email waits in the outbox instead of being sent inline.
        assert OutboundEmail.objects.get(kind="system_alert").to_email == platform_admin.email

    def test_a_stale_heartbeat_alerts_straight_away(self, platform_admin):
        cache.set(alerts.HEARTBEAT_KEY, (timezone.now() - timedelta(minutes=4)).timestamp())
        alerts.check_alerts(evaluate_worker=True)
        assert active(AlertKind.WORKER_DOWN)

    def test_a_fresh_heartbeat_resolves_it(self, platform_admin):
        cache.set(alerts.HEARTBEAT_MISSING_KEY, (timezone.now() - timedelta(minutes=6)).timestamp())
        alerts.check_alerts(evaluate_worker=True)
        tasks.worker_heartbeat()
        alerts.check_alerts(evaluate_worker=True)
        assert SystemAlert.objects.get().is_active is False and cache.get(alerts.HEARTBEAT_MISSING_KEY) is None

    def test_the_worker_cannot_raise_its_own_death_but_does_resolve_the_alert(self, platform_admin):
        alerts.check_alerts(evaluate_worker=False)  # no heartbeat, worker-side run: nothing happens
        assert SystemAlert.objects.count() == 0
        cache.set(alerts.HEARTBEAT_KEY, (timezone.now() - timedelta(minutes=4)).timestamp())
        alerts.check_alerts(evaluate_worker=True)
        tasks.worker_heartbeat()
        tasks.check_alerts()
        assert SystemAlert.objects.get().is_active is False


class TestOther:
    def test_only_one_active_alert_per_kind_is_allowed(self):
        SystemAlert.objects.create(kind="ai_failure_rate", severity="warning", message="a")
        with pytest.raises(IntegrityError), transaction.atomic():
            SystemAlert.objects.create(kind="ai_failure_rate", severity="warning", message="b")
        SystemAlert.objects.create(kind="email_queue_backlog", severity="warning", message="c")

    def test_a_resolved_alert_does_not_block_a_new_one(self):
        SystemAlert.objects.create(kind="ai_failure_rate", severity="warning", message="a", is_active=False)
        SystemAlert.objects.create(kind="ai_failure_rate", severity="warning", message="b")

    def test_the_management_command_checks_the_worker_too(self, settings, platform_admin):
        settings.CELERY_TASK_ALWAYS_EAGER = False
        cache.set(alerts.HEARTBEAT_KEY, (timezone.now() - timedelta(minutes=10)).timestamp())
        call_command("check_alerts")
        assert active(AlertKind.WORKER_DOWN)

    def test_the_scheduled_task_runs_without_a_worker_check(self, settings):
        settings.CELERY_TASK_ALWAYS_EAGER = False
        tasks.check_alerts()
        assert SystemAlert.objects.count() == 0

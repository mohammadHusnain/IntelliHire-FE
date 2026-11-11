import smtplib
from datetime import timedelta
from unittest import mock

import pytest
from django.core import mail
from django.db import connection, transaction
from django.utils import timezone

from apps.Module5_Foundation import outbox, tasks
from apps.Module5_Foundation.locks import single_run
from apps.Module5_Foundation.models import OutboundEmail

pytestmark = pytest.mark.django_db
SEND = "apps.Module5_Foundation.outbox.EmailMultiAlternatives.send"


def queue(**kw):
    fields = {"to_email": "a@example.com", "subject": "S", "body_text": "B", "kind": "general"}
    fields.update(kw)
    return OutboundEmail.objects.create(**fields)


class TestQueueing:
    def test_one_row_per_distinct_valid_recipient(self, django_capture_on_commit_callbacks):
        with django_capture_on_commit_callbacks(execute=True):
            rows = outbox.send_email(to=["a@example.com", "A@example.com", "b@example.com", "not-an-email", ""], subject="S", body="B")
        assert [r.to_email for r in rows] == ["a@example.com", "b@example.com"]
        assert sorted(m.to[0] for m in mail.outbox) == ["a@example.com", "b@example.com"]

    def test_no_valid_recipient_means_no_row_and_no_error(self):
        assert outbox.send_email(to=["nope", None], subject="S", body="B") == []
        assert outbox.send_email(to=[], subject="S", body="B") == []
        assert OutboundEmail.objects.count() == 0

    def test_the_row_exists_inside_the_transaction_but_nothing_is_sent_before_commit(self, django_capture_on_commit_callbacks):
        with django_capture_on_commit_callbacks(execute=False) as callbacks:
            outbox.send_email(to="a@example.com", subject="S", body="B")
            assert OutboundEmail.objects.filter(status="queued").count() == 1 and mail.outbox == []
        assert len(callbacks) == 1

    def test_a_rollback_leaves_no_row_and_sends_nothing(self, django_capture_on_commit_callbacks):
        with django_capture_on_commit_callbacks(execute=True):
            with pytest.raises(RuntimeError):
                with transaction.atomic():
                    outbox.send_email(to="a@example.com", subject="S", body="B")
                    raise RuntimeError
        assert OutboundEmail.objects.count() == 0 and mail.outbox == []

    def test_header_injection_in_the_subject_is_neutralised_and_long_text_is_cut(self, settings):
        settings.EMAIL_MAX_BODY_CHARS = 100
        (row,) = outbox.send_email(to="a@example.com", subject="Hi\r\nBcc: evil@example.com " + "x" * 300, body="b" * 500, html_body="h" * 500)
        assert "\n" not in row.subject and "\r" not in row.subject and len(row.subject) <= 200
        assert len(row.body_text) == 100 and len(row.body_html) == 100

    def test_kind_sensitivity_and_related_object_are_stored(self, company_factory):
        company = company_factory()
        (row,) = outbox.send_email(to="a@example.com", subject="S", body="B", kind="staff_invitation", sensitive=True, related=company)
        assert (row.kind, row.sensitive, row.related_type, row.related_id) == ("staff_invitation", True, "company", company.pk)


class TestDelivery:
    def test_success(self):
        row = queue()
        assert outbox.deliver(row.pk) == "sent"
        row.refresh_from_db()
        assert row.status == "sent" and row.sent_at and row.attempts == 1 and row.last_error == ""
        assert len(mail.outbox) == 1 and mail.outbox[0].subject == "S" and mail.outbox[0].body == "B"

    def test_html_alternative(self):
        row = queue(body_html="<b>x</b>")
        outbox.deliver(row.pk)
        assert mail.outbox[0].alternatives == [("<b>x</b>", "text/html")]

    def test_a_sensitive_body_is_wiped_once_sent(self):
        row = queue(sensitive=True, body_text="https://app/verify?token=SECRET", body_html="<a>SECRET</a>")
        outbox.deliver(row.pk)
        row.refresh_from_db()
        assert row.body_text == "" and row.body_html == "" and row.body_purged is True
        assert "SECRET" in mail.outbox[0].body  # it was sent, then forgotten

    def test_a_normal_body_is_kept(self):
        row = queue(body_text="Hello")
        outbox.deliver(row.pk)
        row.refresh_from_db()
        assert row.body_text == "Hello" and row.body_purged is False

    def test_two_deliveries_of_one_email_send_once(self):
        row = queue()
        assert outbox.deliver(row.pk) == "sent"
        assert outbox.deliver(row.pk) == "skipped"
        assert len(mail.outbox) == 1

    def test_an_email_another_worker_is_sending_is_skipped(self):
        row = queue(status="sending", claimed_at=timezone.now())
        assert outbox.deliver(row.pk) == "skipped" and mail.outbox == []

    def test_a_missing_row_is_skipped(self):
        import uuid

        assert outbox.deliver(uuid.uuid4()) == "skipped"


class TestFailures:
    def test_a_temporary_failure_is_retried_with_growing_delays(self, settings):
        row = queue()
        delays = []
        with mock.patch(SEND, side_effect=smtplib.SMTPServerDisconnected("gone")):
            for _ in range(4):
                before = timezone.now()
                assert outbox.deliver(row.pk) == "retry"
                row.refresh_from_db()
                delays.append(round((row.next_attempt_at - before).total_seconds() / 60))
                assert row.status == "queued"
                OutboundEmail.objects.filter(pk=row.pk).update(next_attempt_at=timezone.now())
        assert delays == [1, 5, 15, 60] and row.attempts == 4

    def test_after_the_last_attempt_it_is_failed_for_good(self, settings):
        settings.EMAIL_OUTBOX_MAX_ATTEMPTS = 2
        row = queue()
        with mock.patch(SEND, side_effect=OSError("down")):
            assert outbox.deliver(row.pk) == "retry"
            OutboundEmail.objects.filter(pk=row.pk).update(next_attempt_at=timezone.now())
            assert outbox.deliver(row.pk) == "failed"
        row.refresh_from_db()
        assert row.status == "failed" and row.attempts == 2

    @pytest.mark.parametrize(
        "error",
        [smtplib.SMTPRecipientsRefused({"a@example.com": (550, b"no")}), smtplib.SMTPResponseException(550, b"mailbox unavailable"), ValueError("bad header")],
    )
    def test_permanent_errors_are_not_retried(self, error):
        row = queue()
        with mock.patch(SEND, side_effect=error):
            assert outbox.deliver(row.pk) == "failed"
        row.refresh_from_db()
        assert row.status == "failed" and row.attempts == 1

    def test_a_4xx_response_is_temporary(self):
        row = queue()
        with mock.patch(SEND, side_effect=smtplib.SMTPResponseException(451, b"try later")):
            assert outbox.deliver(row.pk) == "retry"
        row.refresh_from_db()
        assert row.last_error == "SMTPResponseException 451"

    def test_the_stored_error_and_the_log_never_contain_the_address(self, caplog):
        row = queue(to_email="secret@example.com")
        with mock.patch(SEND, side_effect=smtplib.SMTPRecipientsRefused({"secret@example.com": (550, b"secret@example.com")})):
            outbox.deliver(row.pk)
        row.refresh_from_db()
        assert "secret@example.com" not in row.last_error and "secret@example.com" not in caplog.text

    def test_a_failed_sensitive_email_is_wiped_too(self):
        row = queue(sensitive=True, body_text="link?token=SECRET")
        with mock.patch(SEND, side_effect=smtplib.SMTPResponseException(550, b"no")):
            outbox.deliver(row.pk)
        row.refresh_from_db()
        assert row.status == "failed" and row.body_text == "" and row.body_purged

    def test_a_retrying_sensitive_email_keeps_its_body_until_it_gives_up(self):
        row = queue(sensitive=True, body_text="link?token=SECRET")
        with mock.patch(SEND, side_effect=OSError("down")):
            outbox.deliver(row.pk)
        row.refresh_from_db()
        assert row.status == "queued" and row.body_text == "link?token=SECRET"


class TestBrokerAndSweep:
    def test_a_dead_broker_never_fails_the_request_and_the_sweep_sends_the_email_later(self, django_capture_on_commit_callbacks, caplog):
        with mock.patch.object(tasks.send_email_task, "delay", side_effect=ConnectionError("redis down")):
            with django_capture_on_commit_callbacks(execute=True):
                outbox.send_email(to="a@example.com", subject="S", body="B")
        assert mail.outbox == [] and OutboundEmail.objects.get().status == "queued"
        assert "Could not queue an email task" in caplog.text
        assert outbox.sweep() == (0, 1)
        assert len(mail.outbox) == 1

    def test_sweep_frees_emails_stuck_mid_send_but_not_fresh_ones(self):
        stale = queue(status="sending", claimed_at=timezone.now() - timedelta(minutes=16), to_email="stale@example.com")
        fresh = queue(status="sending", claimed_at=timezone.now() - timedelta(minutes=2), to_email="fresh@example.com")
        reset, queued = outbox.sweep()
        assert (reset, queued) == (1, 1)
        stale.refresh_from_db(), fresh.refresh_from_db()
        assert stale.status == "sent" and fresh.status == "sending"
        assert [m.to[0] for m in mail.outbox] == ["stale@example.com"]

    def test_sweep_leaves_retries_that_are_not_due_yet(self):
        later = queue(next_attempt_at=timezone.now() + timedelta(minutes=30))
        assert outbox.sweep() == (0, 0)
        later.refresh_from_db()
        assert later.status == "queued" and mail.outbox == []

    def test_sweep_does_at_most_200_per_run(self, settings):
        OutboundEmail.objects.bulk_create([OutboundEmail(to_email=f"u{i}@example.com", subject="S") for i in range(205)])
        with mock.patch.object(tasks.send_email_task, "delay") as delay:
            assert outbox.sweep() == (0, 200)
        assert delay.call_count == 200

    def test_a_redelivered_task_after_the_sweep_does_not_double_send(self):
        row = queue()
        outbox.sweep()
        tasks.send_email_task(str(row.pk))
        assert len(mail.outbox) == 1


class TestPurge:
    def test_old_credential_bodies_are_wiped_and_young_or_pending_ones_kept(self):
        old = queue(sensitive=True, status="sent", body_text="x")
        young = queue(sensitive=True, status="sent", body_text="y")
        waiting = queue(sensitive=True, status="queued", body_text="z")
        plain = queue(sensitive=False, status="sent", body_text="p")
        week = timezone.now() - timedelta(days=8)
        OutboundEmail.objects.filter(pk__in=[old.pk, waiting.pk, plain.pk]).update(created_at=week)
        assert outbox.purge() == (1, 0)
        for row in (old, young, waiting, plain):
            row.refresh_from_db()
        assert old.body_text == "" and old.body_purged
        assert young.body_text == "y" and waiting.body_text == "z" and plain.body_text == "p"

    def test_very_old_finished_rows_are_deleted_but_queued_ones_never(self):
        done = queue(status="sent")
        queued = queue(status="queued")
        OutboundEmail.objects.update(created_at=timezone.now() - timedelta(days=91))
        assert outbox.purge() == (0, 1)
        assert not OutboundEmail.objects.filter(pk=done.pk).exists() and OutboundEmail.objects.filter(pk=queued.pk).exists()


class TestTasks:
    def test_the_send_task_never_raises(self, caplog):
        with mock.patch("apps.Module5_Foundation.outbox.deliver", side_effect=RuntimeError("bug")):
            assert tasks.send_email_task("anything") == "error"
        assert "Unexpected failure while sending an email" in caplog.text

    def test_the_scheduled_tasks_run(self):
        queue()
        assert tasks.retry_failed_emails() == (0, 1)
        assert tasks.purge_email_bodies() == (0, 0)

    def test_a_second_holder_of_the_lock_is_turned_away(self):
        import zlib

        with single_run("same-job") as first:
            assert first is True
            other = connection.copy()
            try:
                with other.cursor() as cursor:
                    cursor.execute("SELECT pg_try_advisory_xact_lock(%s)", [zlib.crc32(b"same-job")])
                    assert cursor.fetchone()[0] is False
            finally:
                other.close()

    def test_a_task_skips_its_work_when_another_run_holds_the_lock(self):
        with mock.patch("apps.Module5_Foundation.tasks.single_run") as lock:
            lock.return_value.__enter__.return_value = False
            queue()
            assert tasks.retry_failed_emails() is None
        assert mail.outbox == []

    def test_every_scheduled_task_is_registered_under_its_beat_name(self, settings):
        from config.celery import app

        app.loader.import_default_modules()
        for entry in settings.CELERY_BEAT_SCHEDULE.values():
            assert entry["task"] in app.tasks, entry["task"]

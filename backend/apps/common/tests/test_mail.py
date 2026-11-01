import smtplib
from unittest import mock

import pytest
from django.core import mail
from django.db import transaction

from apps.common.mail import send_email_on_commit

pytestmark = pytest.mark.django_db


def test_email_is_sent_only_after_commit(django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=False) as callbacks:
        send_email_on_commit(to="a@example.com", subject="Hello", body="Body")
        assert mail.outbox == []
    assert len(callbacks) == 1
    callbacks[0]()
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == ["a@example.com"]
    assert mail.outbox[0].subject == "Hello"


def test_email_is_not_sent_when_transaction_rolls_back(django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        with pytest.raises(RuntimeError):
            with transaction.atomic():
                send_email_on_commit(to="a@example.com", subject="Hello", body="Body")
                raise RuntimeError
    assert callbacks == []
    assert mail.outbox == []


def test_html_alternative_and_multiple_recipients(django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        send_email_on_commit(to=["a@example.com", "b@example.com"], subject="S", body="text", html_body="<b>x</b>")
    message = mail.outbox[0]
    assert message.to == ["a@example.com", "b@example.com"]
    assert message.alternatives == [("<b>x</b>", "text/html")]


def test_delivery_failure_is_logged_without_recipients_and_not_raised(django_capture_on_commit_callbacks, caplog):
    with mock.patch("apps.common.mail.EmailMultiAlternatives.send", side_effect=smtplib.SMTPException("down")):
        with django_capture_on_commit_callbacks(execute=True):
            send_email_on_commit(to="secret@example.com", subject="Hello", body="Body")
    assert "Email delivery failed" in caplog.text
    assert "secret@example.com" not in caplog.text


def test_programming_errors_are_not_swallowed(django_capture_on_commit_callbacks):
    with mock.patch("apps.common.mail.EmailMultiAlternatives.send", side_effect=ValueError("bad header")):
        with pytest.raises(ValueError):
            with django_capture_on_commit_callbacks(execute=True):
                send_email_on_commit(to="a@example.com", subject="Hello", body="Body")

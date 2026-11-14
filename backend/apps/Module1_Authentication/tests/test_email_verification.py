import re

import pytest
from django.core import mail

from apps.Module1_Authentication import emails, tokens
from apps.Module1_Authentication.models import User
from apps.common.choices import CompanyStatus

pytestmark = pytest.mark.django_db
VERIFY = "/api/auth/verify-email/"
RESEND = "/api/auth/resend-verification/"


def unverified(user_factory, **overrides):
    return user_factory(email_verified=False, status=User.Status.PENDING_VERIFICATION, **overrides)


def code_for(user):
    return tokens.make_verification_otp(user)


def verify(client, user, code=None):
    return client.post(VERIFY, {"email": user.email, "code": code or code_for(user)}, format="json")


def test_verifying_activates_a_candidate(api_client, user_factory):
    user = unverified(user_factory)
    response = verify(api_client, user)
    assert response.status_code == 200
    assert response.json() == {"detail": "Email verified.", "status": "active"}
    user.refresh_from_db()
    assert user.email_verified and user.status == User.Status.ACTIVE


def test_verifying_twice_is_harmless(api_client, user_factory):
    user = unverified(user_factory)
    code = code_for(user)
    api_client.post(VERIFY, {"email": user.email, "code": code}, format="json")
    again = api_client.post(VERIFY, {"email": user.email, "code": code}, format="json")
    assert again.status_code == 200
    assert again.json() == {"detail": "Email already verified.", "status": "active"}


def test_company_admin_moves_to_pending_approval(api_client, member_factory):
    admin = member_factory(
        role="admin", company_status=CompanyStatus.PENDING, email_verified=False, status=User.Status.PENDING_VERIFICATION
    )
    assert verify(api_client, admin).json()["status"] == "pending_approval"


def test_company_admin_of_an_already_approved_company_becomes_active(api_client, member_factory):
    admin = member_factory(
        role="admin", company_status=CompanyStatus.APPROVED, email_verified=False, status=User.Status.PENDING_VERIFICATION
    )
    assert verify(api_client, admin).json()["status"] == "active"


@pytest.mark.parametrize("status", [User.Status.SUSPENDED, User.Status.REJECTED])
def test_verifying_never_overrides_a_decision_made_by_an_administrator(api_client, user_factory, status):
    user = user_factory(email_verified=False, status=status)
    assert verify(api_client, user).status_code == 200
    user.refresh_from_db()
    assert user.email_verified is True and user.status == status


def test_expired_code_is_rejected(api_client, user_factory, settings):
    user = unverified(user_factory)
    settings.EMAIL_OTP_MAX_AGE_SECONDS = -1
    code = code_for(user)
    response = api_client.post(VERIFY, {"email": user.email, "code": code}, format="json")
    assert response.status_code == 400
    assert response.json() == {"detail": "This code has expired. Request a new one.", "code": "expired"}


def test_a_wrong_code_counts_against_the_five_attempt_limit(api_client, user_factory):
    user = unverified(user_factory)
    code_for(user)  # the real code, never sent
    for left in (4, 3, 2, 1):
        response = api_client.post(VERIFY, {"email": user.email, "code": "000000"}, format="json")
        assert response.status_code == 400
        assert response.json()["code"] == "invalid_code"
        assert f"{left} attempt" in response.json()["detail"]
    locked = api_client.post(VERIFY, {"email": user.email, "code": "000000"}, format="json")
    assert locked.json() == {"detail": "Too many incorrect attempts. Request a new code.", "code": "too_many_attempts"}
    user.refresh_from_db()
    assert user.email_verified is False


def test_a_code_that_was_never_issued_is_invalid(api_client, user_factory):
    user = unverified(user_factory)
    response = api_client.post(VERIFY, {"email": user.email, "code": "123456"}, format="json")
    assert response.status_code == 400
    assert response.json()["code"] == "expired"  # no active row exists for this user


def test_a_code_for_a_deleted_or_unknown_user_is_invalid(api_client):
    response = api_client.post(VERIFY, {"email": "nobody@example.com", "code": "123456"}, format="json")
    assert response.status_code == 400
    assert response.json()["code"] == "invalid_code"


def test_a_malformed_code_is_a_field_error(api_client, user_factory):
    user = unverified(user_factory)
    response = api_client.post(VERIFY, {"email": user.email, "code": "12AB56"}, format="json")
    assert response.status_code == 400 and "code" in response.json()


def test_missing_fields_are_a_field_error(api_client):
    assert api_client.post(VERIFY, {}, format="json").json() == {
        "email": ["This field is required."],
        "code": ["This field is required."],
    }


def test_resending_invalidates_the_previous_code(api_client, user_factory):
    user = unverified(user_factory)
    old = code_for(user)
    new = code_for(user)
    assert old != new
    stale = api_client.post(VERIFY, {"email": user.email, "code": old}, format="json")
    assert stale.json()["code"] == "invalid_code"  # the old row is gone; this checks against the new one
    assert api_client.post(VERIFY, {"email": user.email, "code": new}, format="json").status_code == 200


def test_verify_is_throttled_on_top_of_the_per_code_lockout(api_client, user_factory, settings):
    settings.EMAIL_OTP_MAX_ATTEMPTS = 1000  # isolate the request throttle from the per-code attempt cap
    user = unverified(user_factory)
    code_for(user)
    codes = [api_client.post(VERIFY, {"email": user.email, "code": "000000"}, format="json").status_code for _ in range(21)]
    assert codes[-1] == 429


GENERIC = {"detail": "If that email needs verification, a new link has been sent."}


def test_resend_sends_a_fresh_code_to_an_unverified_account(api_client, user_factory, django_capture_on_commit_callbacks):
    user = unverified(user_factory, email="me@example.com")
    with django_capture_on_commit_callbacks(execute=True):
        response = api_client.post(RESEND, {"email": "ME@example.com"}, format="json")
    assert response.status_code == 200 and response.json() == GENERIC
    assert [m.to for m in mail.outbox] == [["me@example.com"]]
    assert re.search(r"\b\d{6}\b", mail.outbox[0].body)
    assert "http://" not in mail.outbox[0].body and "https://" not in mail.outbox[0].body
    assert user.pk


@pytest.mark.parametrize("email", ["verified@example.com", "nobody@example.com"])
def test_resend_answers_identically_and_sends_nothing_otherwise(api_client, user_factory, django_capture_on_commit_callbacks, email):
    user_factory(email="verified@example.com")
    with django_capture_on_commit_callbacks(execute=True):
        response = api_client.post(RESEND, {"email": email}, format="json")
    assert response.status_code == 200 and response.json() == GENERIC
    assert mail.outbox == []


def test_resend_is_throttled_to_3_per_hour(api_client):
    codes = [api_client.post(RESEND, {"email": "a@example.com"}, format="json").status_code for _ in range(4)]
    assert codes == [200, 200, 200, 429]


def test_the_code_is_hashed_in_the_database_never_stored_plain(user_factory):
    from apps.Module1_Authentication.models import EmailOTP

    user = unverified(user_factory)
    code = code_for(user)
    row = EmailOTP.objects.get(user=user, consumed_at__isnull=True)
    assert row.code_hash != code
    assert code not in row.code_hash


def test_the_email_body_mentions_the_expiry_window(user_factory, settings, django_capture_on_commit_callbacks):
    settings.EMAIL_OTP_MAX_AGE_SECONDS = 600
    with django_capture_on_commit_callbacks(execute=True):
        emails.send_verification_email(unverified(user_factory))
    assert "10 minutes" in mail.outbox[0].body

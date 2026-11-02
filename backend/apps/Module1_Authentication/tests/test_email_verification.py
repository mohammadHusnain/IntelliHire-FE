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


def verify(client, user):
    return client.post(VERIFY, {"token": tokens.make_verification_token(user)}, format="json")


def test_verifying_activates_a_candidate(api_client, user_factory):
    user = unverified(user_factory)
    response = verify(api_client, user)
    assert response.status_code == 200
    assert response.json() == {"detail": "Email verified.", "status": "active"}
    user.refresh_from_db()
    assert user.email_verified and user.status == User.Status.ACTIVE


def test_verifying_twice_is_harmless(api_client, user_factory):
    user = unverified(user_factory)
    verify(api_client, user)
    again = verify(api_client, user)
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


def test_expired_link_returns_the_expired_code(api_client, user_factory, settings):
    user = unverified(user_factory)
    token = tokens.make_verification_token(user)
    settings.EMAIL_VERIFICATION_MAX_AGE = -1
    response = api_client.post(VERIFY, {"token": token}, format="json")
    assert response.status_code == 400
    assert response.json() == {"detail": "Verification link has expired.", "code": "expired"}


@pytest.mark.parametrize("mangle", [lambda t: t[:-3] + "xyz", lambda t: "garbage", lambda t: t + "A"])
def test_tampered_link_is_invalid(api_client, user_factory, mangle):
    token = mangle(tokens.make_verification_token(unverified(user_factory)))
    response = api_client.post(VERIFY, {"token": token}, format="json")
    assert response.status_code == 400
    assert response.json() == {"detail": "Invalid verification link.", "code": "invalid_token"}


def test_link_for_a_changed_email_or_deleted_user_is_invalid(api_client, user_factory):
    user = unverified(user_factory)
    token = tokens.make_verification_token(user)
    User.objects.filter(pk=user.pk).update(email="changed@example.com")
    assert api_client.post(VERIFY, {"token": token}, format="json").json()["code"] == "invalid_token"
    user.delete()
    assert api_client.post(VERIFY, {"token": token}, format="json").json()["code"] == "invalid_token"


def test_a_token_signed_for_another_purpose_is_rejected(api_client, user_factory):
    from django.core import signing

    user = unverified(user_factory)
    forged = signing.dumps({"uid": str(user.pk), "email": user.email}, salt="some.other.salt")
    assert api_client.post(VERIFY, {"token": forged}, format="json").json()["code"] == "invalid_token"


def test_missing_token_is_a_field_error(api_client):
    assert api_client.post(VERIFY, {}, format="json").json() == {"token": ["This field is required."]}


GENERIC = {"detail": "If that email needs verification, a new link has been sent."}


def test_resend_sends_a_fresh_link_to_an_unverified_account(api_client, user_factory, django_capture_on_commit_callbacks):
    user = unverified(user_factory, email="me@example.com")
    with django_capture_on_commit_callbacks(execute=True):
        response = api_client.post(RESEND, {"email": "ME@example.com"}, format="json")
    assert response.status_code == 200 and response.json() == GENERIC
    assert [m.to for m in mail.outbox] == [["me@example.com"]]
    assert "/verify-email?token=" in mail.outbox[0].body
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


def test_the_email_uses_the_configured_frontend_url(user_factory, settings, django_capture_on_commit_callbacks):
    settings.FRONTEND_URL = "https://app.example.com"
    with django_capture_on_commit_callbacks(execute=True):
        emails.send_verification_email(unverified(user_factory))
    assert "https://app.example.com/verify-email?token=" in mail.outbox[0].body

from unittest import mock

import pytest
from django.core import mail
from django.db import DatabaseError
from rest_framework import status

from apps.accounts.models import CandidateProfile, User
from apps.common.tests.helpers import link_in

pytestmark = pytest.mark.django_db
URL = "/api/auth/register/candidate/"
VERIFY_URL = "/api/auth/verify-email/"


def payload(**overrides):
    data = {
        "full_name": "Ayesha Khan",
        "email": "ayesha@example.com",
        "password": "Sunny-Day-4711",
        "confirm_password": "Sunny-Day-4711",
    }
    data.update(overrides)
    return data


def test_tc01_sign_up_creates_a_pending_candidate_and_emails_a_verify_link(api_client, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        response = api_client.post(URL, payload(), format="json")

    assert response.status_code == status.HTTP_201_CREATED
    assert response.json() == {"email": "ayesha@example.com", "status": "pending_verification"}
    user = User.objects.get(email="ayesha@example.com")
    assert user.role == User.Role.CANDIDATE
    assert user.status == User.Status.PENDING_VERIFICATION and user.email_verified is False
    assert user.check_password("Sunny-Day-4711") and user.password != "Sunny-Day-4711"
    assert CandidateProfile.objects.filter(user=user).exists()

    assert len(mail.outbox) == 1 and mail.outbox[0].to == ["ayesha@example.com"]
    url, query = link_in(mail.outbox[0])
    assert url.startswith("http://localhost:5173/verify-email?token=")

    verified = api_client.post(VERIFY_URL, {"token": query["token"]}, format="json")
    assert verified.status_code == 200 and verified.json()["status"] == "active"
    user.refresh_from_db()
    assert user.status == User.Status.ACTIVE and user.email_verified is True


def test_the_user_is_not_logged_in_and_no_secret_is_returned(api_client):
    body = api_client.post(URL, payload(), format="json").json()
    assert set(body) == {"email", "status"}


@pytest.mark.parametrize("email", ["ayesha@example.com", "AYESHA@Example.COM", " Ayesha@example.com "])
def test_tc02_duplicate_email_is_rejected_in_any_letter_case(api_client, django_capture_on_commit_callbacks, email):
    api_client.post(URL, payload(), format="json")
    with django_capture_on_commit_callbacks(execute=True):
        response = api_client.post(URL, payload(email=email), format="json")
    assert response.status_code == 400
    assert response.json() == {"email": ["Email already registered."]}
    assert User.objects.count() == 1
    assert mail.outbox == []


def test_email_is_stored_lowercase_and_trimmed(api_client):
    api_client.post(URL, payload(email="  New.Person@Example.COM "), format="json")
    assert User.objects.get().email == "new.person@example.com"


def test_all_missing_fields_are_reported_at_once(api_client):
    response = api_client.post(URL, {}, format="json")
    assert response.status_code == 400
    assert set(response.json()) == {"full_name", "email", "password", "confirm_password"}


@pytest.mark.parametrize(
    "overrides,field",
    [
        ({"email": "not-an-email"}, "email"),
        ({"full_name": "   "}, "full_name"),
        ({"full_name": "x" * 151}, "full_name"),
        ({"confirm_password": "Different-4711"}, "confirm_password"),
        ({"password": "short1", "confirm_password": "short1"}, "password"),
        ({"password": "12345678901", "confirm_password": "12345678901"}, "password"),
        ({"password": "password1234", "confirm_password": "password1234"}, "password"),
        ({"password": "ayesha@example.com", "confirm_password": "ayesha@example.com"}, "password"),
    ],
)
def test_invalid_input_is_rejected_per_field(api_client, overrides, field):
    response = api_client.post(URL, payload(**overrides), format="json")
    assert response.status_code == 400
    assert field in response.json()
    assert User.objects.count() == 0


def test_password_mismatch_message(api_client):
    response = api_client.post(URL, payload(confirm_password="Other-Pass-9999"), format="json")
    assert response.json()["confirm_password"] == ["Passwords do not match."]


def test_role_and_status_cannot_be_chosen_by_the_client(api_client):
    api_client.post(URL, payload(role="platform_admin", status="active", email_verified=True, is_staff=True), format="json")
    user = User.objects.get()
    assert user.role == "candidate" and user.status == "pending_verification"
    assert user.email_verified is False and user.is_staff is False and user.is_superuser is False


def test_failure_rolls_everything_back_and_sends_no_email(api_client, django_capture_on_commit_callbacks):
    with mock.patch("apps.accounts.services.CandidateProfile.objects.create", side_effect=DatabaseError):
        with django_capture_on_commit_callbacks(execute=True):
            with pytest.raises(DatabaseError):
                api_client.post(URL, payload(), format="json")
    assert User.objects.count() == 0 and CandidateProfile.objects.count() == 0
    assert mail.outbox == []


def test_a_race_on_the_unique_email_is_reported_as_a_field_error(api_client, user_factory):
    user_factory(email="ayesha@example.com")
    with mock.patch("apps.accounts.serializers.ensure_email_available"):
        response = api_client.post(URL, payload(), format="json")
    assert response.status_code == 400
    assert response.json() == {"email": ["Email already registered."]}


def test_registration_is_throttled_to_10_per_hour_per_client(api_client):
    codes = [api_client.post(URL, payload(email=f"u{i}@example.com"), format="json").status_code for i in range(11)]
    assert codes[:10] == [201] * 10 and codes[10] == 429
    spoofed = api_client.post(URL, payload(email="x@example.com"), format="json", HTTP_X_FORWARDED_FOR="9.9.9.9")
    assert spoofed.status_code == 429
    assert spoofed.json()["code"] == "throttled"

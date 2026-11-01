from unittest import mock

import pytest
from django.core import mail
from django.db import DatabaseError

from apps.accounts.models import User
from apps.common.choices import CompanyStatus
from apps.common.tests.helpers import link_in
from apps.companies.models import Company, CompanyMember

pytestmark = pytest.mark.django_db
URL = "/api/auth/register/company/"
VERIFY = "/api/auth/verify-email/"
LOGIN = "/api/auth/login/"
PASSWORD = "Sunny-Day-4711"


def payload(**overrides):
    data = {
        "company_name": "Acme Software",
        "industry": "Software",
        "official_email": "hr@acme.example",
        "admin_full_name": "Bilal Ahmed",
        "admin_phone": "+92 300 1234567",
        "password": PASSWORD,
        "confirm_password": PASSWORD,
    }
    data.update(overrides)
    return data


def register(client, capture, **overrides):
    with capture(execute=True):
        return client.post(URL, payload(**overrides), format="json")


def test_tc03_sign_up_creates_user_company_and_admin_member_and_sends_two_emails(api_client, django_capture_on_commit_callbacks):
    response = register(api_client, django_capture_on_commit_callbacks)
    assert response.status_code == 201
    assert response.json() == {"email": "hr@acme.example", "status": "pending_verification"}

    user = User.objects.get(email="hr@acme.example")
    assert (user.role, user.status, user.email_verified, user.full_name) == ("company_admin", "pending_verification", False, "Bilal Ahmed")
    company = Company.objects.get()
    assert (company.name, company.industry, company.official_email, company.contact_phone) == (
        "Acme Software", "Software", "hr@acme.example", "+92 300 1234567",
    )
    assert company.status == CompanyStatus.PENDING and company.created_by == user and company.slug == "acme-software"
    member = CompanyMember.objects.get()
    assert (member.company, member.user, member.role, member.is_active) == (company, user, "admin", True)

    assert len(mail.outbox) == 2 and all(m.to == ["hr@acme.example"] for m in mail.outbox)
    subjects = {m.subject for m in mail.outbox}
    assert subjects == {"Verify your IntelliHire email", "IntelliHire registration received"}
    received = next(m for m in mail.outbox if "received" in m.subject)
    assert "Acme Software" in received.body


def test_tc03_login_is_refused_until_the_email_is_verified_and_the_company_approved(api_client, django_capture_on_commit_callbacks):
    register(api_client, django_capture_on_commit_callbacks)

    def login():
        return api_client.post(LOGIN, {"email": "hr@acme.example", "password": PASSWORD}, format="json")

    assert login().json()["code"] == "pending_verification"

    _, query = link_in(next(m for m in mail.outbox if "Verify" in m.subject))
    assert api_client.post(VERIFY, {"token": query["token"]}, format="json").json()["status"] == "pending_approval"
    blocked = login()
    assert blocked.status_code == 403
    assert blocked.json() == {"detail": "Your company account is awaiting administrator approval.", "code": "pending_approval"}


def test_verifying_after_the_company_was_approved_activates_the_admin_directly(api_client, django_capture_on_commit_callbacks):
    register(api_client, django_capture_on_commit_callbacks)
    Company.objects.update(status=CompanyStatus.APPROVED)
    _, query = link_in(next(m for m in mail.outbox if "Verify" in m.subject))
    assert api_client.post(VERIFY, {"token": query["token"]}, format="json").json()["status"] == "active"
    login = api_client.post(LOGIN, {"email": "hr@acme.example", "password": PASSWORD}, format="json")
    assert login.status_code == 200
    assert login.json()["user"]["company"]["member_role"] == "admin"


def test_all_missing_fields_are_reported_at_once(api_client):
    assert set(api_client.post(URL, {}, format="json").json()) == {
        "company_name", "industry", "official_email", "admin_full_name", "admin_phone", "password", "confirm_password",
    }


def test_company_name_must_be_unique_in_any_letter_case(api_client, company_factory, django_capture_on_commit_callbacks):
    company_factory(name="Acme Software")
    response = register(api_client, django_capture_on_commit_callbacks, company_name="ACME software")
    assert response.status_code == 400
    assert response.json() == {"company_name": ["A company with this name is already registered."]}
    assert mail.outbox == []


def test_official_email_must_not_belong_to_any_existing_user(api_client, user_factory, django_capture_on_commit_callbacks):
    user_factory(email="hr@acme.example")
    response = register(api_client, django_capture_on_commit_callbacks, official_email="HR@Acme.example")
    assert response.status_code == 400 and response.json() == {"official_email": ["Email already registered."]}
    assert Company.objects.count() == 0


@pytest.mark.parametrize(
    "overrides,field",
    [
        ({"official_email": "nope"}, "official_email"),
        ({"admin_phone": "abc"}, "admin_phone"),
        ({"admin_phone": "123"}, "admin_phone"),
        ({"company_name": "x" * 201}, "company_name"),
        ({"industry": ""}, "industry"),
        ({"confirm_password": "Different-4711"}, "confirm_password"),
        ({"password": "short1", "confirm_password": "short1"}, "password"),
    ],
)
def test_invalid_input_is_rejected_per_field_and_creates_nothing(api_client, overrides, field):
    response = api_client.post(URL, payload(**overrides), format="json")
    assert response.status_code == 400 and field in response.json()
    assert User.objects.count() == Company.objects.count() == CompanyMember.objects.count() == 0


def test_free_email_domains_are_allowed_by_default_and_blockable_by_setting(api_client, settings):
    assert api_client.post(URL, payload(official_email="owner@gmail.com"), format="json").status_code == 201
    settings.COMPANY_EMAIL_BLOCKED_DOMAINS = ["gmail.com", "yahoo.com"]
    blocked = api_client.post(URL, payload(company_name="Other", official_email="other@Gmail.com"), format="json")
    assert blocked.status_code == 400
    assert blocked.json() == {"official_email": ["Please use your company email address."]}
    assert api_client.post(URL, payload(company_name="Third", official_email="x@third.example"), format="json").status_code == 201


def test_status_and_role_cannot_be_chosen_by_the_client(api_client):
    api_client.post(URL, payload(status="approved", role="platform_admin", company_status="approved", is_staff=True), format="json")
    assert Company.objects.get().status == "pending"
    user = User.objects.get()
    assert (user.role, user.status, user.is_staff) == ("company_admin", "pending_verification", False)


def test_a_failure_rolls_everything_back_and_sends_no_email(api_client, django_capture_on_commit_callbacks):
    with mock.patch("apps.companies.services.CompanyMember.objects.create", side_effect=DatabaseError):
        with django_capture_on_commit_callbacks(execute=True):
            with pytest.raises(DatabaseError):
                api_client.post(URL, payload(), format="json")
    assert User.objects.count() == Company.objects.count() == CompanyMember.objects.count() == 0
    assert mail.outbox == []


def test_races_on_unique_values_become_field_errors(api_client, company_factory, user_factory):
    company_factory(name="Acme Software")
    with mock.patch("apps.companies.serializers.CompanyRegistrationSerializer.validate_company_name", lambda self, v: v):
        name_race = api_client.post(URL, payload(), format="json")
    assert name_race.status_code == 400 and "company_name" in name_race.json()

    user_factory(email="hr@acme.example")
    with mock.patch("apps.companies.serializers.ensure_email_available"):
        email_race = api_client.post(URL, payload(company_name="Fresh Name"), format="json")
    assert email_race.status_code == 400 and email_race.json() == {"official_email": ["Email already registered."]}


def test_company_and_candidate_sign_up_share_the_registration_throttle(api_client):
    for i in range(10):
        api_client.post("/api/auth/register/candidate/", {"full_name": "A", "email": f"a{i}@example.com", "password": PASSWORD, "confirm_password": PASSWORD}, format="json")
    assert api_client.post(URL, payload(), format="json").status_code == 429

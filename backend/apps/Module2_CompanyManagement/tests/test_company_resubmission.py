import pytest
from django.core import mail

from apps.common.choices import CompanyStatus, MemberRole, UserRole, UserStatus
from apps.Module2_CompanyManagement.models import Company, CompanyMember

pytestmark = pytest.mark.django_db
URL = "/api/auth/register/company/resubmit/"
REVIEW = "/api/platform-admin/companies/"
LOGIN = "/api/auth/login/"
PASSWORD = "Str0ng!pass-123"


@pytest.fixture
def rejected(user_factory, company_factory):
    founder = user_factory(role=UserRole.COMPANY_ADMIN, status=UserStatus.REJECTED, email="founder@acme.example")
    company = company_factory(
        name="Acme Software", created_by=founder, status=CompanyStatus.REJECTED,
        rejection_reason="Registration details were incomplete.",
    )
    CompanyMember.objects.create(company=company, user=founder, role=MemberRole.ADMIN)
    return company


def body(**overrides):
    payload = {
        "official_email": "founder@acme.example", "password": PASSWORD, "company_name": "Acme Software Ltd",
        "industry": "Software", "admin_full_name": "Founder One", "admin_phone": "+92 300 1234567",
    }
    payload.update(overrides)
    return payload


def test_resubmit_returns_company_to_pending_and_notifies_platform_admins(api_client, rejected, platform_admin, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        response = api_client.post(URL, body(), format="json")
    assert response.status_code == 200 and response.json()["status"] == "pending"
    rejected.refresh_from_db()
    assert rejected.status == CompanyStatus.PENDING and rejected.rejection_reason == ""
    assert rejected.name == "Acme Software Ltd" and rejected.slug == "acme-software-ltd"
    assert rejected.created_by.status == UserStatus.PENDING_APPROVAL
    assert rejected.created_by.full_name == "Founder One"
    assert Company.objects.count() == 1 and CompanyMember.objects.count() == 1
    assert [m.to for m in mail.outbox] == [[platform_admin.email]]
    assert "resubmitted" in mail.outbox[0].subject.lower() and "/admin/companies" in mail.outbox[0].body


def test_resubmitted_company_appears_in_review_queue_and_can_be_approved(api_client, auth_client, rejected, platform_admin):
    api_client.post(URL, body(), format="json")
    client = auth_client(platform_admin)
    queue = client.get(REVIEW).json()["results"]
    assert [c["name"] for c in queue] == ["Acme Software Ltd"]
    assert client.post(f"{REVIEW}{rejected.pk}/approve/").status_code == 200
    assert api_client.post(LOGIN, {"email": "founder@acme.example", "password": PASSWORD}, format="json").status_code == 200


def test_keeping_the_same_name_is_allowed(api_client, rejected):
    assert api_client.post(URL, body(company_name="Acme Software"), format="json").status_code == 200
    rejected.refresh_from_db()
    assert rejected.slug == "acme-software"


def test_email_lookup_is_case_insensitive(api_client, rejected):
    assert api_client.post(URL, body(official_email=" Founder@ACME.example "), format="json").status_code == 200


def test_unverified_founder_returns_to_pending_verification(api_client, rejected):
    founder = rejected.created_by
    founder.email_verified = False
    founder.save()
    api_client.post(URL, body(), format="json")
    founder.refresh_from_db()
    assert founder.status == UserStatus.PENDING_VERIFICATION


@pytest.mark.parametrize("email,password", [("founder@acme.example", "Wrong-pass-1"), ("nobody@acme.example", PASSWORD)])
def test_bad_credentials_are_a_uniform_401(api_client, rejected, email, password):
    response = api_client.post(URL, body(official_email=email, password=password), format="json")
    assert response.status_code == 400 and response.json()["code"] == "invalid_credentials"
    rejected.refresh_from_db()
    assert rejected.status == CompanyStatus.REJECTED


@pytest.mark.parametrize("status", [CompanyStatus.PENDING, CompanyStatus.APPROVED, CompanyStatus.SUSPENDED])
def test_only_rejected_companies_can_be_resubmitted(api_client, user_factory, company_factory, status):
    founder = user_factory(role=UserRole.COMPANY_ADMIN, email="founder@acme.example")
    extra = {"suspension_reason": "Policy violation under review."} if status == CompanyStatus.SUSPENDED else {}
    company = company_factory(created_by=founder, status=status, **extra)
    CompanyMember.objects.create(company=company, user=founder, role=MemberRole.ADMIN)
    response = api_client.post(URL, body(), format="json")
    assert response.status_code == 400 and response.json()["code"] == "not_rejected"
    company.refresh_from_db()
    assert company.status == status


def test_candidate_and_platform_admin_cannot_use_it(api_client, user_factory, platform_admin):
    user_factory(email="cand@example.com")
    for email in ("cand@example.com", platform_admin.email):
        response = api_client.post(URL, body(official_email=email), format="json")
        assert response.status_code == 400 and response.json()["code"] == "not_rejected"


def test_name_taken_by_another_company(api_client, rejected, company_factory):
    company_factory(name="Taken Inc")
    response = api_client.post(URL, body(company_name="taken inc"), format="json")
    assert response.status_code == 400
    assert response.json()["company_name"] == ["A company with this name is already registered."]
    rejected.refresh_from_db()
    assert rejected.status == CompanyStatus.REJECTED and rejected.name == "Acme Software"


@pytest.mark.parametrize(
    "overrides,field",
    [
        ({"company_name": ""}, "company_name"),
        ({"industry": ""}, "industry"),
        ({"admin_full_name": ""}, "admin_full_name"),
        ({"admin_phone": "abc"}, "admin_phone"),
        ({"password": ""}, "password"),
    ],
)
def test_validation(api_client, rejected, overrides, field):
    response = api_client.post(URL, body(**overrides), format="json")
    assert response.status_code == 400 and field in response.json()


def test_second_resubmit_is_refused(api_client, rejected):
    assert api_client.post(URL, body(), format="json").status_code == 200
    assert api_client.post(URL, body(), format="json").json()["code"] == "not_rejected"


def test_resubmit_is_throttled(api_client, rejected):
    codes = [api_client.post(URL, body(password="Wrong-pass-1"), format="json").status_code for _ in range(7)]
    assert codes[-1] == 429

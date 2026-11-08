import jwt
import pytest
from django.core import mail

from apps.Module1_Authentication.models import User
from apps.common.choices import CompanyStatus, MemberRole

pytestmark = pytest.mark.django_db
LOGIN = "/api/auth/login/"
PASSWORD = "Str0ng!pass-123"
INVALID = {"detail": "Invalid email or password.", "code": "invalid_credentials"}


def login(client, email, password=PASSWORD, **extra):
    return client.post(LOGIN, {"email": email, "password": password}, format="json", **extra)


def test_tc04_active_user_gets_tokens_and_the_user_object(api_client, user_factory):
    user = user_factory(email="cand@example.com", full_name="Cand Idate")
    response = login(api_client, "cand@example.com")
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"access", "refresh", "user"}
    assert body["user"] == {
        "id": str(user.pk),
        "email": "cand@example.com",
        "full_name": "Cand Idate",
        "role": "candidate",
        "status": "active",
        "company": None,
    }
    claims = jwt.decode(body["access"], options={"verify_signature": False})
    assert claims["role"] == "candidate" and claims["full_name"] == "Cand Idate"
    assert claims["user_id"] == str(user.pk) and claims["token_type"] == "access"
    user.refresh_from_db()
    assert user.last_login is not None


def test_company_users_get_their_company_in_the_user_object(api_client, member_factory):
    hr = member_factory(role=MemberRole.HR_MANAGER, email="hr@example.com")
    company = hr.company_membership.company
    body = login(api_client, "hr@example.com").json()
    assert body["user"]["role"] == "hr"
    assert body["user"]["company"] == {
        "id": str(company.pk),
        "name": company.name,
        "member_role": "hr_manager",
        "status": "approved",
    }


def test_login_is_case_insensitive_on_email(api_client, user_factory):
    user_factory(email="mixed@example.com")
    assert login(api_client, "  MIXED@Example.com ").status_code == 200


def test_tc05_wrong_password_and_unknown_email_look_identical_and_do_not_lock_the_account(api_client, user_factory):
    user_factory(email="cand@example.com")
    wrong = login(api_client, "cand@example.com", "Wrong-pass-1")
    unknown = login(api_client, "nobody@example.com")
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json() == INVALID
    assert login(api_client, "cand@example.com").status_code == 200


def test_a_malformed_email_is_just_invalid_credentials(api_client):
    response = login(api_client, "not-an-email")
    assert response.status_code == 401 and response.json() == INVALID


@pytest.mark.parametrize("email", ["", "a" * 300])
def test_blank_or_oversized_email_is_a_field_error(api_client, email):
    response = login(api_client, email)
    assert response.status_code == 400 and "email" in response.json()


@pytest.mark.parametrize(
    "status,message",
    [
        ("pending_verification", "Please verify your email before logging in."),
        ("pending_approval", "Your company account is awaiting administrator approval."),
        ("rejected", "Your company registration was not approved."),
        ("suspended", "Your account has been suspended."),
    ],
)
def test_correct_credentials_on_a_non_active_account_get_403_with_the_status_as_code(api_client, user_factory, status, message):
    user_factory(email="x@example.com", status=status)
    response = login(api_client, "x@example.com")
    assert response.status_code == 403
    assert response.json() == {"detail": message, "code": status}


def test_a_wrong_password_never_reveals_the_account_status(api_client, user_factory):
    user_factory(email="x@example.com", status="suspended")
    assert login(api_client, "x@example.com", "Wrong-pass-1").json() == INVALID


def test_login_is_throttled_to_5_per_minute_and_the_client_ip_cannot_be_spoofed(api_client, user_factory):
    user_factory(email="cand@example.com")
    codes = [login(api_client, "cand@example.com", "bad-pass-1", HTTP_X_FORWARDED_FOR=f"1.1.1.{i}").status_code for i in range(7)]
    assert codes == [401] * 5 + [429] * 2


def test_a_stale_authorization_header_does_not_break_the_public_endpoint(api_client, user_factory):
    user_factory(email="cand@example.com")
    assert login(api_client, "cand@example.com", HTTP_AUTHORIZATION="Bearer garbage").status_code == 200


def test_responses_never_contain_a_password(api_client, user_factory):
    user_factory(email="cand@example.com")
    assert "password" not in login(api_client, "cand@example.com").text.lower()


def test_login_sends_no_email(api_client, user_factory, django_capture_on_commit_callbacks):
    user_factory(email="cand@example.com")
    with django_capture_on_commit_callbacks(execute=True):
        login(api_client, "cand@example.com")
    assert mail.outbox == []


def test_a_company_admin_of_a_suspended_company_can_still_log_in(api_client, member_factory):
    admin = member_factory(role=MemberRole.ADMIN, company_status=CompanyStatus.SUSPENDED, email="adm@example.com")
    assert admin.status == User.Status.ACTIVE
    assert login(api_client, "adm@example.com").status_code == 200


class TestDeactivatedMembers:
    """A company admin can turn a member's access off. The account stays, but it cannot be used until restored."""

    def test_a_deactivated_member_cannot_log_in(self, api_client, member_factory):
        member = member_factory(role=MemberRole.RECRUITER, email="gone@example.com")
        member.company_membership.is_active = False
        member.company_membership.save()
        response = login(api_client, "gone@example.com")
        assert response.status_code == 403
        assert response.json() == {"detail": "Your access to this company has been turned off. Contact your company admin.", "code": "member_deactivated"}

    def test_wrong_password_still_looks_like_wrong_password(self, api_client, member_factory):
        member = member_factory(role=MemberRole.RECRUITER, email="gone2@example.com")
        member.company_membership.is_active = False
        member.company_membership.save()
        assert login(api_client, "gone2@example.com", password="Wrong-pass-1").json() == INVALID

    def test_reactivated_member_can_log_in_again(self, api_client, member_factory):
        member = member_factory(role=MemberRole.RECRUITER, email="back@example.com")
        membership = member.company_membership
        membership.is_active = False
        membership.save()
        assert login(api_client, "back@example.com").status_code == 403
        membership.is_active = True
        membership.save()
        assert login(api_client, "back@example.com").status_code == 200

    def test_an_old_refresh_token_of_a_deactivated_member_is_refused(self, api_client, member_factory):
        from apps.Module1_Authentication import auth_tokens

        member = member_factory(role=MemberRole.RECRUITER, email="old@example.com")
        pair = auth_tokens.issue_tokens(member)
        member.company_membership.is_active = False
        member.company_membership.save()
        response = api_client.post("/api/auth/token/refresh/", {"refresh": pair["refresh"]}, format="json")
        assert response.status_code == 401 and response.json()["code"] == "member_deactivated"

    def test_other_users_are_not_affected(self, api_client, user_factory, member_factory):
        user_factory(email="cand@example.com")
        assert login(api_client, "cand@example.com").status_code == 200
        member_factory(role=MemberRole.ADMIN, email="boss@example.com")
        assert login(api_client, "boss@example.com").status_code == 200

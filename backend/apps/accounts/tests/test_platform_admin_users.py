import uuid

import pytest

from apps.accounts import auth_tokens
from apps.accounts.models import User
from apps.common.choices import CompanyStatus, MemberRole

pytestmark = pytest.mark.django_db
DENIED = {"detail": "Unauthorized access.", "code": "permission_denied"}


def suspend_url(user):
    return f"/api/platform-admin/users/{user.pk}/suspend/"


def reactivate_url(user):
    return f"/api/platform-admin/users/{user.pk}/reactivate/"


@pytest.fixture
def admin(user_factory):
    return user_factory(role=User.Role.PLATFORM_ADMIN)


def test_tc07_non_admins_get_403_with_the_documented_message(api_client, auth_client, user_factory, member_factory):
    target = user_factory()
    assert api_client.post(suspend_url(target)).status_code == 401
    for user in (user_factory(), member_factory(role=MemberRole.HR_MANAGER), member_factory(role=MemberRole.ADMIN)):
        for url in (suspend_url(target), reactivate_url(target)):
            response = auth_client(user).post(url)
            assert response.status_code == 403 and response.json() == DENIED
    target.refresh_from_db()
    assert target.status == User.Status.ACTIVE


def test_suspending_blocks_the_existing_access_token_and_all_refresh_tokens(auth_client, api_client, admin, user_factory):
    target = user_factory(email="t@example.com")
    target_client = auth_client(target)
    refresh = auth_tokens.issue_tokens(target)["refresh"]
    assert target_client.get("/api/auth/me/").status_code == 200

    response = auth_client(admin).post(suspend_url(target))
    assert response.status_code == 200
    assert response.json() == {
        "id": str(target.pk), "email": "t@example.com", "full_name": target.full_name,
        "role": "candidate", "status": "suspended", "company": None,
    }
    blocked = target_client.get("/api/auth/me/")
    assert blocked.status_code == 401 and blocked.json()["code"] == "account_inactive"
    assert api_client.post("/api/auth/token/refresh/", {"refresh": refresh}, format="json").status_code == 401
    login = api_client.post("/api/auth/login/", {"email": "t@example.com", "password": "Str0ng!pass-123"}, format="json")
    assert login.status_code == 403 and login.json()["code"] == "suspended"


def test_suspension_rules(auth_client, admin, user_factory):
    client = auth_client(admin)
    assert client.post(suspend_url(admin)).json()["code"] == "cannot_suspend_self"
    other_admin = user_factory(role=User.Role.PLATFORM_ADMIN)
    assert client.post(suspend_url(other_admin)).json()["code"] == "cannot_suspend_admin"
    target = user_factory()
    assert client.post(suspend_url(target)).status_code == 200
    again = client.post(suspend_url(target))
    assert again.status_code == 409 and again.json()["code"] == "already_suspended"


def test_reactivating_restores_the_correct_status(auth_client, admin, user_factory, member_factory):
    client = auth_client(admin)
    cases = {
        "verified candidate": (user_factory(), "active"),
        "unverified candidate": (user_factory(email_verified=False), "pending_verification"),
        "approved company admin": (member_factory(role=MemberRole.ADMIN), "active"),
        "pending company admin": (member_factory(role=MemberRole.ADMIN, company_status=CompanyStatus.PENDING), "pending_approval"),
        "rejected company admin": (member_factory(role=MemberRole.ADMIN, company_status=CompanyStatus.REJECTED), "rejected"),
        "admin of a suspended company": (member_factory(role=MemberRole.ADMIN, company_status=CompanyStatus.SUSPENDED), "active"),
        "approved hr": (member_factory(role=MemberRole.RECRUITER), "active"),
    }
    for label, (user, expected) in cases.items():
        User.objects.filter(pk=user.pk).update(status="suspended")
        response = client.post(reactivate_url(user))
        assert response.status_code == 200 and response.json()["status"] == expected, label


def test_reactivating_a_user_that_is_not_suspended_is_a_409(auth_client, admin, user_factory):
    response = auth_client(admin).post(reactivate_url(user_factory()))
    assert response.status_code == 409 and response.json()["code"] == "not_suspended"


def test_unknown_users_are_404_and_non_uuid_paths_do_not_match(auth_client, admin):
    client = auth_client(admin)
    assert client.post(f"/api/platform-admin/users/{uuid.uuid4()}/suspend/").status_code == 404
    assert client.post("/api/platform-admin/users/not-a-uuid/suspend/").status_code == 404


def test_only_post_is_allowed(auth_client, admin, user_factory):
    target = user_factory()
    assert auth_client(admin).get(suspend_url(target)).status_code == 405
    assert auth_client(admin).delete(suspend_url(target)).status_code == 405

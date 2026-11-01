import pytest

from apps.accounts.models import User

pytestmark = pytest.mark.django_db
ME = "/api/auth/me/"


def test_get_returns_the_current_user(auth_client, user_factory):
    user = user_factory(full_name="Sana Malik")
    response = auth_client(user).get(ME)
    assert response.status_code == 200
    assert response.json() == {
        "id": str(user.pk),
        "email": user.email,
        "full_name": "Sana Malik",
        "role": "candidate",
        "status": "active",
        "company": None,
    }


def test_patch_changes_only_the_full_name(auth_client, user_factory):
    user = user_factory(email="keep@example.com")
    response = auth_client(user).patch(
        ME,
        {"full_name": "New Name", "email": "x@example.com", "role": "platform_admin", "status": "suspended", "is_staff": True},
        format="json",
    )
    assert response.status_code == 200 and response.json()["full_name"] == "New Name"
    user.refresh_from_db()
    assert (user.email, user.role, user.status, user.is_staff) == ("keep@example.com", "candidate", "active", False)


@pytest.mark.parametrize("name", ["", "   ", "x" * 151])
def test_patch_rejects_invalid_names(auth_client, user_factory, name):
    response = auth_client(user_factory()).patch(ME, {"full_name": name}, format="json")
    assert response.status_code == 400 and "full_name" in response.json()


def test_company_users_see_their_company(auth_client, member_factory):
    user = member_factory(role="admin")
    company = user.company_membership.company
    body = auth_client(user).get(ME).json()
    assert body["company"] == {"id": str(company.pk), "name": company.name, "member_role": "admin", "status": "approved"}


def test_requires_authentication_and_rejects_other_methods(api_client, auth_client, user_factory):
    assert api_client.get(ME).status_code == 401
    assert auth_client(user_factory()).put(ME, {"full_name": "X"}, format="json").status_code == 405
    assert auth_client(user_factory()).delete(ME).status_code == 405


def test_the_user_count_is_unchanged_by_reads(auth_client, user_factory):
    user = user_factory()
    auth_client(user).get(ME)
    assert User.objects.count() == 1

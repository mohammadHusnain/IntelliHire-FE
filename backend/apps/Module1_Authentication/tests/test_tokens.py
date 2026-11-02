import jwt
import pytest
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from apps.Module1_Authentication import auth_tokens
from apps.Module1_Authentication.models import User

pytestmark = pytest.mark.django_db
REFRESH = "/api/auth/token/refresh/"
LOGOUT = "/api/auth/logout/"
ME = "/api/auth/me/"


def refresh(client, token):
    return client.post(REFRESH, {"refresh": token}, format="json")


def test_refresh_rotates_the_pair_and_blacklists_the_old_refresh_token(api_client, user_factory):
    pair = auth_tokens.issue_tokens(user_factory())
    new = refresh(api_client, pair["refresh"])
    assert new.status_code == 200
    body = new.json()
    assert set(body) == {"access", "refresh"} and body["refresh"] != pair["refresh"]
    reuse = refresh(api_client, pair["refresh"])
    assert reuse.status_code == 401 and reuse.json()["code"] == "token_not_valid"
    assert refresh(api_client, body["refresh"]).status_code == 200


def test_refresh_reissues_claims_from_the_database(api_client, user_factory):
    user = user_factory(full_name="Old Name")
    pair = auth_tokens.issue_tokens(user)
    User.objects.filter(pk=user.pk).update(full_name="New Name")
    access = refresh(api_client, pair["refresh"]).json()["access"]
    assert jwt.decode(access, options={"verify_signature": False})["full_name"] == "New Name"


def test_refresh_rejects_garbage(api_client):
    response = refresh(api_client, "garbage")
    assert response.status_code == 401 and response.json()["code"] == "token_not_valid"
    assert refresh(api_client, "").status_code == 400


def test_an_access_token_cannot_be_used_as_a_refresh_token(api_client, user_factory):
    pair = auth_tokens.issue_tokens(user_factory())
    assert refresh(api_client, pair["access"]).status_code == 401


def test_a_refresh_token_cannot_authenticate_requests(api_client, user_factory):
    pair = auth_tokens.issue_tokens(user_factory())
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {pair['refresh']}")
    assert api_client.get(ME).status_code == 401


def test_a_suspended_user_cannot_refresh(api_client, user_factory):
    user = user_factory()
    pair = auth_tokens.issue_tokens(user)
    User.objects.filter(pk=user.pk).update(status="suspended")
    response = refresh(api_client, pair["refresh"])
    assert response.status_code == 401 and response.json()["code"] == "account_inactive"


def test_refresh_is_atomic_so_a_failure_does_not_burn_the_old_token(api_client, user_factory, monkeypatch):
    pair = auth_tokens.issue_tokens(user_factory())
    monkeypatch.setattr("apps.Module1_Authentication.services.auth_tokens.issue_tokens", lambda user: 1 / 0)
    with pytest.raises(ZeroDivisionError):
        refresh(api_client, pair["refresh"])
    monkeypatch.undo()
    assert refresh(api_client, pair["refresh"]).status_code == 200


def test_logout_blacklists_the_refresh_token(auth_client, api_client, user_factory):
    user = user_factory()
    pair = auth_tokens.issue_tokens(user)
    response = auth_client(user).post(LOGOUT, {"refresh": pair["refresh"]}, format="json")
    assert response.status_code == 205 and response.content == b""
    assert refresh(api_client, pair["refresh"]).status_code == 401


def test_logout_twice_or_with_garbage_is_a_400(auth_client, user_factory):
    user = user_factory()
    client = auth_client(user)
    pair = auth_tokens.issue_tokens(user)
    assert client.post(LOGOUT, {"refresh": pair["refresh"]}, format="json").status_code == 205
    again = client.post(LOGOUT, {"refresh": pair["refresh"]}, format="json")
    assert again.status_code == 400 and again.json()["code"] == "invalid_token"
    assert client.post(LOGOUT, {"refresh": "garbage"}, format="json").status_code == 400


def test_logout_cannot_blacklist_someone_elses_token(auth_client, api_client, user_factory):
    mine, other = user_factory(), user_factory()
    others_pair = auth_tokens.issue_tokens(other)
    response = auth_client(mine).post(LOGOUT, {"refresh": others_pair["refresh"]}, format="json")
    assert response.status_code == 400
    assert refresh(api_client, others_pair["refresh"]).status_code == 200


def test_logout_requires_authentication(api_client, user_factory):
    pair = auth_tokens.issue_tokens(user_factory())
    assert api_client.post(LOGOUT, {"refresh": pair["refresh"]}, format="json").status_code == 401


def test_tc07_a_suspended_users_still_valid_access_token_is_rejected(auth_client, user_factory):
    user = user_factory()
    client = auth_client(user)
    assert client.get(ME).status_code == 200
    User.objects.filter(pk=user.pk).update(status="suspended")
    response = client.get(ME)
    assert response.status_code == 401
    assert response.json() == {"detail": "Account is not active.", "code": "account_inactive"}


@pytest.mark.parametrize("status", ["pending_verification", "pending_approval", "rejected"])
def test_any_non_active_status_blocks_an_existing_token(auth_client, user_factory, status):
    user = user_factory()
    client = auth_client(user)
    User.objects.filter(pk=user.pk).update(status=status)
    assert client.get(ME).json()["code"] == "account_inactive"


def test_a_token_for_a_deleted_user_is_rejected(auth_client, user_factory):
    user = user_factory()
    client = auth_client(user)
    user.delete()
    assert client.get(ME).json()["code"] == "user_not_found"


def test_requests_without_or_with_a_bad_token_are_401(api_client):
    assert api_client.get(ME).status_code == 401
    api_client.credentials(HTTP_AUTHORIZATION="Bearer not.a.token")
    assert api_client.get(ME).status_code == 401


def test_blacklisting_works_exactly_once():
    from apps.Module1_Authentication.auth_tokens import InvalidRefreshToken, blacklist, load_refresh_token

    user = User.objects.create_user("a@example.com", "Str0ng!pass-123", full_name="A", role="candidate", status="active")
    token = load_refresh_token(auth_tokens.issue_tokens(user)["refresh"])
    blacklist(token)
    with pytest.raises(InvalidRefreshToken):
        blacklist(token)


def test_revoke_all_blacklists_every_outstanding_token_once(user_factory):
    user, other = user_factory(), user_factory()
    for _ in range(3):
        auth_tokens.issue_tokens(user)
    auth_tokens.issue_tokens(other)
    auth_tokens.revoke_all_refresh_tokens(user)
    auth_tokens.revoke_all_refresh_tokens(user)
    assert BlacklistedToken.objects.filter(token__user=user).count() == 3
    assert not BlacklistedToken.objects.filter(token__user=other).exists()
    assert OutstandingToken.objects.filter(user=user).count() == 3

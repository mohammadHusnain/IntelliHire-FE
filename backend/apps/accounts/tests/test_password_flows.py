import pytest
from django.core import mail

from apps.accounts import auth_tokens
from apps.common.tests.helpers import link_in

pytestmark = pytest.mark.django_db
FORGOT = "/api/auth/password/forgot/"
RESET = "/api/auth/password/reset/"
CHANGE = "/api/auth/password/change/"
LOGIN = "/api/auth/login/"
REFRESH = "/api/auth/token/refresh/"
OLD, NEW = "Str0ng!pass-123", "Brand-New-Pass-7788"
GENERIC = {"detail": "If that email is registered, a reset link has been sent."}


def request_reset(client, email, capture):
    with capture(execute=True):
        response = client.post(FORGOT, {"email": email}, format="json")
    return response


def reset_args():
    _, query = link_in(mail.outbox[-1])
    return {"uid": query["uid"], "token": query["token"]}


def login(client, email, password):
    return client.post(LOGIN, {"email": email, "password": password}, format="json")


class TestForgot:
    def test_a_verified_account_gets_a_reset_link(self, api_client, user_factory, django_capture_on_commit_callbacks):
        user_factory(email="me@example.com")
        response = request_reset(api_client, "ME@example.com", django_capture_on_commit_callbacks)
        assert response.status_code == 200 and response.json() == GENERIC
        assert len(mail.outbox) == 1 and mail.outbox[0].to == ["me@example.com"]
        url, query = link_in(mail.outbox[0])
        assert url.startswith("http://localhost:5173/reset-password?") and set(query) == {"uid", "token"}

    @pytest.mark.parametrize("email", ["unverified@example.com", "nobody@example.com"])
    def test_other_emails_get_the_same_answer_and_no_mail(self, api_client, user_factory, django_capture_on_commit_callbacks, email):
        user_factory(email="unverified@example.com", email_verified=False)
        response = request_reset(api_client, email, django_capture_on_commit_callbacks)
        assert response.status_code == 200 and response.json() == GENERIC
        assert mail.outbox == []

    def test_is_throttled_to_3_per_hour(self, api_client):
        codes = [api_client.post(FORGOT, {"email": "a@example.com"}, format="json").status_code for _ in range(4)]
        assert codes == [200, 200, 200, 429]


class TestReset:
    def test_tc06_reset_changes_the_password_once_and_logs_out_everywhere(self, api_client, user_factory, django_capture_on_commit_callbacks):
        user = user_factory(email="me@example.com", password=OLD)
        refresh = auth_tokens.issue_tokens(user)["refresh"]
        request_reset(api_client, "me@example.com", django_capture_on_commit_callbacks)
        args = reset_args()

        done = api_client.post(RESET, {**args, "new_password": NEW, "confirm_password": NEW}, format="json")
        assert done.status_code == 200 and done.json() == {"detail": "Password has been reset."}

        assert login(api_client, "me@example.com", OLD).status_code == 401
        assert login(api_client, "me@example.com", NEW).status_code == 200
        assert api_client.post(REFRESH, {"refresh": refresh}, format="json").status_code == 401

        again = api_client.post(RESET, {**args, "new_password": "Another-Pass-5566", "confirm_password": "Another-Pass-5566"}, format="json")
        assert again.status_code == 400
        assert again.json() == {"detail": "Reset link is invalid or has expired.", "code": "invalid_token"}

    def test_invalid_uid_or_token_is_rejected_the_same_way(self, api_client, user_factory, django_capture_on_commit_callbacks):
        user_factory(email="me@example.com")
        request_reset(api_client, "me@example.com", django_capture_on_commit_callbacks)
        args = reset_args()
        for bad in ({**args, "token": "bad-token"}, {**args, "uid": "bm9wZQ"}, {**args, "uid": "!!"}):
            response = api_client.post(RESET, {**bad, "new_password": NEW, "confirm_password": NEW}, format="json")
            assert response.status_code == 400 and response.json()["code"] == "invalid_token"

    def test_a_link_for_one_user_does_not_work_for_another(self, api_client, user_factory, django_capture_on_commit_callbacks):
        user_factory(email="a@example.com")
        other = user_factory(email="b@example.com")
        request_reset(api_client, "a@example.com", django_capture_on_commit_callbacks)
        args = reset_args()
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode

        args["uid"] = urlsafe_base64_encode(force_bytes(other.pk))
        response = api_client.post(RESET, {**args, "new_password": NEW, "confirm_password": NEW}, format="json")
        assert response.status_code == 400

    def test_an_expired_link_is_rejected(self, api_client, user_factory, django_capture_on_commit_callbacks, settings):
        user_factory(email="me@example.com")
        request_reset(api_client, "me@example.com", django_capture_on_commit_callbacks)
        settings.PASSWORD_RESET_TIMEOUT = -1
        response = api_client.post(RESET, {**reset_args(), "new_password": NEW, "confirm_password": NEW}, format="json")
        assert response.status_code == 400

    @pytest.mark.parametrize(
        "new,confirm,field",
        [(NEW, "Different-Pass-1", "confirm_password"), ("short1", "short1", "new_password"), ("12345678901", "12345678901", "new_password")],
    )
    def test_invalid_new_passwords_are_field_errors_and_do_not_burn_the_link(
        self, api_client, user_factory, django_capture_on_commit_callbacks, new, confirm, field
    ):
        user_factory(email="me@example.com", password=OLD)
        request_reset(api_client, "me@example.com", django_capture_on_commit_callbacks)
        args = reset_args()
        response = api_client.post(RESET, {**args, "new_password": new, "confirm_password": confirm}, format="json")
        assert response.status_code == 400 and field in response.json()
        ok = api_client.post(RESET, {**args, "new_password": NEW, "confirm_password": NEW}, format="json")
        assert ok.status_code == 200
        assert login(api_client, "me@example.com", NEW).status_code == 200

    def test_missing_fields_are_reported(self, api_client):
        assert set(api_client.post(RESET, {}, format="json").json()) == {"uid", "token", "new_password", "confirm_password"}


class TestChange:
    def test_changing_the_password_logs_out_everywhere(self, api_client, auth_client, user_factory):
        user = user_factory(email="me@example.com", password=OLD)
        refresh = auth_tokens.issue_tokens(user)["refresh"]
        response = auth_client(user).post(CHANGE, {"old_password": OLD, "new_password": NEW}, format="json")
        assert response.status_code == 200
        assert response.json() == {"detail": "Password changed. Please log in again."}
        assert login(api_client, "me@example.com", OLD).status_code == 401
        assert login(api_client, "me@example.com", NEW).status_code == 200
        assert api_client.post(REFRESH, {"refresh": refresh}, format="json").status_code == 401

    def test_wrong_old_password_is_a_field_error(self, auth_client, user_factory):
        response = auth_client(user_factory(password=OLD)).post(CHANGE, {"old_password": "Wrong-1234567", "new_password": NEW}, format="json")
        assert response.status_code == 400
        assert response.json() == {"old_password": ["Current password is incorrect."]}

    def test_weak_new_password_is_rejected_and_nothing_changes(self, api_client, auth_client, user_factory):
        user = user_factory(email="me@example.com", password=OLD)
        response = auth_client(user).post(CHANGE, {"old_password": OLD, "new_password": "short1"}, format="json")
        assert response.status_code == 400 and "new_password" in response.json()
        assert login(api_client, "me@example.com", OLD).status_code == 200

    def test_requires_authentication(self, api_client):
        assert api_client.post(CHANGE, {"old_password": OLD, "new_password": NEW}, format="json").status_code == 401

    def test_guessing_the_old_password_is_throttled(self, auth_client, user_factory):
        client = auth_client(user_factory(password=OLD))
        codes = [client.post(CHANGE, {"old_password": f"Guess-{i}-1234", "new_password": NEW}, format="json").status_code for i in range(7)]
        assert codes == [400] * 5 + [429] * 2

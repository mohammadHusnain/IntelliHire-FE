import uuid

import pytest
from django.db import IntegrityError, transaction

from apps.Module5_Foundation.models import Notification, NotificationPreference
from apps.Module5_Foundation.notifications import notify, notify_many

pytestmark = pytest.mark.django_db
URL = "/api/notifications/"


class TestNotify:
    def test_creates_a_clean_notification(self, user_factory):
        user = user_factory()
        n = notify(user, "interview_invited", "Interview <b>invited</b>", "Open it\x00 now", "/candidate/applications/1", {"id": 5})
        assert (n.user, n.kind, n.title, n.body, n.link, n.payload) == (user, "interview_invited", "Interview invited", "Open it now", "/candidate/applications/1", {"id": 5})
        assert n.read_at is None

    def test_long_text_is_cut(self, user_factory):
        n = notify(user_factory(), "x_kind", "t" * 300, "b" * 2000)
        assert len(n.title) <= 200 and len(n.body) <= 1000

    def test_secret_payload_keys_are_hidden(self, user_factory):
        n = notify(user_factory(), "x_kind", "t", payload={"token": "abc", "ok": 1})
        assert n.payload == {"token": "[redacted]", "ok": 1}

    @pytest.mark.parametrize("kind", ["", "Bad Kind", "1abc", "a" * 51, "has-dash", None])
    def test_a_bad_kind_is_refused(self, user_factory, kind):
        with pytest.raises(ValueError):
            notify(user_factory(), kind, "t")

    def test_a_title_is_required(self, user_factory):
        with pytest.raises(ValueError):
            notify(user_factory(), "x_kind", "   <b></b> ")

    @pytest.mark.parametrize("link", ["https://evil.example/x", "//evil.example", "evil", "/a b", "/a\\b", "javascript:alert(1)", "/" + "a" * 300])
    def test_only_paths_inside_the_frontend_are_accepted(self, user_factory, link):
        with pytest.raises(ValueError):
            notify(user_factory(), "x_kind", "t", link=link)

    def test_the_database_also_refuses_a_non_local_link(self, user_factory):
        user = user_factory()
        for bad in ("https://evil.example", "//evil.example", "evil"):
            with pytest.raises(IntegrityError), transaction.atomic():
                Notification.objects.create(user=user, kind="x", title="t", link=bad)

    def test_an_empty_link_is_fine(self, user_factory):
        assert notify(user_factory(), "x_kind", "t").link == ""


class TestNotifyMany:
    def test_one_per_distinct_user_in_one_insert(self, user_factory, django_assert_max_num_queries):
        users = [user_factory() for _ in range(3)]
        with django_assert_max_num_queries(4):
            assert notify_many(users + [users[0], users[1].pk, None], "digest_ready", "Hello") == 3
        assert Notification.objects.count() == 3

    def test_repeated_users_are_written_once_and_an_empty_list_is_fine(self, user_factory):
        user = user_factory()
        assert notify_many([user.pk] * 5, "x_kind", "t") == 1
        assert notify_many([], "x_kind", "t") == 0

    def test_invalid_input_is_refused_before_anything_is_written(self, user_factory):
        with pytest.raises(ValueError):
            notify_many([user_factory()], "BAD", "t")
        assert Notification.objects.count() == 0


@pytest.fixture
def me(user_factory, auth_client):
    user = user_factory()
    return user, auth_client(user)


class TestApi:
    def test_lists_only_my_notifications_newest_first(self, me, user_factory):
        user, client = me
        first = notify(user, "a_kind", "First")
        second = notify(user, "a_kind", "Second")
        notify(user_factory(), "a_kind", "Someone else's")
        body = client.get(URL).json()
        assert [row["title"] for row in body["results"]] == ["Second", "First"]
        assert body["count"] == 2 and {first.pk, second.pk} == {uuid.UUID(r["id"]) for r in body["results"]}

    def test_the_shape_of_a_row(self, me):
        user, client = me
        notify(user, "a_kind", "T", "B", "/x", {"a": 1})
        row = client.get(URL).json()["results"][0]
        assert set(row) == {"id", "kind", "title", "body", "link", "payload", "read", "read_at", "created_at"}
        assert row["read"] is False and row["read_at"] is None

    def test_unread_filter(self, me):
        user, client = me
        read = notify(user, "a_kind", "Read")
        notify(user, "a_kind", "Unread")
        assert client.post(f"{URL}{read.pk}/read/").status_code == 200
        assert [r["title"] for r in client.get(URL, {"unread": "true"}).json()["results"]] == ["Unread"]
        assert [r["title"] for r in client.get(URL, {"unread": "false"}).json()["results"]] == ["Read"]
        assert client.get(URL, {"unread": ""}).json()["count"] == 2

    def test_a_bad_unread_value_is_a_400(self, me):
        response = me[1].get(URL, {"unread": "maybe"})
        assert response.status_code == 400 and response.json()["code"] == "invalid_filter"

    def test_paging(self, me):
        user, client = me
        for i in range(25):
            notify(user, "a_kind", f"n{i}")
        assert len(client.get(URL).json()["results"]) == 20
        assert len(client.get(URL, {"page": 2}).json()["results"]) == 5

    def test_unread_count(self, me, user_factory):
        user, client = me
        notify(user, "a_kind", "a")
        notify(user, "a_kind", "b")
        notify(user_factory(), "a_kind", "other")
        assert client.get(f"{URL}unread-count/").json() == {"count": 2}

    def test_marking_read_is_safe_to_repeat_and_keeps_the_first_time(self, me):
        user, client = me
        n = notify(user, "a_kind", "t")
        first = client.post(f"{URL}{n.pk}/read/").json()
        second = client.post(f"{URL}{n.pk}/read/").json()
        assert first["read"] is True and first["read_at"] == second["read_at"]

    def test_someone_elses_or_unknown_notification_is_404(self, me, user_factory):
        user, client = me
        other = notify(user_factory(), "a_kind", "t")
        assert client.post(f"{URL}{other.pk}/read/").status_code == 404
        assert client.post(f"{URL}{uuid.uuid4()}/read/").status_code == 404
        other.refresh_from_db()
        assert other.read_at is None

    def test_read_all_only_touches_my_unread(self, me, user_factory):
        user, client = me
        notify(user, "a_kind", "a")
        notify(user, "a_kind", "b")
        other = notify(user_factory(), "a_kind", "c")
        assert client.post(f"{URL}read-all/").json() == {"count": 2}
        assert client.post(f"{URL}read-all/").json() == {"count": 0}
        other.refresh_from_db()
        assert other.read_at is None

    def test_every_kind_of_account_can_use_it(self, user_factory, member_factory, auth_client):
        from apps.common.choices import UserRole

        for user in (user_factory(), member_factory(), user_factory(role=UserRole.PLATFORM_ADMIN)):
            notify(user, "a_kind", "hello")
            assert auth_client(user).get(URL).json()["count"] == 1

    def test_a_suspended_account_is_locked_out(self, me):
        user, client = me
        user.status = "suspended"
        user.save(update_fields=["status"])
        assert client.get(URL).status_code == 401

    def test_anonymous_callers_get_401(self, api_client):
        assert api_client.get(URL).status_code == 401


class TestPreferencesApi:
    url = f"{URL}preferences/"

    def test_candidate_defaults_match_the_supported_settings(self, me):
        response = me[1].get(self.url)
        assert response.status_code == 200
        assert response.json() == {"email_communities": False, "in_app_reminders": True, "in_app_communities": True}

    def test_candidate_can_update_only_candidate_preferences(self, me):
        response = me[1].patch(self.url, {"email_communities": True, "in_app_reminders": False}, format="json")
        assert response.status_code == 200
        assert response.json() == {"email_communities": True, "in_app_reminders": False, "in_app_communities": True}
        assert NotificationPreference.objects.get(user=me[0]).email_communities is True

    def test_wrong_role_fields_are_rejected_without_partial_update(self, me):
        response = me[1].patch(self.url, {"in_app_communities": False, "notify_applicants": False}, format="json")
        assert response.status_code == 400 and "notify_applicants" in response.json()
        assert NotificationPreference.objects.get(user=me[0]).in_app_communities is True

    def test_company_defaults_and_updates_are_scoped_to_the_company_user(self, member_factory, auth_client):
        from apps.common.choices import MemberRole

        user = member_factory(MemberRole.ADMIN)
        client = auth_client(user)
        assert client.get(self.url).json() == {"notify_applicants": True}
        assert client.patch(self.url, {"notify_applicants": False}, format="json").json() == {"notify_applicants": False}
        assert client.patch(self.url, {"email_communities": True}, format="json").status_code == 400

    def test_preferences_are_private_and_platform_admins_cannot_access_them(self, me, user_factory, auth_client):
        from apps.common.choices import UserRole

        other = user_factory()
        client = auth_client(other)
        assert client.get(self.url).json() == {"email_communities": False, "in_app_reminders": True, "in_app_communities": True}
        admin = auth_client(user_factory(role=UserRole.PLATFORM_ADMIN))
        assert admin.get(self.url).status_code == 403

    def test_anonymous_callers_get_401(self, api_client):
        assert api_client.get(self.url).status_code == 401

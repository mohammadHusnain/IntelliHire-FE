import pytest

from apps.Module1_Authentication.models import User
from apps.common.choices import CompanyStatus, MemberRole

pytestmark = pytest.mark.django_db
URL = "/api/platform-admin/users/"


@pytest.fixture
def admin(user_factory):
    return user_factory(role=User.Role.PLATFORM_ADMIN, email="boss@intellihire.example", full_name="Boss Admin")


@pytest.fixture
def people(user_factory, member_factory):
    ana = user_factory(email="ana@example.com", full_name="Ana Zaidi")
    bilal = user_factory(email="bilal@example.com", full_name="Bilal Ahmed", status="pending_verification", email_verified=False)
    carol = user_factory(email="carol@example.com", full_name="Carol D'Souza", status="suspended")
    owner = member_factory(MemberRole.ADMIN, company_status=CompanyStatus.APPROVED, email="owner@acme.example", full_name="Olivia Owner")
    owner.company_membership.company.name = "Acme Rockets"
    owner.company_membership.company.save()
    return {"ana": ana, "bilal": bilal, "carol": carol, "owner": owner}


def db_emails(**filters):
    return set(User.objects.filter(**filters).values_list("email", flat=True))


def emails(response):
    return [row["email"] for row in response.json()["results"]]


class TestAccess:
    def test_anonymous_is_401(self, api_client):
        assert api_client.get(URL).status_code == 401

    def test_other_roles_are_403(self, auth_client, user_factory, member_factory):
        for user in (user_factory(), member_factory(MemberRole.ADMIN), member_factory(MemberRole.RECRUITER)):
            response = auth_client(user).get(URL)
            assert response.status_code == 403 and response.json()["detail"] == "Unauthorized access."

    def test_only_get_is_allowed(self, auth_client, admin):
        client = auth_client(admin)
        assert client.post(URL, {}, format="json").status_code == 405 and client.delete(URL).status_code == 405


class TestList:
    def test_lists_every_account_newest_first(self, auth_client, admin, people):
        response = auth_client(admin).get(URL)
        assert response.status_code == 200 and response.json()["count"] == User.objects.count() == 6
        assert set(emails(response)) == db_emails() and "boss@intellihire.example" in emails(response)
        stamps = [row["date_joined"] for row in response.json()["results"]]
        assert stamps == sorted(stamps, reverse=True)

    def test_row_shape_and_no_credentials(self, auth_client, admin, people):
        rows = {row["email"]: row for row in auth_client(admin).get(URL).json()["results"]}
        assert set(rows["ana@example.com"]) == {"id", "email", "full_name", "role", "status", "email_verified", "date_joined", "last_login", "company"}
        assert rows["ana@example.com"]["company"] is None and rows["ana@example.com"]["last_login"] is None
        company = rows["owner@acme.example"]["company"]
        assert company["name"] == "Acme Rockets" and company["member_role"] == "admin" and company["status"] == "approved"
        text = str(rows)
        assert "password" not in text and "pbkdf2" not in text

    @pytest.mark.parametrize(
        "query,expected",
        [
            ({"role": ["candidate"]}, {"ana@example.com", "bilal@example.com", "carol@example.com"}),
            ({"role": ["company_admin", "platform_admin"]}, "ADMINS"),
            ({"status": ["suspended"]}, {"carol@example.com"}),
            ({"status": ["pending_verification", "suspended"]}, {"bilal@example.com", "carol@example.com"}),
            ({"role": ["candidate"], "status": ["active"]}, {"ana@example.com"}),
            ({"search": "zaidi"}, {"ana@example.com"}),
            ({"search": "BILAL@EXAMPLE"}, {"bilal@example.com"}),
            ({"search": "rockets"}, {"owner@acme.example"}),
            ({"search": "   "}, "ALL"),
            ({"search": "nobody-like-this"}, set()),
        ],
    )
    def test_filters_and_search(self, auth_client, admin, people, query, expected):
        if expected == "ADMINS":
            expected = db_emails(role__in=["company_admin", "platform_admin"])
        elif expected == "ALL":
            expected = db_emails()
        assert set(emails(auth_client(admin).get(URL, query))) == expected

    @pytest.mark.parametrize("query", [{"role": "wizard"}, {"status": "gone"}])
    def test_bad_filter_values_are_400(self, auth_client, admin, query):
        assert auth_client(admin).get(URL, query).status_code == 400

    def test_ordering(self, auth_client, admin, people):
        client = auth_client(admin)
        assert emails(client.get(URL, {"ordering": "full_name", "role": "candidate"})) == ["ana@example.com", "bilal@example.com", "carol@example.com"]
        assert emails(client.get(URL, {"ordering": "-email", "role": "candidate"}))[0] == "carol@example.com"
        assert client.get(URL, {"ordering": "nonsense"}).status_code == 200

    def test_pagination(self, auth_client, admin, people):
        body = auth_client(admin).get(URL, {"page_size": 2}).json()
        assert body["count"] == 6 and len(body["results"]) == 2 and body["next"]

    def test_status_counts_follow_role_and_search_but_not_status(self, auth_client, admin, people):
        client = auth_client(admin)
        everything = client.get(URL).json()["status_counts"]
        assert everything == {"pending_verification": 1, "pending_approval": 0, "active": 4, "rejected": 0, "suspended": 1, "total": 6}
        candidates = client.get(URL, {"role": ["candidate"], "status": ["suspended"]}).json()
        assert candidates["count"] == 1 and candidates["status_counts"]["total"] == 3 and candidates["status_counts"]["active"] == 1
        assert client.get(URL, {"search": "rockets"}).json()["status_counts"]["total"] == 1

    def test_suspension_is_reflected(self, auth_client, admin, people):
        client = auth_client(admin)
        client.post(f"{URL}{people['ana'].pk}/suspend/")
        rows = {row["email"]: row for row in client.get(URL).json()["results"]}
        assert rows["ana@example.com"]["status"] == "suspended"
        client.post(f"{URL}{people['ana'].pk}/reactivate/")
        assert {row["email"]: row for row in client.get(URL).json()["results"]}["ana@example.com"]["status"] == "active"

    def test_the_number_of_queries_does_not_grow_with_the_users(self, auth_client, admin, user_factory, member_factory):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        client = auth_client(admin)
        member_factory(MemberRole.ADMIN)
        with CaptureQueriesContext(connection) as small:
            client.get(URL)
        for _ in range(10):
            member_factory(MemberRole.RECRUITER)
            user_factory()
        with CaptureQueriesContext(connection) as large:
            client.get(URL)
        assert len(large) == len(small)

    def test_a_suspended_admin_token_is_refused(self, auth_client, admin, user_factory):
        client = auth_client(admin)
        admin.status = "suspended"
        admin.save()
        assert client.get(URL).status_code == 401

"""Security sweeps over EVERY operation in the OpenAPI schema.

An operation that is not classified below fails the suite, so a new endpoint cannot be added without
deciding who may call it. Then each class is checked for: anonymous access, the wrong role, and (for the
company side) another company's data.
"""
import re

import pytest
from drf_spectacular.generators import SchemaGenerator

from apps.common.choices import MemberRole, UserRole
from apps.Module3_JobPosting.tests.helpers import future
from apps.Module4_ApplicationManagement.models import Application

pytestmark = pytest.mark.django_db
METHODS = {"get", "post", "put", "patch", "delete"}

PUBLIC = {
    ("POST", "/api/auth/login/"), ("POST", "/api/auth/token/refresh/"), ("POST", "/api/auth/register/candidate/"),
    ("POST", "/api/auth/register/company/"), ("POST", "/api/auth/register/company/resubmit/"),
    ("POST", "/api/auth/verify-email/"), ("POST", "/api/auth/resend-verification/"),
    ("POST", "/api/auth/password/forgot/"), ("POST", "/api/auth/password/reset/"),
    ("GET", "/api/public/invitations/{token}/"), ("POST", "/api/public/invitations/{token}/accept/"),
    ("GET", "/api/public/jobs/{form_slug}/"), ("POST", "/api/public/jobs/{form_slug}/apply/"),
    ("GET", "/api/public/interviews/{token}/"), ("POST", "/api/public/interviews/{token}/start/"),
    ("POST", "/api/public/interviews/{token}/answer/"), ("POST", "/api/public/interviews/{token}/finish/"),
    ("GET", "/api/public/track/{token}/"), ("POST", "/api/public/track/{token}/invitation/link/"), ("POST", "/api/public/track/request-link/"),
}
ANY_LOGGED_IN = {
    ("POST", "/api/auth/logout/"), ("GET", "/api/auth/me/"), ("PATCH", "/api/auth/me/"), ("POST", "/api/auth/password/change/"),
    ("GET", "/api/notifications/"), ("GET", "/api/notifications/unread-count/"), ("POST", "/api/notifications/read-all/"),
    ("POST", "/api/notifications/{notification_id}/read/"),
}


def _operations():
    schema = SchemaGenerator().get_schema(request=None, public=True)
    return sorted((method.upper(), path) for path, item in schema["paths"].items() for method in item if method in METHODS)


OPERATIONS = _operations()


def kind(operation):
    method, path = operation
    if operation in PUBLIC:
        return "public"
    if operation in ANY_LOGGED_IN:
        return "any"
    if path.startswith(("/api/auth/profile/", "/api/candidate/")):
        return "candidate"
    if path.startswith("/api/platform-admin/"):
        return "platform"
    if path.startswith(("/api/company/", "/api/jobs/", "/api/applications/", "/api/interviews/")):
        return "company"
    return "unclassified"


def ops_of(*kinds):
    return [op for op in OPERATIONS if kind(op) in kinds]


def fill(path, values=None):
    values = values or {}

    def replace(match):
        name = match.group(1)
        if name in values:
            return str(values[name])
        return "1" if name in ("field_id", "member_id", "id") else "x" if name in ("token", "form_slug", "field_key") else "00000000-0000-0000-0000-000000000000"

    return re.sub(r"\{(\w+)\}", replace, path)


def call(client, operation, values=None, body=None):
    method, path = operation
    return getattr(client, method.lower())(fill(path, values), body if body is not None else {}, format="json")


def test_every_operation_is_classified():
    assert len(OPERATIONS) == 112
    assert [op for op in OPERATIONS if kind(op) == "unclassified"] == []
    assert PUBLIC <= set(OPERATIONS) and ANY_LOGGED_IN <= set(OPERATIONS)


@pytest.mark.parametrize("operation", [op for op in OPERATIONS if kind(op) not in ("public",)], ids=lambda op: f"{op[0]} {op[1]}")
def test_anonymous_callers_get_401_on_every_protected_operation(api_client, operation):
    assert call(api_client, operation).status_code == 401


@pytest.mark.parametrize("operation", ops_of("public"), ids=lambda op: f"{op[0]} {op[1]}")
def test_public_operations_ignore_a_garbage_token(api_client, operation):
    """A stale or broken token must never turn a public endpoint into a 401."""
    api_client.credentials(HTTP_AUTHORIZATION="Bearer garbage")
    assert call(api_client, operation).status_code != 401


ROLE_EXPECTATIONS = [
    ("candidate", ("company", "platform")),
    ("viewer", ("platform", "candidate")),
    ("recruiter", ("platform", "candidate")),
    ("hr_manager", ("platform", "candidate")),
    ("company_admin", ("platform", "candidate")),
    ("platform_admin", ("company", "candidate")),
]


@pytest.fixture
def people(user_factory, member_factory, auth_client):
    admin = member_factory(MemberRole.ADMIN)
    company = admin.company_membership.company
    return {
        "candidate": auth_client(user_factory()),
        "viewer": auth_client(member_factory(MemberRole.VIEWER, company=company)),
        "recruiter": auth_client(member_factory(MemberRole.RECRUITER, company=company)),
        "hr_manager": auth_client(member_factory(MemberRole.HR_MANAGER, company=company)),
        "company_admin": auth_client(admin),
        "platform_admin": auth_client(user_factory(role=UserRole.PLATFORM_ADMIN)),
    }


@pytest.mark.parametrize("role,forbidden", ROLE_EXPECTATIONS, ids=[r for r, _ in ROLE_EXPECTATIONS])
def test_the_wrong_role_gets_403_with_the_standard_message(people, role, forbidden):
    operations = ops_of(*forbidden)
    assert operations
    for operation in operations:
        response = call(people[role], operation)
        assert response.status_code == 403, (role, operation, response.status_code)
        assert response.json()["detail"] == "Unauthorized access."


class TestAnotherCompanysDataIs404:
    """Company B asks for Company A's objects on every company-side operation that takes an id (Doc: isolation rule)."""

    @pytest.fixture
    def world(self, team, job_factory, apply, clients, member_factory, auth_client):
        company, users = team
        job = job_factory(
            company, users[MemberRole.ADMIN], status="open",
            fields=[{"label": "Notes", "key": "notes", "field_type": "file"}],
        )
        assert apply(job).status_code == 201
        application = Application.objects.get(job=job)
        invitation = clients[MemberRole.ADMIN].post(
            "/api/company/invitations/", {"email": "pending@example.com", "full_name": "Pending", "role": "viewer"}, format="json"
        ).json()
        outsider = member_factory(MemberRole.ADMIN)
        values = {
            "job_id": job.pk, "field_id": job.custom_fields.get().pk, "application_id": application.pk,
            "invitation_id": invitation["id"], "member_id": users[MemberRole.VIEWER].company_membership.pk, "field_key": "notes",
        }
        return {"client": auth_client(outsider), "values": values, "job": job, "company": company}

    BODIES = {
        ("PATCH", "/api/jobs/{job_id}/"): {"title": "Hacked"},
        ("POST", "/api/applications/{application_id}/notes/"): {"text": "Hacked note"},
        ("POST", "/api/jobs/{job_id}/reopen/"): {"deadline": future(5).isoformat()},
        ("POST", "/api/jobs/{job_id}/fields/"): {"label": "Evil", "field_type": "url"},
        ("POST", "/api/jobs/{job_id}/fields/reorder/"): {"field_ids": []},
        ("PATCH", "/api/jobs/{job_id}/fields/{field_id}/"): {"label": "Hacked"},
        ("PATCH", "/api/applications/{application_id}/status/"): {"status": "rejected"},
        ("PATCH", "/api/company/members/{member_id}/"): {"job_title": "Hacked"},
        ("PUT", "/api/jobs/{job_id}/screening-config/"): {"shortlist_threshold": 1},
        ("POST", "/api/jobs/{job_id}/shortlist/apply-threshold/"): {"threshold": 0},
        ("POST", "/api/jobs/{job_id}/cv-screening/run/"): {"mode": "full"},
    }

    COMPANY_OPS_WITH_IDS = [op for op in ops_of("company") if "{" in op[1]]

    def test_the_sweep_really_covers_the_id_operations(self):
        assert len(self.COMPANY_OPS_WITH_IDS) == 49

    @pytest.mark.parametrize("operation", COMPANY_OPS_WITH_IDS, ids=lambda op: f"{op[0]} {op[1]}")
    def test_every_id_operation_is_404_for_another_company(self, world, operation):
        response = call(world["client"], operation, world["values"], self.BODIES.get(operation))
        assert response.status_code == 404, (operation, response.status_code, response.content)

    def test_nothing_of_company_a_leaks_into_company_bs_lists(self, world):
        text = ""
        for url in ("/api/jobs/", "/api/applications/", "/api/company/dashboard/", "/api/company/members/", "/api/company/invitations/", "/api/company/profile/"):
            response = world["client"].get(url)
            assert response.status_code == 200, url
            text += response.content.decode()
        for secret in (str(world["job"].pk), str(world["company"].pk), world["company"].name, "pending@example.com", "Sara Malik", "sara.malik@example.com"):
            assert secret not in text, secret

    def test_nothing_changed_after_every_attempt(self, world):
        for operation in self.COMPANY_OPS_WITH_IDS:
            call(world["client"], operation, world["values"], self.BODIES.get(operation))
        job = world["job"]
        job.refresh_from_db()
        assert (job.title, job.status, job.custom_fields.count()) == (job.title, "open", 1) and job.title != "Hacked"
        assert Application.objects.get(job=job).status == "submitted"

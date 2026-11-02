"""Company B must never see or change Company A's data (Doc §2.6, §9 isolation rule)."""
import pytest

from apps.common.choices import CompanyStatus, MemberRole
from apps.Module2_CompanyManagement.models import StaffInvitation

pytestmark = pytest.mark.django_db


@pytest.fixture
def two_companies(member_factory, auth_client):
    a_admin = member_factory(MemberRole.ADMIN)
    b_admin = member_factory(MemberRole.ADMIN)
    a_member = member_factory(MemberRole.RECRUITER, company=a_admin.company_membership.company)
    return a_admin, a_member, b_admin, auth_client(a_admin), auth_client(b_admin)


def test_profile_and_dashboard_show_only_own_company(two_companies):
    a_admin, _, b_admin, a, b = two_companies
    a.patch("/api/company/profile/", {"headquarters": "Lahore"}, format="json")
    assert a.get("/api/company/profile/").json()["name"] == a_admin.company_membership.company.name
    assert b.get("/api/company/profile/").json()["name"] == b_admin.company_membership.company.name
    assert b.get("/api/company/profile/").json()["headquarters"] == ""
    assert a.get("/api/company/dashboard/").json()["team"]["active_members"] == 2
    assert b.get("/api/company/dashboard/").json()["team"]["active_members"] == 1


def test_member_list_never_leaks_across_companies(two_companies):
    a_admin, a_member, b_admin, a, b = two_companies
    assert {m["email"] for m in a.get("/api/company/members/").json()} == {a_admin.email, a_member.email}
    assert [m["email"] for m in b.get("/api/company/members/").json()] == [b_admin.email]


def test_member_update_across_companies_is_404(two_companies):
    _, a_member, _, a, b = two_companies
    url = f"/api/company/members/{a_member.company_membership.pk}/"
    assert b.patch(url, {"is_active": False}, format="json").status_code == 404
    assert b.patch(url, {"role": "admin"}, format="json").status_code == 404
    a_member.company_membership.refresh_from_db()
    assert a_member.company_membership.is_active and a_member.company_membership.role == "recruiter"


def test_invitations_are_company_scoped(two_companies):
    _, _, _, a, b = two_companies
    created = a.post("/api/company/invitations/", {"email": "x@example.com", "full_name": "X", "role": "viewer"}, format="json").json()
    assert b.get("/api/company/invitations/").json() == []
    for action in ("resend", "revoke"):
        assert b.post(f"/api/company/invitations/{created['id']}/{action}/").status_code == 404
    assert StaffInvitation.objects.get().status == "pending"


def test_status_gate_is_per_company(two_companies):
    """Suspending A must not affect B."""
    a_admin, _, b_admin, a, b = two_companies
    company = a_admin.company_membership.company
    company.status, company.suspension_reason = CompanyStatus.SUSPENDED, "Policy violation under review."
    company.save()
    assert a.get("/api/company/profile/").status_code == 403
    assert b.get("/api/company/profile/").status_code == 200


def test_not_found_and_forbidden_are_indistinguishable_for_ids_owned_by_others(two_companies):
    _, a_member, _, _, b = two_companies
    foreign = b.patch(f"/api/company/members/{a_member.company_membership.pk}/", {"job_title": "x"}, format="json")
    missing = b.patch("/api/company/members/99999999/", {"job_title": "x"}, format="json")
    assert foreign.status_code == missing.status_code == 404
    assert foreign.json() == missing.json()

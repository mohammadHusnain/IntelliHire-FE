from datetime import timedelta

import pytest
from django.utils import timezone

from apps.common.choices import CompanyStatus, MemberRole
from apps.Module2_CompanyManagement.models import StaffInvitation

pytestmark = pytest.mark.django_db
URL = "/api/company/dashboard/"
PIPELINE = ["submitted", "under_review", "shortlisted", "interview", "selected", "rejected", "on_hold"]


def test_requires_company_user(api_client, auth_client, user_factory, platform_admin):
    assert api_client.get(URL).status_code == 401
    assert auth_client(user_factory()).get(URL).status_code == 403
    assert auth_client(platform_admin).get(URL).status_code == 403


@pytest.mark.parametrize("role", MemberRole.values)
def test_every_member_role_can_view(member_factory, auth_client, role):
    assert auth_client(member_factory(role)).get(URL).status_code == 200


def test_shape_for_a_fresh_company_has_zeros_everywhere(company_with_admin, auth_client):
    _, admin = company_with_admin
    body = auth_client(admin).get(URL).json()
    assert set(body) == {"company", "jobs", "applicants", "pipeline", "closing_soon", "recent_applications", "team"}
    assert body["jobs"] == {"open": 0, "draft": 0, "closed": 0}
    assert body["applicants"] == {"total": 0, "new_last_7_days": 0}
    assert body["pipeline"] == {status: 0 for status in PIPELINE}
    assert body["closing_soon"] == [] and body["recent_applications"] == []
    assert body["team"] == {"active_members": 1, "pending_invitations": 0}
    assert body["company"] == {"name": body["company"]["name"], "logo": None, "status": "approved", "profile_completion": 0}


def test_team_block_counts_active_members_and_live_pending_invitations(company_with_admin, member_factory, auth_client):
    company, admin = company_with_admin
    inactive = member_factory(MemberRole.VIEWER, company=company)
    member_factory(MemberRole.RECRUITER, company=company)
    membership = inactive.company_membership
    membership.is_active = False
    membership.save()
    client = auth_client(admin)
    for index in range(3):
        client.post("/api/company/invitations/", {"email": f"p{index}@example.com", "full_name": "P", "role": "viewer"}, format="json")
    StaffInvitation.objects.filter(email="p0@example.com").update(expires_at=timezone.now() - timedelta(minutes=1))
    StaffInvitation.objects.filter(email="p1@example.com").update(status="revoked")
    assert client.get(URL).json()["team"] == {"active_members": 2, "pending_invitations": 1}


def test_company_block_tracks_profile_completion(company_with_admin, auth_client):
    _, admin = company_with_admin
    client = auth_client(admin)
    client.patch("/api/company/profile/", {"website": "https://a.example", "description": "x"}, format="json")
    assert client.get(URL).json()["company"]["profile_completion"] == 40


def test_isolated_per_company(company_with_admin, member_factory, auth_client):
    company, admin = company_with_admin
    other = member_factory(MemberRole.ADMIN)
    member_factory(MemberRole.VIEWER, company=other.company_membership.company)
    assert auth_client(admin).get(URL).json()["team"]["active_members"] == 1
    assert auth_client(other).get(URL).json()["team"]["active_members"] == 2


@pytest.mark.parametrize("status", [CompanyStatus.PENDING, CompanyStatus.REJECTED, CompanyStatus.SUSPENDED])
def test_unapproved_company_gets_403(member_factory, auth_client, status):
    assert auth_client(member_factory(MemberRole.ADMIN, company_status=status)).get(URL).status_code == 403

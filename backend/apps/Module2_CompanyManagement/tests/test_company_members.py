import pytest

from apps.Module1_Authentication import auth_tokens
from apps.common.choices import CompanyStatus, MemberRole, UserRole
from apps.Module2_CompanyManagement.models import CompanyMember

pytestmark = pytest.mark.django_db
LIST = "/api/company/members/"
REFRESH = "/api/auth/token/refresh/"


def detail(member):
    pk = member.pk if isinstance(member, CompanyMember) else member.company_membership.pk
    return f"{LIST}{pk}/"


@pytest.fixture
def team(member_factory):
    admin = member_factory(MemberRole.ADMIN)
    company = admin.company_membership.company
    others = {role: member_factory(role, company=company) for role in (MemberRole.HR_MANAGER, MemberRole.RECRUITER, MemberRole.VIEWER)}
    return company, admin, others


class TestList:
    def test_anonymous_and_outsiders(self, api_client, auth_client, user_factory, platform_admin):
        assert api_client.get(LIST).status_code == 401
        assert auth_client(user_factory()).get(LIST).status_code == 403
        assert auth_client(platform_admin).get(LIST).status_code == 403

    @pytest.mark.parametrize("role", MemberRole.values)
    def test_every_member_role_can_list(self, team, auth_client, member_factory, role):
        company, *_ = team
        viewer = member_factory(role, company=company)
        response = auth_client(viewer).get(LIST)
        assert response.status_code == 200 and len(response.json()) == 5

    def test_rows_expose_expected_fields_only(self, team, auth_client):
        _, admin, _ = team
        row = auth_client(admin).get(LIST).json()[0]
        assert set(row) == {"id", "full_name", "email", "role", "job_title", "joined_at", "is_active", "last_login"}
        assert row["email"] == admin.email and row["role"] == "admin" and row["is_active"] is True

    def test_includes_inactive_members(self, team, auth_client):
        _, admin, others = team
        client = auth_client(admin)
        client.patch(detail(others[MemberRole.VIEWER]), {"is_active": False}, format="json")
        rows = client.get(LIST).json()
        assert len(rows) == 4 and [r["is_active"] for r in rows].count(False) == 1

    def test_only_own_company_members(self, team, auth_client, member_factory):
        _, admin, _ = team
        member_factory(MemberRole.ADMIN)  # another company
        assert {r["email"] for r in auth_client(admin).get(LIST).json()} == set(
            CompanyMember.objects.filter(company=admin.company_membership.company).values_list("user__email", flat=True)
        )


class TestUpdatePermissions:
    @pytest.mark.parametrize("role", [MemberRole.HR_MANAGER, MemberRole.RECRUITER, MemberRole.VIEWER])
    def test_non_admins_cannot_edit(self, team, auth_client, role):
        _, admin, others = team
        response = auth_client(others[role]).patch(detail(admin), {"job_title": "x"}, format="json")
        assert response.status_code == 403 and response.json()["detail"] == "Unauthorized access."

    def test_anonymous_cannot_edit(self, team, api_client):
        _, admin, _ = team
        assert api_client.patch(detail(admin), {}, format="json").status_code == 401

    def test_only_patch_is_supported(self, team, auth_client):
        _, admin, others = team
        client = auth_client(admin)
        target = detail(others[MemberRole.VIEWER])
        assert client.put(target, {}, format="json").status_code == 405
        assert client.delete(target).status_code == 405
        assert client.get(target).status_code == 405


class TestUpdate:
    def test_change_role_syncs_user_role(self, team, auth_client):
        _, admin, others = team
        target = others[MemberRole.VIEWER]
        response = auth_client(admin).patch(detail(target), {"role": "admin"}, format="json")
        assert response.status_code == 200 and response.json()["role"] == "admin"
        target.refresh_from_db()
        assert target.role == UserRole.COMPANY_ADMIN
        response = auth_client(admin).patch(detail(target), {"role": "recruiter"}, format="json")
        target.refresh_from_db()
        assert response.status_code == 200 and target.role == UserRole.HR

    def test_job_title_only(self, team, auth_client):
        _, admin, others = team
        response = auth_client(admin).patch(detail(others[MemberRole.RECRUITER]), {"job_title": "Talent Lead"}, format="json")
        assert response.json()["job_title"] == "Talent Lead"
        assert response.json()["role"] == "recruiter"

    def test_empty_body_is_a_noop(self, team, auth_client):
        _, admin, others = team
        response = auth_client(admin).patch(detail(others[MemberRole.RECRUITER]), {}, format="json")
        assert response.status_code == 200 and response.json()["role"] == "recruiter"

    @pytest.mark.parametrize("payload", [{"role": "owner"}, {"is_active": "maybe"}, {"job_title": "x" * 101}])
    def test_invalid_payloads(self, team, auth_client, payload):
        _, admin, others = team
        assert auth_client(admin).patch(detail(others[MemberRole.VIEWER]), payload, format="json").status_code == 400

    def test_deactivate_revokes_tokens_and_blocks_access(self, team, auth_client, api_client):
        _, admin, others = team
        target = others[MemberRole.RECRUITER]
        tokens = auth_tokens.issue_tokens(target)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        assert api_client.get("/api/company/profile/").status_code == 200
        auth_client(admin).patch(detail(target), {"is_active": False}, format="json")
        assert api_client.get("/api/company/profile/").status_code == 403
        api_client.credentials()
        assert api_client.post(REFRESH, {"refresh": tokens["refresh"]}, format="json").status_code == 401

    def test_reactivate_restores_access(self, team, auth_client):
        _, admin, others = team
        target = others[MemberRole.RECRUITER]
        client = auth_client(admin)
        client.patch(detail(target), {"is_active": False}, format="json")
        assert client.patch(detail(target), {"is_active": True}, format="json").status_code == 200
        assert auth_client(target).get("/api/company/profile/").status_code == 200

    def test_unknown_member_is_404(self, team, auth_client):
        _, admin, _ = team
        assert auth_client(admin).patch(f"{LIST}999999/", {"job_title": "x"}, format="json").status_code == 404


class TestGuardRails:
    def test_admin_cannot_change_own_role_or_deactivate_self(self, team, auth_client):
        _, admin, _ = team
        client = auth_client(admin)
        for payload in ({"role": "viewer"}, {"is_active": False}):
            response = client.patch(detail(admin), payload, format="json")
            assert response.status_code == 400 and response.json()["code"] == "cannot_modify_self"

    def test_admin_can_edit_own_job_title(self, team, auth_client):
        _, admin, _ = team
        response = auth_client(admin).patch(detail(admin), {"job_title": "CEO", "role": "admin"}, format="json")
        assert response.status_code == 200 and response.json()["job_title"] == "CEO"

    def test_demoting_another_admin_is_allowed_while_one_admin_remains(self, member_factory, auth_client):
        sole = member_factory(MemberRole.ADMIN)
        company = sole.company_membership.company
        other_admin = member_factory(MemberRole.ADMIN, company=company)
        assert auth_client(sole).patch(detail(other_admin), {"role": "viewer"}, format="json").status_code == 200
        assert CompanyMember.objects.filter(company=company, role="admin", is_active=True).count() == 1

    def test_service_refuses_to_remove_the_last_active_admin(self, team):
        """Unreachable through the API (the actor is always an active admin), so guarded at service level."""
        from apps.common.errors import ApiError
        from apps.Module2_CompanyManagement.services.members import update_member

        company, admin, others = team
        outsider_actor = others[MemberRole.VIEWER].company_membership
        for payload in ({"is_active": False}, {"role": MemberRole.VIEWER}):
            with pytest.raises(ApiError) as caught:
                update_member(actor_membership=outsider_actor, member_id=admin.company_membership.pk, **payload)
            assert caught.value.detail.code == "last_admin"
        admin.company_membership.refresh_from_db()
        assert admin.company_membership.is_active and admin.company_membership.role == "admin"

    def test_two_admins_cannot_both_end_up_deactivated(self, member_factory, auth_client):
        a = member_factory(MemberRole.ADMIN)
        company = a.company_membership.company
        b = member_factory(MemberRole.ADMIN, company=company)
        assert auth_client(a).patch(detail(b), {"is_active": False}, format="json").status_code == 200
        # b is now inactive and locked out; a is the last admin and cannot touch itself
        assert auth_client(b).patch(detail(a), {"is_active": False}, format="json").status_code == 403
        assert auth_client(a).patch(detail(a), {"is_active": False}, format="json").status_code == 400
        assert CompanyMember.objects.filter(company=company, role="admin", is_active=True).count() == 1


class TestIsolation:
    def test_cannot_touch_another_companys_member(self, team, auth_client, member_factory):
        _, admin, _ = team
        foreign = member_factory(MemberRole.RECRUITER)
        response = auth_client(admin).patch(detail(foreign), {"is_active": False}, format="json")
        assert response.status_code == 404
        foreign.company_membership.refresh_from_db()
        assert foreign.company_membership.is_active is True

    def test_suspended_company_admin_cannot_manage_members(self, member_factory, auth_client):
        admin = member_factory(MemberRole.ADMIN, company_status=CompanyStatus.SUSPENDED)
        assert auth_client(admin).get(LIST).status_code == 403

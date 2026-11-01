from types import SimpleNamespace

import pytest
from django.contrib.auth.models import AnonymousUser

from apps.common.choices import CompanyStatus, MemberRole, UserRole
from apps.common.permissions import (
    CompanyRole,
    IsCandidate,
    IsCompanyAdmin,
    IsCompanyUser,
    IsPlatformAdmin,
)

pytestmark = pytest.mark.django_db


def allowed(permission, user):
    return permission().has_permission(SimpleNamespace(user=user), None)


def test_every_denial_uses_the_documented_message():
    for permission in (IsCandidate, IsPlatformAdmin, IsCompanyUser, IsCompanyAdmin, CompanyRole(MemberRole.VIEWER)):
        assert permission.message == "Unauthorized access."


def test_anonymous_users_pass_nothing():
    for permission in (IsCandidate, IsPlatformAdmin, IsCompanyUser, IsCompanyAdmin, CompanyRole(MemberRole.ADMIN)):
        assert allowed(permission, AnonymousUser()) is False
        assert allowed(permission, None) is False


def test_candidate_and_platform_admin_checks(user_factory):
    candidate = user_factory(role=UserRole.CANDIDATE)
    admin = user_factory(role=UserRole.PLATFORM_ADMIN)
    assert allowed(IsCandidate, candidate) and not allowed(IsCandidate, admin)
    assert allowed(IsPlatformAdmin, admin) and not allowed(IsPlatformAdmin, candidate)
    assert not allowed(IsCompanyUser, candidate) and not allowed(IsCompanyUser, admin)


@pytest.mark.parametrize("role", list(MemberRole))
def test_every_member_role_is_a_company_user_in_an_approved_company(member_factory, role):
    assert allowed(IsCompanyUser, member_factory(role=role))


@pytest.mark.parametrize("company_status", [CompanyStatus.PENDING, CompanyStatus.REJECTED, CompanyStatus.SUSPENDED])
def test_members_of_a_company_that_is_not_approved_are_denied(member_factory, company_status):
    assert not allowed(IsCompanyUser, member_factory(role=MemberRole.ADMIN, company_status=company_status))


def test_a_deactivated_member_is_denied(member_factory):
    user = member_factory(role=MemberRole.RECRUITER)
    user.company_membership.is_active = False
    user.company_membership.save()
    assert not allowed(IsCompanyUser, user)


def test_a_company_role_without_a_membership_is_denied(user_factory):
    assert not allowed(IsCompanyUser, user_factory(role=UserRole.HR))
    assert not allowed(IsCompanyUser, user_factory(role=UserRole.COMPANY_ADMIN))


def test_company_admin_requires_the_admin_member_role(member_factory):
    assert allowed(IsCompanyAdmin, member_factory(role=MemberRole.ADMIN))
    for role in (MemberRole.HR_MANAGER, MemberRole.RECRUITER, MemberRole.VIEWER):
        assert not allowed(IsCompanyAdmin, member_factory(role=role))


def test_company_role_factory_allows_only_the_listed_roles(member_factory):
    can_edit_jobs = CompanyRole(MemberRole.ADMIN, MemberRole.HR_MANAGER, MemberRole.RECRUITER)
    assert allowed(can_edit_jobs, member_factory(role=MemberRole.RECRUITER))
    assert allowed(can_edit_jobs, member_factory(role=MemberRole.ADMIN))
    assert not allowed(can_edit_jobs, member_factory(role=MemberRole.VIEWER))


def test_company_role_still_requires_an_approved_company(member_factory):
    only_viewers = CompanyRole(MemberRole.VIEWER)
    assert allowed(only_viewers, member_factory(role=MemberRole.VIEWER))
    assert not allowed(only_viewers, member_factory(role=MemberRole.VIEWER, company_status=CompanyStatus.SUSPENDED))


def test_permissions_trust_the_database_not_a_client_supplied_role(member_factory, user_factory):
    user = user_factory(role=UserRole.CANDIDATE)
    user.company_membership_claim = MemberRole.ADMIN
    assert not allowed(IsCompanyAdmin, user)

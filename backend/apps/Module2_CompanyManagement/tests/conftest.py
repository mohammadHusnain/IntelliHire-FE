import pytest

from apps.Module1_Authentication.models import User
from apps.common.choices import CompanyStatus, MemberRole, UserRole, UserStatus
from apps.Module2_CompanyManagement.models import CompanyMember


@pytest.fixture
def platform_admin(user_factory):
    return user_factory(role=UserRole.PLATFORM_ADMIN, email="platform@intellihire.example")


@pytest.fixture
def admin_client(auth_client, platform_admin):
    return auth_client(platform_admin)


@pytest.fixture
def pending_company(user_factory, company_factory):
    """A company waiting for review, with its founder (email verified, status pending_approval)."""
    founder = user_factory(role=UserRole.COMPANY_ADMIN, status=UserStatus.PENDING_APPROVAL)
    company = company_factory(created_by=founder, status=CompanyStatus.PENDING)
    CompanyMember.objects.create(company=company, user=founder, role=MemberRole.ADMIN)
    return company


@pytest.fixture
def company_with_admin(member_factory):
    """An approved company and its admin user."""
    admin = member_factory(MemberRole.ADMIN)
    return admin.company_membership.company, admin


def roles():
    return [role for role in MemberRole.values]


__all__ = ["User"]


@pytest.fixture
def api_client_factory():
    from rest_framework.test import APIClient

    return APIClient

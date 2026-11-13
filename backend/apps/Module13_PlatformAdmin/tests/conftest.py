import pytest

from apps.common.choices import MemberRole, UserRole
from apps.Module12_Communities.services import core as community_core
from apps.Module3_JobPosting.tests.conftest import clients, job_factory, team  # noqa: F401

ADMIN = "/api/platform-admin/"


@pytest.fixture
def platform_admin(user_factory):
    return user_factory(role=UserRole.PLATFORM_ADMIN, full_name="Platform Admin")


@pytest.fixture
def admin_client(platform_admin, auth_client):
    return auth_client(platform_admin)


@pytest.fixture
def job(team, job_factory):  # noqa: F811
    company, users = team
    return job_factory(company, users[MemberRole.ADMIN], status="open", title="Backend Developer")


@pytest.fixture
def community(team):
    company, users = team
    return community_core.create(company, users[MemberRole.ADMIN], {"name": "Alumni", "description": "Graduates.", "mission": "Help them.", "join_mode": "request"})


@pytest.fixture
def candidate(user_factory):
    return user_factory(full_name="Sara Malik")

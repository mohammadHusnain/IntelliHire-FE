"""Fixtures for the cross-module suite: everything is driven through the HTTP API unless a test says otherwise."""
import pytest
from rest_framework.test import APIClient

from apps.common.choices import MemberRole, UserRole
from apps.Module3_JobPosting.tests.conftest import clients, job_factory, team  # noqa: F401
from apps.Module4_ApplicationManagement.tests.helpers import form, pdf

PASSWORD = "Str0ng!pass-123"


@pytest.fixture
def api_client_factory():
    return APIClient


@pytest.fixture
def platform_admin(user_factory):
    return user_factory(role=UserRole.PLATFORM_ADMIN, email="platform@intellihire.example")


@pytest.fixture
def admin_client(auth_client, platform_admin):
    return auth_client(platform_admin)


@pytest.fixture
def apply(api_client_factory):
    """apply(job, **overrides) -> response, for anonymous applicants with their own IP (so throttling never interferes)."""
    counter = iter(range(1, 250))

    def make(job, client=None, **overrides):
        return (client or api_client_factory()).post(
            f"/api/public/jobs/{job.form_slug}/apply/", form(**overrides), format="multipart",
            REMOTE_ADDR=f"198.51.100.{next(counter)}",
        )

    return make


__all__ = ["MemberRole", "pdf", "PASSWORD"]

import itertools

import pytest
from django.core.cache import cache

from apps.Module1_Authentication.models import User
from apps.Module2_CompanyManagement.models import Company


@pytest.fixture(autouse=True)
def _interview_hooks_unconnected(request, monkeypatch):
    """The interview scoring hooks start unconnected in every test, and a test that wants them
    connected says so with `@pytest.mark.connected_hooks`.

    `evaluate_answer` and `evaluate_session` now call a real provider. Under the fake provider they
    would score every interview in the suite, which would silently change what dozens of tests
    assert. Pinning the default here keeps each test's intent explicit: `hooks.install()` installs
    fixed fakes, and the tests of the hooks themselves patch the provider instead.
    """
    if "connected_hooks" in request.keywords:
        return
    from apps.Module7_Interviews import ai_hooks

    def unconnected(name):
        def hook(*args, **kwargs):
            raise ai_hooks.AINotConnected(f"{name} is not connected in this test")

        return hook

    for name in ("evaluate_answer", "evaluate_session"):
        monkeypatch.setattr(ai_hooks, name, unconnected(name))


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def user_factory(db):
    counter = itertools.count(1)

    def make(**overrides):
        n = next(counter)
        fields = {
            "email": f"user{n}@example.com",
            "password": "Str0ng!pass-123",
            "full_name": f"User {n}",
            "role": User.Role.CANDIDATE,
            "status": User.Status.ACTIVE,
            "email_verified": True,
        }
        fields.update(overrides)
        return User.objects.create_user(fields.pop("email"), fields.pop("password"), **fields)

    return make


@pytest.fixture
def company_factory(user_factory):
    counter = itertools.count(1)

    def make(**overrides):
        n = next(counter)
        fields = {
            "name": f"Company {n}",
            "industry": "Software",
            "official_email": f"hr{n}@company{n}.example",
            "contact_phone": "+920000000000",
        }
        fields.update(overrides)
        if "created_by" not in fields:
            fields["created_by"] = user_factory(role=User.Role.COMPANY_ADMIN)
        return Company.objects.create(**fields)

    return make


@pytest.fixture
def api_client():
    from rest_framework.test import APIClient

    return APIClient()


@pytest.fixture
def auth_client():
    """A client logged in as `user` with a real access token (so status checks apply)."""
    from rest_framework.test import APIClient

    from apps.Module1_Authentication import auth_tokens

    def make(user):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {auth_tokens.issue_tokens(user)['access']}")
        return client

    return make


@pytest.fixture
def member_factory(user_factory, company_factory):
    """An active company user with a membership; the company is approved unless told otherwise."""
    from apps.common.choices import CompanyStatus, MemberRole, UserRole
    from apps.Module2_CompanyManagement.models import CompanyMember

    def make(role=MemberRole.RECRUITER, company=None, company_status=CompanyStatus.APPROVED, **user_overrides):
        reasons = {
            CompanyStatus.REJECTED: {"rejection_reason": "Registration details were incomplete."},
            CompanyStatus.SUSPENDED: {"suspension_reason": "Policy violation under review."},
        }
        company = company or company_factory(status=company_status, **reasons.get(company_status, {}))
        user_role = UserRole.COMPANY_ADMIN if role == MemberRole.ADMIN else UserRole.HR
        user = user_factory(role=user_role, **user_overrides)
        CompanyMember.objects.create(company=company, user=user, role=role)
        return user

    return make

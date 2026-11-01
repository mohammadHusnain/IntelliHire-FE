import itertools

import pytest
from django.core.cache import cache

from apps.accounts.models import User
from apps.companies.models import Company


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

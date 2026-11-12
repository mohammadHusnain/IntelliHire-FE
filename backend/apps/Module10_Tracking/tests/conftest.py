"""Module 10 reuses the shared fixtures (company team, jobs, applications, sessions) and adds candidate helpers."""
import pytest

from apps.Module4_ApplicationManagement.services import tracking_token
from apps.Module7_Interviews.tests.conftest import (  # noqa: F401
    _fresh,
    answer_turns,
    application,
    application_factory,
    clients,
    ensure_bank,
    hooks,
    job,
    job_factory,
    session,
    session_factory,
    team,
)


@pytest.fixture
def candidate(user_factory):
    """A verified candidate account whose email matches `mine` applications."""
    return user_factory(email="sara@example.com")


@pytest.fixture
def candidate_client(candidate, auth_client):
    return auth_client(candidate)


@pytest.fixture
def mine(application_factory, job, candidate):
    """An application made with the candidate's email (not yet linked to the account)."""
    return application_factory(job, email=candidate.email, status="submitted")


@pytest.fixture
def tracked(application_factory, job):
    """An application with a known raw tracking token. Returns (application, raw_token)."""

    def make(raw="track-token-0001", **fields):
        return application_factory(job, tracking_token_hash=tracking_token.hash_token(raw), **fields), raw

    return make

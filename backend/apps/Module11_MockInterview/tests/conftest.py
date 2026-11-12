"""Module 11 reuses Module 7's fixtures (company team, fake hooks) and adds the candidate and role helpers."""
import pytest

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

from ..models import InterviewRole


@pytest.fixture(autouse=True)
def ensure_roles(db):
    """Transaction tests flush what the seed migration inserted; put the role catalog back when it is missing."""
    from .. import seed_data

    if not InterviewRole.objects.exists():
        InterviewRole.objects.bulk_create([InterviewRole(**row) for row in seed_data.rows()])


@pytest.fixture
def candidate(user_factory):
    return user_factory(full_name="Sara Malik", email="sara@example.com")


@pytest.fixture
def me(candidate, auth_client):
    return auth_client(candidate)


@pytest.fixture
def role():
    return InterviewRole.objects.get(slug="software-engineer")


def create(client, **body):
    return client.post("/api/mock-interviews/", {"interview_type": "general", **body}, format="json")


def play(client, session_id, count, text="I would explain my approach clearly."):
    """Start a session and answer `count` questions; returns the last answer response."""
    first = client.post(f"/api/mock-interviews/{session_id}/start/").json()
    turn, last = first["turn"], first
    for _ in range(count):
        last = client.post(f"/api/mock-interviews/{session_id}/answer/", {"turn_index": turn["index"], "answer_text": text}, format="json").json()
        turn = last["turn"]
    return last


@pytest.fixture
def with_cv(candidate):
    from apps.Module1_Authentication.models import CandidateProfile

    def make(text):
        profile, _ = CandidateProfile.objects.get_or_create(user=candidate)
        profile.resume_text = text
        profile.save()

    return make

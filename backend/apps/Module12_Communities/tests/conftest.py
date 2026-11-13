import itertools

import pytest

from apps.common.choices import MemberRole
from apps.Module1_Authentication.models import CandidateProfile, Education
from apps.Module3_JobPosting.tests.conftest import clients, job_factory, team  # noqa: F401

from ..services import core

counter = itertools.count(1)


@pytest.fixture
def make_candidate(user_factory):
    """A verified candidate with a profile. Defaults fit the `community` fixture's filters."""

    def make(name=None, institution="FAST NUCES", degree="BS Computer Science", end_year=2025, skills=("Python", "SQL"), discoverable=True, headline="Software engineer", **user):
        n = next(counter)
        account = user_factory(full_name=name or f"Candidate {n}", email=f"cand{n}@example.com", **user)
        profile = CandidateProfile.objects.create(user=account, headline=headline, skills=list(skills), discoverable=discoverable, phone="+923001234567")
        if institution:
            Education.objects.create(profile=profile, institution=institution, degree=degree, field_of_study="Computer Science", start_year=end_year - 4, end_year=end_year)
        return account

    return make


@pytest.fixture
def community(team):
    company, users = team
    return core.create(company, users[MemberRole.ADMIN], {
        "name": "FAST Alumni", "description": "Graduates of FAST.", "mission": "Help graduates find work.", "join_mode": "request",
        "filter_universities": ["FAST"], "filter_degrees": [], "filter_grad_year_from": 2024, "filter_grad_year_to": 2026, "filter_skills": ["Python"], "filter_skill_mode": "any",
    })  # fmt: skip


@pytest.fixture
def invite_only(team):
    company, users = team
    return core.create(company, users[MemberRole.ADMIN], {"name": "Hidden Circle", "description": "By invitation.", "mission": "Small and selective.", "join_mode": "invite_only"})


@pytest.fixture
def me(make_candidate, auth_client):
    candidate = make_candidate(name="Sara Malik")
    return candidate, auth_client(candidate)


STAFF = "/api/company/communities/"
CAND = "/api/candidate/"

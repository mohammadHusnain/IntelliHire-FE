"""Module 8 reuses Module 7's fixtures (company team, jobs, applications, sessions, fake hooks)."""
import itertools

import pytest

from apps.Module7_Interviews.tests.conftest import (  # noqa: F401
    FakeHooks,
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

TECH_CONTEXT = {"job_title": "Backend Developer", "required_skills": ["Python", "Django"], "seniority_band": "mid", "competencies_to_cover": ["Python", "Django"], "cv_summary": {}}


@pytest.fixture
def passed_screening(session_factory):
    """A screening interview evaluated as `advance` for an application."""

    def make(application, recommendation="advance", score=80):
        return session_factory(application, kind="screening", status="evaluated", recommendation=recommendation, overall_score=score, token=f"scr-{next(_n)}")

    return make


_n = itertools.count(1)


@pytest.fixture
def technical(session_factory):
    def make(application, **fields):
        fields.setdefault("context", TECH_CONTEXT)
        fields.setdefault("target", 4)
        return session_factory(application, kind="technical", token=fields.pop("token", None), **fields)

    return make

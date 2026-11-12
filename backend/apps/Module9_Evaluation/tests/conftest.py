"""Module 9 reuses Module 7's fixtures and adds helpers for stage scores and the report call."""
import itertools

import pytest
from django.utils import timezone

from apps.Module5_Foundation.ai.providers.fake import FakeProvider
from apps.Module6_CVAnalysis.models import CVMatch
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

from ..models import CandidateEvaluation

_tokens = itertools.count(1)


@pytest.fixture(autouse=True)
def ensure_prompt(db):
    """Transaction tests flush what the seed migration inserted; put the report prompt back when it is missing."""
    from apps.Module5_Foundation.models import PromptTemplate

    from ..prompts import TEMPLATES

    for template in TEMPLATES:
        if not PromptTemplate.objects.filter(key=template["key"]).exists():
            PromptTemplate.objects.create(version=1, is_active=True, **template)


@pytest.fixture
def cv_match():
    def make(application, score=80, matched=("Python", "Django"), missing=("React",)):
        return CVMatch.objects.update_or_create(
            application=application,
            defaults={
                "score": score, "skills_score": score, "experience_score": score, "education_score": score, "semantic_score": score,
                "matched_skills": list(matched), "missing_skills": list(missing), "experience_years": 3, "weights_used": {}, "job_signature": "x",
                "explanation": "A good fit on skills.", "computed_at": timezone.now(),
            },
        )[0]

    return make


@pytest.fixture
def evaluated_session(session_factory):
    """An interview of `kind` that was evaluated with `score` (0 to 100)."""

    def make(application, kind, score, report=None):
        report = report if report is not None else (
            {"summary": f"{kind} summary", "questions": [{"index": 1, "question": "q?", "score": 7.0, "comment": "Solid."}], "technical_relevance": "adequate"}
            if kind == "technical" else {"summary": f"{kind} summary"}
        )
        return session_factory(application, kind=kind, status="evaluated", overall_score=score, report=report, token=f"ev-{next(_tokens)}")

    return make


@pytest.fixture
def scored(application, cv_match, evaluated_session):
    """An application with all three stage scores (80, 70, 85: composite 79.0 under the default weights)."""
    cv_match(application, 80)
    evaluated_session(application, "screening", 70)
    evaluated_session(application, "technical", 85)
    return application


@pytest.fixture
def evaluation(scored):
    from ..services import scores

    return scores.refresh(scored)[0]


GOOD_REPORT = {"summary": "A strong fit for the role.", "strengths": ["Solid Python"], "weaknesses": ["No React"], "recommendation": "yes"}


def queue_report(**overrides):
    FakeProvider.queue_chat({**GOOD_REPORT, **overrides})


def evaluation_of(application):
    return CandidateEvaluation.objects.get(application=application)

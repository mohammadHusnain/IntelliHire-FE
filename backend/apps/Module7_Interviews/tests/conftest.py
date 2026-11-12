import itertools
from datetime import timedelta

import pytest
from django.utils import timezone

from apps.common.choices import MemberRole
from apps.Module3_JobPosting.tests.conftest import clients, job_factory, team  # noqa: F401
from apps.Module4_ApplicationManagement.models import Application, ApplicationStatusChange
from apps.Module5_Foundation.ai import llm
from apps.Module5_Foundation.ai.providers.fake import FakeProvider

from .. import ai_hooks, runner
from ..models import InterviewSession, InterviewTurn
from ..services import links

TOKEN = "test-token-0001"


@pytest.fixture(autouse=True)
def _fresh(monkeypatch):
    FakeProvider.reset()
    monkeypatch.setattr(runner, "_sleep", lambda seconds: None)
    monkeypatch.setattr(llm, "_sleep", lambda seconds: None)
    yield
    FakeProvider.reset()


@pytest.fixture(autouse=True)
def ensure_bank(db):
    """Transaction tests flush the tables the seed migration filled; put the question bank back when it is missing."""
    from .. import seed_data
    from ..models import InterviewQuestionBank

    if not InterviewQuestionBank.objects.exists():
        InterviewQuestionBank.objects.bulk_create([InterviewQuestionBank(**row) for row in seed_data.rows()])


@pytest.fixture
def job(team, job_factory):  # noqa: F811
    company, users = team
    return job_factory(
        company, users[MemberRole.ADMIN], status="open", title="Backend Developer",
        required_skills=["Python", "Django"], min_experience_years=2, description="Build the APIs of a hiring platform.",
    )  # fmt: skip


@pytest.fixture
def application_factory(db):
    counter = itertools.count(1)

    def make(job, status="shortlisted", **overrides):
        n = next(counter)
        fields = {
            "job": job, "reference": f"IH-I{n:05d}", "full_name": "Sara Malik", "email": f"candidate{n}@example.com",
            "phone": "+923001234567", "education_level": "bachelor", "institution": "FAST NUCES", "graduation_year": 2020,
            "resume_original_name": "cv.pdf", "status": status,
        }  # fmt: skip
        fields.update(overrides)
        application = Application.objects.create(**fields)
        ApplicationStatusChange.objects.create(application=application, from_status="", to_status=status, source="system")
        return application

    return make


@pytest.fixture
def application(job, application_factory):
    return application_factory(job)


@pytest.fixture
def session_factory(db):
    """Sessions with a known raw token (`TOKEN` for the first one, `TOKEN-n` after) so tests can call the public link."""
    counter = itertools.count(1)

    def make(application, kind="screening", status="invited", target=3, token=None, days=7, **overrides):
        n = next(counter)
        raw = token or (TOKEN if n == 1 else f"{TOKEN}-{n}")
        fields = {
            "kind": kind, "application": application, "token_hash": links.hash_token(raw), "status": status,
            "role_title": application.job.title, "question_target": target, "expires_at": timezone.now() + timedelta(days=days),
            "context": {"job_title": application.job.title, "required_skills": list(application.job.required_skills)},
        }  # fmt: skip
        fields.update(overrides)
        session = InterviewSession.objects.create(**fields)
        session.raw_token = raw
        return session

    return make


@pytest.fixture
def session(application, session_factory):
    return session_factory(application)


def answer_turns(session, count, score=None):
    """Create `count` answered turns directly (skipping the API) for evaluation tests."""
    now = timezone.now()
    for index in range(1, count + 1):
        InterviewTurn.objects.create(
            session=session, index=index, question_text=f"Question {index}?", question_meta={"topic": "t", "competency": "interest"},
            answer_text=f"Answer {index}", answer_source="typed", answered_at=now, score=score,
            evaluation={"score": float(score), "criteria": {"role_alignment": float(score)}, "feedback": "ok", "flags": []} if score is not None else {},
        )


class FakeHooks:
    """Installs fixed hooks (a fixed question, fixed score, fixed report) in place of the not-connected defaults."""

    def __init__(self, monkeypatch):
        self.monkeypatch = monkeypatch
        self.calls = []
        self.score = 8.0
        self.counter = itertools.count(1)

    def install(self, question=True, answer=True, report=True, voice=False):
        if question:
            self.monkeypatch.setattr(ai_hooks, "next_question", self._question)
        if answer:
            self.monkeypatch.setattr(ai_hooks, "evaluate_answer", self._answer)
        if report:
            self.monkeypatch.setattr(ai_hooks, "evaluate_session", self._report)
        if voice:
            self.monkeypatch.setattr(ai_hooks, "transcribe", self._voice)
        return self

    def _question(self, session, turns, hint):
        self.calls.append(("next_question", dict(hint)))
        return {
            "question_text": f"Tell us about your Python experience, part {next(self.counter)}?", "competency": "experience",
            "topic": "python", "difficulty": "medium", "is_follow_up": False,
        }  # fmt: skip

    def _answer(self, session, turn):
        self.calls.append(("evaluate_answer", turn.index))
        score = self.score(turn) if callable(self.score) else self.score
        names = {"screening": "role_alignment", "technical": "technical_accuracy", "mock": "communication"}
        return {"score": score, "criteria": {names[session.kind]: score}, "feedback": "Clear answer.", "flags": []}

    def _report(self, session, turns):
        self.calls.append(("evaluate_session", len(turns)))
        if session.kind == "mock":
            return {"summary": "Good practice.", "strengths": ["Clear"], "weaknesses": [], "suggestions": ["Add examples"], "dimension_comments": {"communication": "Clear."}}
        data = {"summary": "A solid candidate.", "strengths": ["Clear"], "weaknesses": ["Short"], "per_question": [{"index": t.index, "comment": "Fine"} for t in turns]}
        if session.kind == "technical":
            data["technical_relevance"] = "adequate"
        return data

    def _voice(self, audio_file):
        self.calls.append(("transcribe", None))
        return {"text": "I spoke this answer.", "duration_seconds": 12}


@pytest.fixture
def hooks(monkeypatch):
    return FakeHooks(monkeypatch)

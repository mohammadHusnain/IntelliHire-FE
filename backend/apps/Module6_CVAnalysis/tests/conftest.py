import itertools

import pytest
from django.core.files.base import ContentFile

from apps.common.choices import MemberRole
from apps.common.tests.helpers import make_pdf
from apps.Module3_JobPosting.tests.conftest import clients, job_factory, team  # noqa: F401
from apps.Module4_ApplicationManagement.models import Application, ApplicationStatusChange
from apps.Module5_Foundation.ai import llm
from apps.Module5_Foundation.ai.providers.fake import FakeProvider

from ..models import CVAnalysis

CV_TEXT = (
    "Sara Malik sara.malik@example.com +92 300 1234567 linkedin.com/in/saramalik "
    "Backend developer with four years of experience building APIs in Python and Django. "
    "Worked at Acme Labs from 2020 to 2024 on PostgreSQL backed services and REST interfaces. "
    "Bachelor of Science in Computer Science completed in 2020."
)


def parsed_cv(**overrides):
    """What the model returns for a typical CV; override any field."""
    data = {
        "technical_skills": ["Python", "Django", "PostgreSQL"],
        "soft_skills": ["Communication"],
        "education": [{"degree": "BS Computer Science", "institution": "FAST NUCES", "year": 2020, "level": "bachelor", "completed": True}],
        "experience": [{"company": "Acme Labs", "role": "Backend Developer", "start": "2020-01", "end": "2023-12", "is_current": False, "summary": "Built REST APIs."}],
        "projects": [{"name": "Hiring API", "summary": "A Django REST service."}],
        "achievements": [],
        "total_experience_years": 4,
    }
    data.update(overrides)
    return data


@pytest.fixture(autouse=True)
def _fresh_ai(monkeypatch):
    FakeProvider.reset()
    llm.clear_embedding_cache()
    monkeypatch.setattr(llm, "_sleep", lambda seconds: None)
    yield
    FakeProvider.reset()


@pytest.fixture
def job(team, job_factory):  # noqa: F811
    company, users = team
    return job_factory(
        company, users[MemberRole.ADMIN], status="open", title="Backend Developer",
        required_skills=["Python", "Django", "React"], min_experience_years=2, education_level="bachelor",
        description="Build and run the APIs behind our hiring platform.", responsibilities="Design endpoints.",
    )  # fmt: skip


@pytest.fixture
def application_factory(db):
    counter = itertools.count(1)

    def make(job, cv_text=CV_TEXT, queued=True, **overrides):
        n = next(counter)
        fields = {
            "job": job, "reference": f"IH-T{n:05d}", "full_name": "Sara Malik", "email": f"applicant{n}@example.com",
            "phone": "+923001234567", "education_level": "bachelor", "institution": "FAST NUCES", "graduation_year": 2020,
            "resume_original_name": "cv.pdf",
        }  # fmt: skip
        fields.update(overrides)
        application = Application(**fields)
        if cv_text is not None:
            application.resume.save("cv.pdf", ContentFile(make_pdf(cv_text)), save=False)
        application.save()
        ApplicationStatusChange.objects.create(application=application, from_status="", to_status="submitted", source="system")
        if queued:
            CVAnalysis.objects.create(application=application)
        return application

    return make


@pytest.fixture
def analysed(application_factory, job):
    """Run the pipeline for a new application with the given model answer; returns the refreshed application."""
    from ..services import pipeline

    def make(parsed=None, job_=None, explanation="A solid match.", **application_fields):
        application = application_factory(job_ or job, **application_fields)
        FakeProvider.queue_chat(parsed if parsed is not None else parsed_cv(), {"explanation": explanation})
        assert pipeline.analyse(application.pk) == "completed"
        return Application.objects.select_related("cv_match", "cv_analysis", "job").get(pk=application.pk)

    return make

import pytest

from apps.common.choices import MemberRole
from apps.Module3_JobPosting.tests.conftest import clients, job_factory, team  # noqa: F401

from .helpers import form, pdf

CUSTOM_FIELDS = [
    {"label": "LinkedIn Profile URL", "key": "linkedin_profile_url", "field_type": "url"},
    {"label": "Why us", "key": "why_us", "field_type": "long_text", "required": True, "max_length": 200},
    {"label": "Years of experience", "key": "years_of_experience", "field_type": "number"},
    {"label": "Contact email", "key": "contact_email", "field_type": "email"},
    {"label": "Available from", "key": "available_from", "field_type": "date"},
    {"label": "Level", "key": "level", "field_type": "single_choice", "options": ["Junior", "Senior"], "required": True},
    {"label": "Skills", "key": "skills", "field_type": "multiple_choice", "options": ["Python", "SQL", "Go"]},
    {"label": "Portfolio", "key": "portfolio", "field_type": "file"},
    {"label": "Nickname", "key": "nickname", "field_type": "short_text", "max_length": 10},
]


def full_answers(**overrides):
    """Valid answers for every custom field of `form_job`, plus the built-in fields."""
    data = form(
        linkedin_profile_url="https://linkedin.com/in/sara",
        why_us="Great team and interesting problems.",
        years_of_experience="3.5",
        contact_email="Sara@Home.example",
        available_from="2026-12-01",
        level="Senior",
        skills=["Python", "SQL"],
        portfolio=pdf("portfolio.pdf"),
        nickname="Sari",
    )
    data.update(overrides)
    return {key: value for key, value in data.items() if value is not None}


@pytest.fixture
def open_job(team, job_factory):  # noqa: F811
    company, users = team
    return job_factory(company, users[MemberRole.ADMIN], status="open", title="Backend Developer")


@pytest.fixture
def form_job(team, job_factory):  # noqa: F811
    """An open job whose form has one custom field of every type."""
    company, users = team
    return job_factory(company, users[MemberRole.ADMIN], status="open", title="Data Engineer", fields=CUSTOM_FIELDS)


@pytest.fixture
def api_client_factory():
    from rest_framework.test import APIClient

    return APIClient

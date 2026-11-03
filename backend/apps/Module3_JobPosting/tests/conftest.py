import itertools
import secrets

import pytest
from django.utils import timezone

from apps.common.choices import MemberRole
from apps.Module3_JobPosting.models import ApplicationField, JobPosting

from .helpers import future


@pytest.fixture
def team(member_factory):
    """An approved company with one user per member role."""
    admin = member_factory(MemberRole.ADMIN)
    company = admin.company_membership.company
    users = {MemberRole.ADMIN: admin}
    for role in (MemberRole.HR_MANAGER, MemberRole.RECRUITER, MemberRole.VIEWER):
        users[role] = member_factory(role, company=company)
    return company, users


@pytest.fixture
def clients(team, auth_client):
    """API clients for each role of the `team` company."""
    _, users = team
    return {role: auth_client(user) for role, user in users.items()}


@pytest.fixture
def job_factory():
    counter = itertools.count(1)

    def make(company, user=None, status="draft", fields=(), **overrides):
        n = next(counter)
        data = {
            "company": company,
            "title": f"Job {n}",
            "department": "Engineering",
            "description": "Build things.",
            "employment_type": "full_time",
            "work_mode": "onsite",
            "location": "Lahore",
            "required_skills": ["Python"],
            "created_by": user,
            "updated_by": user,
            "status": status,
        }
        if status in ("open", "closed"):
            data.update(
                form_slug=secrets.token_urlsafe(8)[:10],
                published_at=timezone.now(),
                deadline=future(14),
            )
        if status == "closed":
            data.update(close_reason="manual", closed_at=timezone.now())
        data.update(overrides)
        job = JobPosting.objects.create(**data)
        for order, field in enumerate(fields):
            ApplicationField.objects.create(job=job, order=order, **field)
        return job

    return make

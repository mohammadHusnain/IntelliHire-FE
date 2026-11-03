from datetime import timedelta

from django.utils import timezone

JOBS = "/api/jobs/"


def future(days=14, hours=0):
    return timezone.now() + timedelta(days=days, hours=hours)


def payload(**overrides):
    """A complete, publishable job as HR would send it."""
    data = {
        "title": "Backend Developer",
        "department": "Engineering",
        "description": "Build and run the APIs behind our hiring platform.",
        "responsibilities": "Design endpoints, review code, keep the database healthy.",
        "employment_type": "full_time",
        "work_mode": "hybrid",
        "location": "Lahore",
        "required_skills": ["Python", "Django", "PostgreSQL"],
        "soft_skills": ["Communication"],
        "min_experience_years": 2,
        "education_level": "bachelor",
        "salary_min": 150000,
        "salary_max": 250000,
        "salary_currency": "PKR",
        "show_salary": True,
        "openings": 2,
        "deadline": future(14).isoformat(),
    }
    data.update(overrides)
    return data


def job_url(job_or_id, suffix=""):
    pk = getattr(job_or_id, "pk", job_or_id)
    return f"{JOBS}{pk}/{suffix + '/' if suffix else ''}"

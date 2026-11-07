from pathlib import Path

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.common.tests.helpers import make_docx, make_pdf

APPLICATIONS = "/api/applications/"


def apply_url(job_or_slug):
    slug = getattr(job_or_slug, "form_slug", job_or_slug)
    return f"/api/public/jobs/{slug}/apply/"


def pdf(name="My CV.pdf", text="Hello resume"):
    return SimpleUploadedFile(name, make_pdf(text), content_type="application/pdf")


def docx(name="cv.docx"):
    return SimpleUploadedFile(name, make_docx(), content_type="application/octet-stream")


def form(**overrides):
    """A valid submission for a job that has no custom fields."""
    data = {
        "full_name": "Sara Malik",
        "email": "Sara.Malik@Example.com",
        "phone": "+92 300 1234567",
        "education_level": "bachelor",
        "institution": "FAST NUCES",
        "graduation_year": "2023",
        "resume": pdf(),
    }
    data.update(overrides)
    return {key: value for key, value in data.items() if value is not None}


def job_url(job, suffix=""):
    return f"/api/jobs/{job.pk}/{suffix + '/' if suffix else ''}"


def app_url(application, suffix=""):
    return f"{APPLICATIONS}{application.pk}/{suffix + '/' if suffix else ''}"


def stored_files(job):
    """Every file currently stored for a job in the private storage."""
    folder = Path(settings.PRIVATE_MEDIA_ROOT) / "applications" / str(job.pk)
    return sorted(path for path in folder.rglob("*") if path.is_file()) if folder.exists() else []

from datetime import timedelta

import pytest
from django.db import IntegrityError, transaction
from django.test import override_settings
from django.utils import timezone

from apps.common.choices import CompanyStatus
from apps.Module3_JobPosting.models import ApplicationField

from .helpers import future

pytestmark = pytest.mark.django_db


def violates(constraint, create):
    with pytest.raises(IntegrityError) as caught, transaction.atomic():
        create()
    assert constraint in str(caught.value)


class TestJobConstraints:
    def test_draft_cannot_have_a_slug(self, team, job_factory):
        company, _ = team
        violates("job_draft_has_no_slug", lambda: job_factory(company, form_slug="abc"))

    @pytest.mark.parametrize("missing", ["form_slug", "published_at", "deadline"])
    def test_open_job_needs_slug_publish_time_and_deadline(self, team, job_factory, missing):
        company, _ = team
        violates("job_open_is_published", lambda: job_factory(company, status="open", **{missing: None}))

    @pytest.mark.parametrize("missing", ["close_reason", "closed_at"])
    def test_closed_job_needs_close_info(self, team, job_factory, missing):
        company, _ = team
        violates("job_closed_has_close_info", lambda: job_factory(company, status="closed", **{missing: None}))

    def test_only_closed_jobs_carry_close_info(self, team, job_factory):
        company, _ = team
        violates(
            "job_only_closed_has_close_info",
            lambda: job_factory(company, status="open", close_reason="manual", closed_at=timezone.now()),
        )

    def test_salary_max_cannot_be_below_min(self, team, job_factory):
        company, _ = team
        violates("job_salary_range", lambda: job_factory(company, salary_min=200, salary_max=100))

    def test_one_sided_salary_is_fine(self, team, job_factory):
        company, _ = team
        job_factory(company, salary_min=100)
        job_factory(company, salary_max=100)

    @pytest.mark.parametrize(
        "overrides,constraint",
        [
            ({"status": "archived"}, "job_status_valid"),
            ({"employment_type": "gig"}, "job_employment_type_valid"),
            ({"work_mode": "moon"}, "job_work_mode_valid"),
            ({"education_level": "wizard"}, "job_education_level_valid"),
            ({"min_experience_years": 31}, "job_experience_range"),
            ({"openings": 0}, "job_openings_positive"),
        ],
    )
    def test_invalid_values_are_refused_by_the_database(self, team, job_factory, overrides, constraint):
        company, _ = team
        violates(constraint, lambda: job_factory(company, **overrides))

    def test_slug_is_unique_but_many_drafts_without_one_are_fine(self, team, job_factory):
        company, _ = team
        job_factory(company)
        job_factory(company)
        job_factory(company, status="open", form_slug="same-slug")
        violates("form_slug", lambda: job_factory(company, status="open", form_slug="same-slug"))

    def test_field_key_unique_within_a_job_only(self, team, job_factory):
        company, _ = team
        a, b = job_factory(company), job_factory(company)
        ApplicationField.objects.create(job=a, label="X", key="x", field_type="short_text")
        ApplicationField.objects.create(job=b, label="X", key="x", field_type="short_text")
        violates("field_key_unique_per_job", lambda: ApplicationField.objects.create(job=a, label="Y", key="x", field_type="short_text"))

    def test_field_type_and_max_length_checked(self, team, job_factory):
        company, _ = team
        job = job_factory(company)
        violates("field_type_valid", lambda: ApplicationField.objects.create(job=job, label="X", key="x", field_type="video"))
        violates("field_max_length_positive", lambda: ApplicationField.objects.create(job=job, label="X", key="y", field_type="short_text", max_length=0))


class TestIsAcceptingApplications:
    def test_open_future_approved_company_accepts(self, team, job_factory):
        company, _ = team
        assert job_factory(company, status="open").is_accepting_applications is True

    def test_draft_and_closed_do_not(self, team, job_factory):
        company, _ = team
        assert job_factory(company).is_accepting_applications is False
        assert job_factory(company, status="closed").is_accepting_applications is False

    def test_open_job_is_effectively_closed_the_moment_the_deadline_passes(self, team, job_factory):
        company, _ = team
        job = job_factory(company, status="open", deadline=timezone.now() - timedelta(seconds=1))
        assert job.status == "open" and job.is_accepting_applications is False

    @pytest.mark.parametrize("status", [CompanyStatus.SUSPENDED, CompanyStatus.REJECTED, CompanyStatus.PENDING])
    def test_company_that_is_not_approved_stops_acceptance(self, team, job_factory, status):
        company, _ = team
        job = job_factory(company, status="open")
        company.status = status
        company.rejection_reason = "Registration details were incomplete."
        company.suspension_reason = "Policy violation under review."
        company.save()
        job.refresh_from_db()
        assert job.is_accepting_applications is False


class TestShareUrl:
    @override_settings(FRONTEND_URL="https://app.intellihire.example/")
    def test_share_url_uses_the_frontend_and_slug(self, team, job_factory):
        company, _ = team
        job = job_factory(company, status="open", form_slug="Ab3dE_f-Gh")
        assert job.share_url == "https://app.intellihire.example/apply/Ab3dE_f-Gh"

    def test_drafts_have_no_share_url(self, team, job_factory):
        company, _ = team
        assert job_factory(company).share_url == ""


def test_documented_indexes_exist():
    from apps.Module3_JobPosting.models import JobPosting

    index_fields = [tuple(index.fields) for index in JobPosting._meta.indexes]
    assert ("company", "status") in index_fields and ("status", "deadline") in index_fields
    assert future(1) > timezone.now()

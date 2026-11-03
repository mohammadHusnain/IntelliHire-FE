from datetime import timedelta

import pytest
from django.utils import timezone

from apps.common.choices import CompanyStatus, MemberRole
from apps.Module3_JobPosting.builtin_fields import BUILT_IN_FIELDS, BUILT_IN_KEYS
from apps.Module3_JobPosting.models import JobPosting

from .helpers import JOBS, future, job_url, payload

pytestmark = pytest.mark.django_db
BUILT_IN_ORDER = ["full_name", "email", "phone", "education_level", "institution", "graduation_year", "resume"]


def public(slug):
    return f"/api/public/jobs/{slug}/"


class TestBuiltInDefinition:
    def test_the_built_in_list_is_defined_once_in_the_documented_order(self):
        assert [f["key"] for f in BUILT_IN_FIELDS] == BUILT_IN_ORDER
        assert BUILT_IN_KEYS == frozenset(BUILT_IN_ORDER)

    def test_mandatory_fields_per_the_doc(self):
        assert all(f["required"] for f in BUILT_IN_FIELDS)  # name, email, phone, CV and the three education fields

    def test_education_options_match_the_job_education_levels(self):
        options = next(f for f in BUILT_IN_FIELDS if f["key"] == "education_level")["options"]
        assert options == ["none", "intermediate", "bachelor", "master", "phd"]


class TestPublicEndpoint:
    def test_tc15_custom_field_then_publish_gives_a_share_url_and_a_public_form_without_a_token(self, team, clients, api_client, job_factory):
        company, users = team
        job = job_factory(company, users[MemberRole.RECRUITER], deadline=future(14), title="QA Engineer")
        recruiter = clients[MemberRole.RECRUITER]
        added = recruiter.post(job_url(job, "fields"), {"label": "LinkedIn Profile URL", "field_type": "url"}, format="json")
        assert added.status_code == 201
        published = recruiter.post(job_url(job, "publish")).json()
        assert published["share_url"].endswith(f"/apply/{published['form_slug']}")

        response = api_client.get(public(published["form_slug"]))  # no Authorization header
        assert response.status_code == 200
        body = response.json()
        assert body["accepting"] is True and body["message"] is None
        assert [f["key"] for f in body["fields"]] == BUILT_IN_ORDER + ["linkedin_profile_url"]
        custom = body["fields"][-1]
        assert (custom["label"], custom["type"], custom["required"], custom["built_in"]) == ("LinkedIn Profile URL", "url", False, False)
        assert all(f["built_in"] for f in body["fields"][:7])

    def test_job_summary_for_candidates(self, team, api_client, job_factory):
        company, users = team
        job = job_factory(
            company, users[MemberRole.ADMIN], status="open", title="Data Engineer", department="Data", location="Karachi",
            work_mode="hybrid", employment_type="contract", description="Pipelines.", responsibilities="Own ETL.",
            required_skills=["SQL"], soft_skills=["Teamwork"],
        )
        body = api_client.get(public(job.form_slug)).json()["job"]
        assert body["title"] == "Data Engineer" and body["company"] == {"name": company.name, "logo": None}
        assert (body["department"], body["location"], body["work_mode"], body["employment_type"]) == ("Data", "Karachi", "hybrid", "contract")
        assert (body["description"], body["required_skills"], body["soft_skills"]) == ("Pipelines.", ["SQL"], ["Teamwork"])
        assert body["deadline"] and body["salary"] is None
        assert set(body) == {"title", "company", "department", "location", "work_mode", "employment_type", "description", "responsibilities", "required_skills", "soft_skills", "deadline", "salary"}

    def test_no_internal_data_is_exposed(self, team, api_client, job_factory):
        company, users = team
        job = job_factory(company, users[MemberRole.ADMIN], status="open")
        text = api_client.get(public(job.form_slug)).content.decode()
        for secret in (str(job.pk), users[MemberRole.ADMIN].email, str(company.pk), "created_by", "applications_count"):
            assert secret not in text

    def test_salary_only_when_the_job_says_to_show_it(self, team, api_client, job_factory):
        company, _ = team
        hidden = job_factory(company, status="open", salary_min=100, salary_max=200, salary_currency="USD", show_salary=False)
        shown = job_factory(company, status="open", salary_min=100, salary_max=200, salary_currency="USD", show_salary=True)
        assert api_client.get(public(hidden.form_slug)).json()["job"]["salary"] is None
        assert api_client.get(public(shown.form_slug)).json()["job"]["salary"] == {"min": 100, "max": 200, "currency": "USD"}

    def test_unknown_slug_is_404(self, api_client):
        response = api_client.get(public("nope-nope-1"))
        assert response.status_code == 404

    def test_drafts_are_never_served(self, team, api_client, job_factory):
        company, _ = team
        draft = job_factory(company)
        assert api_client.get(public(str(draft.pk))).status_code == 404
        assert api_client.get(public("")).status_code == 404

    def test_a_bad_bearer_token_does_not_break_the_public_endpoint(self, team, api_client, job_factory):
        company, _ = team
        job = job_factory(company, status="open")
        api_client.credentials(HTTP_AUTHORIZATION="Bearer garbage")
        assert api_client.get(public(job.form_slug)).status_code == 200

    def test_closed_job_is_200_with_accepting_false_and_a_message(self, team, api_client, job_factory):
        company, _ = team
        job = job_factory(company, status="closed")
        response = api_client.get(public(job.form_slug))
        assert response.status_code == 200
        body = response.json()
        assert body["accepting"] is False and body["message"] == "This position is no longer accepting applications."
        assert body["job"]["title"] == job.title and len(body["fields"]) >= 7

    def test_open_job_past_its_deadline_reports_not_accepting_before_the_command_runs(self, team, api_client, job_factory):
        company, _ = team
        job = job_factory(company, status="open", deadline=timezone.now() - timedelta(seconds=5))
        body = api_client.get(public(job.form_slug)).json()
        assert body["accepting"] is False and body["message"]
        assert JobPosting.objects.get(pk=job.pk).status == "open"

    @pytest.mark.parametrize("status", [CompanyStatus.SUSPENDED, CompanyStatus.REJECTED])
    def test_a_company_that_is_not_approved_stops_its_forms(self, team, api_client, job_factory, status):
        company, _ = team
        job = job_factory(company, status="open")
        company.status = status
        company.rejection_reason = "Registration details were incomplete."
        company.suspension_reason = "Policy violation under review."
        company.save()
        body = api_client.get(public(job.form_slug)).json()
        assert body["accepting"] is False
        assert JobPosting.objects.filter(pk=job.pk).exists()

    def test_tc16_public_endpoint_says_not_accepting_for_a_past_deadline(self, team, api_client, job_factory):
        company, _ = team
        job = job_factory(company, status="open", deadline=timezone.now() - timedelta(hours=1))
        assert api_client.get(public(job.form_slug)).json()["accepting"] is False

    def test_company_logo_is_an_absolute_url(self, team, api_client, job_factory):
        from django.core.files.uploadedfile import SimpleUploadedFile

        from apps.common.tests.helpers import make_image

        company, _ = team
        company.logo = SimpleUploadedFile("logo.png", make_image("PNG"), content_type="image/png")
        company.save()
        job = job_factory(company, status="open")
        logo = api_client.get(public(job.form_slug)).json()["job"]["company"]["logo"]
        assert logo.startswith("http") and "company_logos" in logo

    def test_only_get_is_allowed(self, team, api_client, job_factory):
        company, _ = team
        job = job_factory(company, status="open")
        assert api_client.post(public(job.form_slug), {}, format="json").status_code == 405
        assert api_client.delete(public(job.form_slug)).status_code == 405


class TestFieldShapes:
    def test_choice_options_and_built_in_labels(self, team, api_client, job_factory):
        company, _ = team
        job = job_factory(
            company, status="open",
            fields=[
                {"label": "Level", "key": "level", "field_type": "single_choice", "options": ["Junior", "Senior"], "help_text": "Pick", "required": True},
                {"label": "Notes", "key": "notes", "field_type": "long_text", "max_length": 300},
            ],
        )
        fields = {f["key"]: f for f in api_client.get(public(job.form_slug)).json()["fields"]}
        assert fields["level"]["options"] == ["Junior", "Senior"] and fields["level"]["required"] is True
        assert fields["level"]["help_text"] == "Pick" and fields["level"]["option_labels"] is None
        assert fields["notes"]["max_length"] == 300
        education = fields["education_level"]
        assert education["type"] == "single_choice" and education["option_labels"]["bachelor"] == "Bachelor's degree"
        assert fields["resume"]["type"] == "file" and fields["graduation_year"]["type"] == "number"
        assert set(fields["email"]) == {"key", "label", "type", "required", "options", "option_labels", "help_text", "max_length", "built_in"}

    def test_custom_fields_follow_their_order(self, team, api_client, job_factory):
        company, _ = team
        job = job_factory(company, status="open", fields=[
            {"label": "B", "key": "b", "field_type": "short_text"}, {"label": "A", "key": "a", "field_type": "short_text"},
        ])
        keys = [f["key"] for f in api_client.get(public(job.form_slug)).json()["fields"]]
        assert keys[7:] == ["b", "a"]


class TestPreview:
    def test_preview_is_exactly_what_the_public_form_returns(self, team, clients, api_client, job_factory):
        company, users = team
        job = job_factory(company, users[MemberRole.ADMIN], status="open", fields=[{"label": "X", "key": "x", "field_type": "url"}])
        preview = clients[MemberRole.VIEWER].get(job_url(job, "form-preview"))
        assert preview.status_code == 200
        assert preview.json() == api_client.get(public(job.form_slug)).json()

    def test_a_draft_can_be_previewed_and_says_it_is_not_published(self, team, clients, job_factory):
        company, _ = team
        job = job_factory(company, fields=[{"label": "X", "key": "x", "field_type": "url"}])
        body = clients[MemberRole.RECRUITER].get(job_url(job, "form-preview")).json()
        assert body["accepting"] is False and body["message"] == "This job has not been published yet."
        assert [f["key"] for f in body["fields"]] == BUILT_IN_ORDER + ["x"]

    @pytest.mark.parametrize("role", MemberRole.values)
    def test_every_member_can_preview(self, clients, team, job_factory, role):
        company, _ = team
        assert clients[role].get(job_url(job_factory(company), "form-preview")).status_code == 200

    def test_anonymous_cannot_preview(self, api_client, team, job_factory):
        company, _ = team
        assert api_client.get(job_url(job_factory(company), "form-preview")).status_code == 401

    def test_end_to_end_create_fields_preview_publish_public(self, clients, api_client):
        hr = clients[MemberRole.HR_MANAGER]
        job = hr.post(JOBS, payload(), format="json").json()
        hr.post(job_url(job["id"], "fields"), {"label": "Portfolio", "field_type": "url", "required": True}, format="json")
        hr.post(job_url(job["id"], "fields"), {"label": "Notice period", "field_type": "single_choice", "options": ["Now", "1 month"]}, format="json")
        preview = hr.get(job_url(job["id"], "form-preview")).json()
        published = hr.post(job_url(job["id"], "publish")).json()
        public_form = api_client.get(public(published["form_slug"])).json()
        assert [f["key"] for f in public_form["fields"]][7:] == ["portfolio", "notice_period"]
        assert public_form["job"] == preview["job"] and public_form["fields"] == preview["fields"]
        assert public_form["accepting"] is True and preview["accepting"] is False

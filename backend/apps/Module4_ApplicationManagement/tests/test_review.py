import csv
import io
from datetime import timedelta

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from apps.common.choices import CompanyStatus, MemberRole
from apps.Module3_JobPosting.models import ApplicationField
from apps.Module4_ApplicationManagement.models import Application

from .conftest import full_answers
from .helpers import APPLICATIONS, app_url, apply_url, form, job_url, pdf

pytestmark = pytest.mark.django_db


def apply(client, job, **overrides):
    response = client.post(apply_url(job), form(**overrides), format="multipart")
    assert response.status_code == 201, response.content
    return Application.objects.get(reference=response.json()["reference"])


@pytest.fixture
def people(api_client, open_job):
    """Three applications on one job, with different names, levels and statuses."""
    ana = apply(api_client, open_job, full_name="Ana Zaidi", email="ana@example.com", education_level="master", institution="LUMS")
    bilal = apply(api_client, open_job, full_name="Bilal Ahmed", email="bilal@example.com", education_level="bachelor", institution="NUST")
    carol = apply(api_client, open_job, full_name="Carol D'Souza", email="carol@example.com", education_level="phd", institution="IBA")
    Application.objects.filter(pk=ana.pk).update(submitted_at=timezone.now() - timedelta(days=10), status="shortlisted")
    Application.objects.filter(pk=bilal.pk).update(submitted_at=timezone.now() - timedelta(days=5))
    return {"ana": ana, "bilal": bilal, "carol": carol}


def names(response):
    return [row["full_name"] for row in response.json()["results"]]


class TestJobApplicationList:
    def test_any_member_lists_a_jobs_applications_newest_first(self, clients, open_job, people):
        for role in MemberRole.values:
            response = clients[role].get(job_url(open_job, "applications"))
            assert response.status_code == 200
            assert names(response) == ["Carol D'Souza", "Bilal Ahmed", "Ana Zaidi"]

    def test_rows_have_the_documented_columns_and_nothing_private(self, clients, open_job, people):
        row = clients[MemberRole.VIEWER].get(job_url(open_job, "applications")).json()["results"][0]
        assert set(row) == {"id", "reference", "full_name", "email", "phone", "education_level", "institution", "status", "submitted_at", "has_cv", "cv_score", "cv_label", "screening", "technical"}
        assert row["screening"] is None and row["technical"] is None
        assert row["has_cv"] is True and row["status"] == "submitted" and row["cv_score"] is None and row["cv_label"] == "analysing"

    def test_status_counts_cover_every_status(self, clients, open_job, people):
        counts = clients[MemberRole.ADMIN].get(job_url(open_job, "applications")).json()["status_counts"]
        assert counts == {
            "submitted": 2, "under_review": 0, "shortlisted": 1, "interview": 0, "selected": 0,
            "rejected": 0, "on_hold": 0, "total": 3,
        }

    def test_counts_ignore_the_filters_so_tabs_stay_stable(self, clients, open_job, people):
        body = clients[MemberRole.ADMIN].get(job_url(open_job, "applications"), {"status": "shortlisted"}).json()
        assert body["count"] == 1 and body["status_counts"]["total"] == 3

    @pytest.mark.parametrize(
        "query,expected",
        [
            ({"status": "shortlisted"}, ["Ana Zaidi"]),
            ({"status": "submitted"}, ["Carol D'Souza", "Bilal Ahmed"]),
            ({"education_level": "phd"}, ["Carol D'Souza"]),
            ({"search": "zaidi"}, ["Ana Zaidi"]),
            ({"search": "BILAL@example"}, ["Bilal Ahmed"]),
            ({"search": "d'souza"}, ["Carol D'Souza"]),
            ({"search": "nobody"}, []),
            ({"ordering": "full_name"}, ["Ana Zaidi", "Bilal Ahmed", "Carol D'Souza"]),
            ({"ordering": "-full_name"}, ["Carol D'Souza", "Bilal Ahmed", "Ana Zaidi"]),
            ({"ordering": "submitted_at"}, ["Ana Zaidi", "Bilal Ahmed", "Carol D'Souza"]),
        ],
    )
    def test_filters_search_and_ordering(self, clients, open_job, people, query, expected):
        assert names(clients[MemberRole.ADMIN].get(job_url(open_job, "applications"), query)) == expected

    def test_search_by_reference(self, clients, open_job, people):
        reference = people["bilal"].reference
        assert names(clients[MemberRole.ADMIN].get(job_url(open_job, "applications"), {"search": reference.lower()})) == ["Bilal Ahmed"]

    def test_submitted_date_range(self, clients, open_job, people):
        client = clients[MemberRole.ADMIN]
        url = job_url(open_job, "applications")
        week_ago = (timezone.now() - timedelta(days=7)).date().isoformat()
        assert names(client.get(url, {"submitted_after": week_ago})) == ["Carol D'Souza", "Bilal Ahmed"]
        assert names(client.get(url, {"submitted_before": week_ago})) == ["Ana Zaidi"]
        window = {"submitted_after": (timezone.now() - timedelta(days=6)).date().isoformat(), "submitted_before": (timezone.now() - timedelta(days=4)).date().isoformat()}
        assert names(client.get(url, window)) == ["Bilal Ahmed"]
        today = timezone.now().date().isoformat()
        assert len(names(client.get(url, {"submitted_after": today, "submitted_before": today}))) == 1  # the boundary day is inclusive

    @pytest.mark.parametrize("query", [{"status": "hired"}, {"education_level": "wizard"}, {"submitted_after": "yesterday"}])
    def test_bad_filter_values_are_400(self, clients, open_job, people, query):
        assert clients[MemberRole.ADMIN].get(job_url(open_job, "applications"), query).status_code == 400

    def test_pagination(self, clients, open_job, people):
        body = clients[MemberRole.ADMIN].get(job_url(open_job, "applications"), {"page_size": 2}).json()
        assert body["count"] == 3 and len(body["results"]) == 2 and body["next"]
        assert body["status_counts"]["total"] == 3

    def test_an_empty_job_has_zero_counts(self, clients, team, job_factory):
        company, _ = team
        job = job_factory(company, status="open")
        body = clients[MemberRole.ADMIN].get(job_url(job, "applications")).json()
        assert body["count"] == 0 and body["results"] == [] and body["status_counts"]["total"] == 0

    def test_only_that_jobs_applications(self, clients, open_job, people, team, job_factory, api_client):
        company, _ = team
        other = job_factory(company, status="open")
        apply(api_client, other, email="elsewhere@example.com", full_name="Elsewhere")
        assert "Elsewhere" not in names(clients[MemberRole.ADMIN].get(job_url(open_job, "applications")))

    def test_anonymous_and_outsiders_are_refused(self, api_client, auth_client, user_factory, open_job):
        url = job_url(open_job, "applications")
        assert api_client.get(url).status_code == 401
        assert auth_client(user_factory()).get(url).status_code == 403


class TestCompanyWideList:
    def test_lists_across_jobs_with_the_job_title(self, clients, open_job, people, team, job_factory, api_client):
        company, _ = team
        other = job_factory(company, status="open", title="Designer")
        apply(api_client, other, email="d@example.com", full_name="Dina Khan")
        response = clients[MemberRole.VIEWER].get(APPLICATIONS)
        assert response.status_code == 200 and response.json()["count"] == 4
        jobs = {row["full_name"]: row["job"] for row in response.json()["results"]}
        assert jobs["Dina Khan"] == {"id": str(other.pk), "title": "Designer"}
        assert jobs["Ana Zaidi"]["title"] == "Backend Developer"

    def test_job_filter_and_the_other_filters(self, clients, open_job, people, team, job_factory, api_client):
        company, _ = team
        other = job_factory(company, status="open", title="Designer")
        apply(api_client, other, email="d@example.com", full_name="Dina Khan", education_level="phd")
        client = clients[MemberRole.ADMIN]
        assert names(client.get(APPLICATIONS, {"job": str(other.pk)})) == ["Dina Khan"]
        assert names(client.get(APPLICATIONS, {"education_level": "phd"})) == ["Dina Khan", "Carol D'Souza"]
        assert names(client.get(APPLICATIONS, {"status": "shortlisted"})) == ["Ana Zaidi"]
        assert client.get(APPLICATIONS, {"job": "not-a-uuid"}).status_code == 400

    def test_never_shows_another_companys_applications(self, clients, people, member_factory, auth_client):
        outsider = member_factory(MemberRole.ADMIN)
        assert auth_client(outsider).get(APPLICATIONS).json()["count"] == 0
        assert clients[MemberRole.ADMIN].get(APPLICATIONS).json()["count"] == 3

    def test_suspended_company_users_lose_access(self, team, clients, people):
        company, _ = team
        company.status, company.suspension_reason = CompanyStatus.SUSPENDED, "Policy violation under review."
        company.save()
        assert clients[MemberRole.ADMIN].get(APPLICATIONS).status_code == 403


class TestDetail:
    def test_detail_has_every_built_in_field_the_cv_link_and_history(self, clients, open_job, people):
        application = people["ana"]
        body = clients[MemberRole.VIEWER].get(app_url(application)).json()
        assert body["reference"] == application.reference and body["job"] == {"id": str(open_job.pk), "title": open_job.title}
        assert (body["full_name"], body["email"], body["phone"]) == ("Ana Zaidi", "ana@example.com", "+92 300 1234567")
        assert (body["education_level"], body["institution"], body["graduation_year"]) == ("master", "LUMS", 2023)
        assert body["resume"] == {"name": "My CV.pdf", "url": f"/api/applications/{application.pk}/resume/"}
        assert body["answers"] == []
        assert [(h["from_status"], h["to_status"], h["changed_by"]) for h in body["status_history"]] == [(None, "submitted", None)]
        assert "ip_address" not in body and "user_agent" not in body and "candidate_user" not in body

    def test_answers_are_label_value_pairs_in_form_order_with_protected_file_links(self, api_client, clients, form_job):
        post = api_client.post(apply_url(form_job), full_answers(), format="multipart")
        application = Application.objects.get(reference=post.json()["reference"])
        answers = clients[MemberRole.RECRUITER].get(app_url(application)).json()["answers"]
        assert [a["key"] for a in answers] == [
            "linkedin_profile_url", "why_us", "years_of_experience", "contact_email", "available_from",
            "level", "skills", "portfolio", "nickname",
        ]
        by_key = {a["key"]: a for a in answers}
        assert by_key["why_us"] == {"key": "why_us", "label": "Why us", "type": "long_text", "value": "Great team and interesting problems."}
        assert by_key["skills"]["value"] == ["Python", "SQL"] and by_key["years_of_experience"]["value"] == 3.5
        assert by_key["portfolio"]["value"] == {"name": "portfolio.pdf", "url": f"/api/applications/{application.pk}/files/portfolio/"}

    def test_a_renamed_field_shows_its_new_label_and_a_new_field_shows_empty(self, api_client, clients, form_job):
        application = Application.objects.get(reference=api_client.post(apply_url(form_job), full_answers(), format="multipart").json()["reference"])
        ApplicationField.objects.filter(job=form_job, key="why_us").update(label="Why are you interested?")
        ApplicationField.objects.create(job=form_job, label="Added later", key="added_later", field_type="short_text", order=99)
        answers = {a["key"]: a for a in clients[MemberRole.ADMIN].get(app_url(application)).json()["answers"]}
        assert answers["why_us"]["label"] == "Why are you interested?" and answers["why_us"]["value"]
        assert answers["added_later"]["value"] is None

    def test_unknown_application_is_404(self, clients):
        assert clients[MemberRole.ADMIN].get(f"{APPLICATIONS}00000000-0000-0000-0000-000000000000/").status_code == 404

    def test_anonymous_is_401(self, api_client, people):
        assert api_client.get(app_url(people["ana"])).status_code == 401


class TestStatusChange:
    def patch(self, client, application, **body):
        return client.patch(app_url(application, "status"), body, format="json")

    @pytest.mark.parametrize("role", [MemberRole.ADMIN, MemberRole.HR_MANAGER, MemberRole.RECRUITER])
    def test_editors_change_the_status_and_a_history_row_is_written(self, team, clients, people, role):
        _, users = team
        application = people["bilal"]
        response = self.patch(clients[role], application, status="under_review", note="Looks promising")
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "under_review"
        last = body["status_history"][-1]
        assert (last["from_status"], last["to_status"], last["note"]) == ("submitted", "under_review", "Looks promising")
        assert last["changed_by"] == {"id": str(users[role].pk), "full_name": users[role].full_name}
        application.refresh_from_db()
        assert application.status == "under_review" and application.status_history.count() == 2

    def test_the_viewer_cannot_change_status(self, clients, people):
        response = self.patch(clients[MemberRole.VIEWER], people["bilal"], status="rejected")
        assert response.status_code == 403 and response.json()["detail"] == "Unauthorized access."
        people["bilal"].refresh_from_db()
        assert people["bilal"].status == "submitted"

    def test_anonymous_is_401(self, api_client, people):
        assert self.patch(api_client, people["bilal"], status="rejected").status_code == 401

    def test_the_whole_pipeline_in_any_order_keeps_a_chain_of_history(self, clients, people):
        client, application = clients[MemberRole.ADMIN], people["bilal"]
        path = ["under_review", "shortlisted", "interview", "on_hold", "interview", "selected", "rejected", "submitted"]
        for status in path:
            assert self.patch(client, application, status=status).status_code == 200
        history = list(application.status_history.values_list("from_status", "to_status"))
        chain = [h[1] for h in history]
        assert chain == ["submitted"] + path
        assert all(history[i][0] == history[i - 1][1] for i in range(1, len(history)))

    @pytest.mark.parametrize("body", [{"status": "hired"}, {"status": ""}, {}, {"status": "under_review", "note": "x" * 1001}])
    def test_invalid_input_is_400_and_changes_nothing(self, clients, people, body):
        response = self.patch(clients[MemberRole.ADMIN], people["bilal"], **body)
        assert response.status_code == 400
        assert people["bilal"].status_history.count() == 1

    def test_setting_the_same_status_is_400_and_adds_no_history(self, clients, people):
        response = self.patch(clients[MemberRole.ADMIN], people["bilal"], status="submitted")
        assert response.status_code == 400 and "status" in response.json()
        assert people["bilal"].status_history.count() == 1

    def test_the_note_is_optional(self, clients, people):
        response = self.patch(clients[MemberRole.ADMIN], people["bilal"], status="rejected")
        assert response.status_code == 200 and response.json()["status_history"][-1]["note"] == ""

    def test_no_email_is_sent_to_the_candidate_in_phase_1(self, clients, people, django_capture_on_commit_callbacks):
        from django.core import mail

        mail.outbox.clear()
        with django_capture_on_commit_callbacks(execute=True):
            self.patch(clients[MemberRole.ADMIN], people["bilal"], status="shortlisted")
        assert mail.outbox == []

    def test_only_patch_is_allowed(self, clients, people):
        client = clients[MemberRole.ADMIN]
        assert client.put(app_url(people["bilal"], "status"), {"status": "rejected"}, format="json").status_code == 405
        assert client.post(app_url(people["bilal"], "status"), {"status": "rejected"}, format="json").status_code == 405

    def test_the_status_filter_follows_changes(self, clients, open_job, people):
        self.patch(clients[MemberRole.ADMIN], people["carol"], status="interview")
        assert names(clients[MemberRole.ADMIN].get(job_url(open_job, "applications"), {"status": "interview"})) == ["Carol D'Souza"]
        assert clients[MemberRole.ADMIN].get(job_url(open_job, "applications")).json()["status_counts"]["interview"] == 1


class TestDownloads:
    def test_resume_download_for_every_member_role(self, clients, people):
        for role in MemberRole.values:
            response = clients[role].get(app_url(people["ana"], "resume"))
            assert response.status_code == 200 and "My CV.pdf" in response["Content-Disposition"]
            assert response["Cache-Control"] == "private, no-store"
            assert b"".join(response.streaming_content).startswith(b"%PDF")

    def test_custom_file_download_with_the_original_name(self, api_client, clients, form_job):
        data = full_answers(portfolio=SimpleUploadedFile("my portfolio.pdf", pdf("x", "portfolio body").read(), content_type="application/pdf"))
        application = Application.objects.get(reference=api_client.post(apply_url(form_job), data, format="multipart").json()["reference"])
        response = clients[MemberRole.VIEWER].get(app_url(application, "files/portfolio"))
        assert response.status_code == 200 and 'filename="my portfolio.pdf"' in response["Content-Disposition"]
        assert b"portfolio body" in b"".join(response.streaming_content)

    def test_unknown_file_key_and_missing_answer_are_404(self, api_client, clients, form_job, people):
        application = Application.objects.get(reference=api_client.post(apply_url(form_job), full_answers(portfolio=None), format="multipart").json()["reference"])
        assert clients[MemberRole.ADMIN].get(app_url(application, "files/portfolio")).status_code == 404
        assert clients[MemberRole.ADMIN].get(app_url(application, "files/nope")).status_code == 404

    def test_anonymous_cannot_download(self, api_client, people):
        assert api_client.get(app_url(people["ana"], "resume")).status_code == 401

    def test_candidates_cannot_download_even_their_own(self, auth_client, user_factory, api_client, open_job):
        candidate = user_factory()
        application = apply(auth_client(candidate), open_job)
        assert auth_client(candidate).get(app_url(application, "resume")).status_code == 403


class TestExport:
    def rows(self, response):
        text = b"".join(response.streaming_content).decode("utf-8-sig")
        return list(csv.reader(io.StringIO(text)))

    def test_csv_has_built_in_and_custom_columns(self, api_client, clients, form_job):
        api_client.post(apply_url(form_job), full_answers(), format="multipart")
        response = clients[MemberRole.VIEWER].get(job_url(form_job, "applications/export"))
        assert response.status_code == 200 and response["Content-Type"].startswith("text/csv")
        assert response["Content-Disposition"].startswith("attachment; filename=\"applications-") and response["Cache-Control"] == "private, no-store"
        rows = self.rows(response)
        assert rows[0] == [
            "Reference", "Full name", "Email", "Phone", "Education level", "Institution", "Graduation year", "Status", "Submitted at",
            "LinkedIn Profile URL", "Why us", "Years of experience", "Contact email", "Available from", "Level", "Skills", "Portfolio", "Nickname",
        ]
        row = dict(zip(rows[0], rows[1]))
        assert row["Full name"] == "Sara Malik" and row["Skills"] == "Python; SQL" and row["Portfolio"] == "portfolio.pdf"
        assert row["Years of experience"] == "3.5" and row["Level"] == "Senior" and row["Status"] == "submitted"

    def test_csv_lists_every_application_newest_first(self, clients, open_job, people):
        rows = self.rows(clients[MemberRole.ADMIN].get(job_url(open_job, "applications/export")))
        assert [r[1] for r in rows[1:]] == ["Carol D'Souza", "Bilal Ahmed", "Ana Zaidi"]

    def test_an_empty_job_exports_only_the_header(self, clients, team, job_factory):
        company, _ = team
        rows = self.rows(clients[MemberRole.ADMIN].get(job_url(job_factory(company, status="open"), "applications/export")))
        assert len(rows) == 1

    def test_formula_injection_is_neutralised_but_phone_numbers_survive(self, api_client, clients, open_job):
        apply(api_client, open_job, full_name="=HYPERLINK(\"http://evil.example\")", institution="@SUM(1+1)", phone="+92 300 1234567")
        rows = self.rows(clients[MemberRole.ADMIN].get(job_url(open_job, "applications/export")))
        row = dict(zip(rows[0], rows[1]))
        assert row["Full name"].startswith("'=") and row["Institution"].startswith("'@")
        assert row["Phone"] == "+92 300 1234567"

    def test_export_is_scoped_and_authenticated(self, api_client, auth_client, user_factory, open_job):
        assert api_client.get(job_url(open_job, "applications/export")).status_code == 401
        assert auth_client(user_factory()).get(job_url(open_job, "applications/export")).status_code == 403

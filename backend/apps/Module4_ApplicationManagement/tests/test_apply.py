import re
import smtplib
from datetime import timedelta
from unittest import mock

import pytest
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import OperationalError
from django.utils import timezone

from apps.common.choices import CompanyStatus, MemberRole
from apps.common.tests.helpers import make_image
from apps.Module3_JobPosting.models import JobPosting
from apps.Module4_ApplicationManagement.models import Application, ApplicationFile, ApplicationStatusChange
from apps.Module4_ApplicationManagement.services import submission

from .conftest import full_answers
from .helpers import app_url, apply_url, docx, form, pdf, stored_files

pytestmark = pytest.mark.django_db


def post(client, job, data=None, **kwargs):
    return client.post(apply_url(job), form() if data is None else data, format="multipart", **kwargs)


class TestTC17Submit:
    def test_tc17_valid_submission_returns_201_and_links_the_application_to_the_job(self, api_client, open_job):
        response = post(api_client, open_job)
        assert response.status_code == 201
        body = response.json()
        assert set(body) == {"reference", "job_title", "company", "submitted_at"}
        assert re.fullmatch(r"IH-[A-HJ-NP-Z2-9]{6}", body["reference"])
        assert body["job_title"] == "Backend Developer" and body["company"] == open_job.company.name
        application = Application.objects.get()
        assert application.job == open_job and application.reference == body["reference"]
        assert (application.full_name, application.email, application.phone) == ("Sara Malik", "sara.malik@example.com", "+92 300 1234567")
        assert (application.education_level, application.institution, application.graduation_year) == ("bachelor", "FAST NUCES", 2023)
        assert application.status == "submitted" and application.answers == {} and application.candidate_user is None

    def test_first_status_history_row_is_written(self, api_client, open_job):
        post(api_client, open_job)
        change = ApplicationStatusChange.objects.get()
        assert (change.from_status, change.to_status, change.changed_by) == ("", "submitted", None)

    def test_no_account_is_needed(self, api_client, open_job):
        api_client.credentials()
        assert post(api_client, open_job).status_code == 201

    def test_a_bad_bearer_token_does_not_break_a_public_submission(self, api_client, open_job):
        api_client.credentials(HTTP_AUTHORIZATION="Bearer garbage")
        assert post(api_client, open_job).status_code == 201

    def test_ip_and_user_agent_are_recorded_for_abuse_checks(self, api_client, open_job):
        post(api_client, open_job, HTTP_USER_AGENT="TestBrowser/1.0", REMOTE_ADDR="203.0.113.7")
        application = Application.objects.get()
        assert application.ip_address == "203.0.113.7" and application.user_agent == "TestBrowser/1.0"

    def test_extra_whitespace_is_trimmed(self, api_client, open_job):
        post(api_client, open_job, form(full_name="  Sara Malik  ", institution=" FAST "))
        application = Application.objects.get()
        assert application.full_name == "Sara Malik" and application.institution == "FAST"

    def test_references_are_unique_and_collisions_are_retried(self, api_client, open_job):
        post(api_client, open_job)
        taken = Application.objects.get().reference
        with mock.patch.object(submission, "new_reference", side_effect=[taken, taken, "IH-FRESH2"]):
            response = post(api_client, open_job, form(email="other@example.com"))
        assert response.status_code == 201 and response.json()["reference"] == "IH-FRESH2"

    def test_a_docx_cv_is_accepted(self, api_client, open_job):
        assert post(api_client, open_job, form(resume=docx())).status_code == 201

    def test_the_same_email_may_apply_to_two_different_jobs(self, api_client, open_job, team, job_factory):
        company, _ = team
        other = job_factory(company, status="open")
        assert post(api_client, open_job).status_code == 201
        assert post(api_client, other).status_code == 201
        assert Application.objects.count() == 2


class TestTC18PrivateStorage:
    def test_tc18_cv_is_stored_under_a_random_name_in_a_private_folder_and_hr_downloads_it_with_the_original_name(
        self, api_client, clients, open_job
    ):
        post(api_client, open_job, form(resume=pdf("Sara Malik CV.pdf", "unique resume text")))
        application = Application.objects.get()
        assert re.fullmatch(rf"applications/{open_job.pk}/[0-9a-f]{{32}}\.pdf", application.resume.name)
        assert "Sara" not in application.resume.name and application.resume_original_name == "Sara Malik CV.pdf"
        assert len(stored_files(open_job)) == 1

        response = clients[MemberRole.RECRUITER].get(app_url(application, "resume"))
        assert response.status_code == 200
        assert 'filename="Sara Malik CV.pdf"' in response["Content-Disposition"] and "attachment" in response["Content-Disposition"]
        assert response["Cache-Control"] == "private, no-store"
        assert b"unique resume text" in b"".join(response.streaming_content)

    def test_the_stored_file_is_not_reachable_through_a_public_url(self, api_client, open_job, settings):
        post(api_client, open_job)
        application = Application.objects.get()
        for prefix in ("/media/", "/private_media/", "/static/"):
            assert api_client.get(prefix + application.resume.name).status_code == 404
        with pytest.raises(ValueError):
            application.resume.url

    def test_two_applicants_with_the_same_file_name_get_different_stored_files(self, api_client, open_job):
        post(api_client, open_job, form(resume=pdf("cv.pdf")))
        post(api_client, open_job, form(email="b@example.com", resume=pdf("cv.pdf")))
        names = list(Application.objects.values_list("resume", flat=True))
        assert len(set(names)) == 2


class TestTC19InvalidCv:
    @pytest.mark.parametrize(
        "upload,message",
        [
            (SimpleUploadedFile("photo.jpg", make_image("JPEG"), content_type="image/jpeg"), "Only PDF and DOCX files are accepted."),
            (SimpleUploadedFile("cv.pdf", make_image("PNG"), content_type="application/pdf"), "Only PDF and DOCX files are accepted."),
            (SimpleUploadedFile("cv.docx", b"%PDF-1.4 not a zip", content_type="application/octet-stream"), "Only PDF and DOCX files are accepted."),
            (SimpleUploadedFile("cv.doc", b"\xd0\xcf\x11\xe0 old word", content_type="application/msword"), "Only PDF and DOCX files are accepted."),
            (SimpleUploadedFile("cv.exe", b"MZ....", content_type="application/octet-stream"), "Only PDF and DOCX files are accepted."),
            (SimpleUploadedFile("cv.pdf", b"%PDF" + b"0" * (5 * 1024 * 1024 + 1), content_type="application/pdf"), "File must be 5 MB or smaller."),
        ],
    )
    def test_tc19_wrong_or_oversized_cv_is_400_and_creates_nothing(self, api_client, open_job, upload, message):
        before = len(stored_files(open_job))
        response = post(api_client, open_job, form(resume=upload))
        assert response.status_code == 400 and response.json()["resume"] == [message]
        assert Application.objects.count() == 0 and len(stored_files(open_job)) == before

    def test_a_cv_exactly_at_the_limit_is_accepted(self, api_client, open_job):
        exact = SimpleUploadedFile("cv.pdf", b"%PDF" + b"0" * (5 * 1024 * 1024 - 4), content_type="application/pdf")
        assert post(api_client, open_job, form(resume=exact)).status_code == 201


class TestTC20Validation:
    def test_tc20_missing_email_is_reported_by_name_with_every_other_missing_field(self, api_client, open_job):
        response = post(api_client, open_job, {})
        assert response.status_code == 400
        body = response.json()
        assert body["email"] == ["Email is required."]
        assert set(body) == {"full_name", "email", "phone", "education_level", "institution", "graduation_year", "resume"}
        assert body["resume"] == ["CV is required."] and body["full_name"] == ["Full name is required."]
        assert Application.objects.count() == 0

    def test_only_the_missing_email_is_reported_when_the_rest_is_valid(self, api_client, open_job):
        response = post(api_client, open_job, form(email=""))
        assert response.status_code == 400 and response.json() == {"email": ["Email is required."]}

    @pytest.mark.parametrize(
        "overrides,key,message",
        [
            ({"email": "not-an-email"}, "email", "Enter a valid email address."),
            ({"email": "a@b"}, "email", "Enter a valid email address."),
            ({"email": "x" * 250 + "@a.com"}, "email", "Enter a valid email address."),
            ({"phone": "abc123"}, "phone", "Enter a valid phone number."),
            ({"phone": "12345"}, "phone", "Enter a valid phone number."),
            ({"phone": "1" * 21}, "phone", "Enter a valid phone number."),
            ({"full_name": "x" * 151}, "full_name", "Full name must be 150 characters or fewer."),
            ({"institution": "x" * 201}, "institution", "Institution must be 200 characters or fewer."),
            ({"education_level": "wizard"}, "education_level", "Select a valid education level."),
            ({"graduation_year": "1969"}, "graduation_year", None),
            ({"graduation_year": "abc"}, "graduation_year", None),
            ({"graduation_year": "2999"}, "graduation_year", None),
            ({"graduation_year": "20.5"}, "graduation_year", None),
        ],
    )
    def test_built_in_field_rules(self, api_client, open_job, overrides, key, message):
        response = post(api_client, open_job, form(**overrides))
        assert response.status_code == 400 and list(response.json()) == [key]
        if message:
            assert response.json()[key] == [message]

    @pytest.mark.parametrize("year", ["1970", "2023", str(timezone.now().year + 6)])
    def test_graduation_year_limits_are_inclusive(self, api_client, open_job, year):
        assert post(api_client, open_job, form(graduation_year=year)).status_code == 201

    def test_all_problems_come_back_together(self, api_client, open_job):
        response = post(api_client, open_job, form(email="bad", phone="x", graduation_year="1900", resume=None))
        assert set(response.json()) == {"email", "phone", "graduation_year", "resume"}


class TestTC21ConfirmationEmail:
    def test_tc21_confirmation_has_job_title_company_time_and_reference(self, api_client, open_job, django_capture_on_commit_callbacks):
        with django_capture_on_commit_callbacks(execute=True):
            response = post(api_client, open_job)
        assert len(mail.outbox) == 1
        message = mail.outbox[0]
        application = Application.objects.get()
        assert message.to == ["sara.malik@example.com"]
        assert open_job.title in message.subject and open_job.company.name in message.subject
        for needle in (open_job.title, open_job.company.name, application.reference, "Sara Malik", application.submitted_at.strftime("%d %B %Y, %H:%M UTC")):
            assert needle in message.body
        assert response.json()["reference"] in message.body

    def test_no_email_is_sent_for_a_rejected_submission(self, api_client, open_job, django_capture_on_commit_callbacks):
        with django_capture_on_commit_callbacks(execute=True):
            post(api_client, open_job, form(email=""))
        assert mail.outbox == []

    def test_a_failing_mail_server_never_fails_the_application(self, api_client, open_job, django_capture_on_commit_callbacks):
        with mock.patch("django.core.mail.message.EmailMultiAlternatives.send", side_effect=smtplib.SMTPException("down")):
            with django_capture_on_commit_callbacks(execute=True):
                response = post(api_client, open_job)
        assert response.status_code == 201 and Application.objects.count() == 1


class TestTC16Closed:
    @pytest.mark.parametrize("how", ["closed", "deadline_passed", "suspended_company", "rejected_company"])
    def test_tc16_submissions_are_refused_with_410_once_not_accepting(self, api_client, team, job_factory, how):
        company, _ = team
        if how == "closed":
            job = job_factory(company, status="closed")
        elif how == "deadline_passed":
            job = job_factory(company, status="open", deadline=timezone.now() - timedelta(minutes=1))
        else:
            job = job_factory(company, status="open")
            company.status = CompanyStatus.SUSPENDED if how == "suspended_company" else CompanyStatus.REJECTED
            company.suspension_reason = company.rejection_reason = "A documented reason for this."
            company.save()
        response = post(api_client, job)
        assert response.status_code == 410
        assert response.json()["detail"] == "This position is no longer accepting applications."
        assert Application.objects.count() == 0 and stored_files(job) == []

    def test_the_form_left_open_past_the_deadline_cannot_sneak_in(self, api_client, open_job):
        assert api_client.get(f"/api/public/jobs/{open_job.form_slug}/").json()["accepting"] is True
        JobPosting.objects.filter(pk=open_job.pk).update(deadline=timezone.now() - timedelta(seconds=1))
        assert post(api_client, open_job).status_code == 410

    def test_a_reopened_job_accepts_again(self, api_client, team, job_factory):
        company, _ = team
        job = job_factory(company, status="closed")
        JobPosting.objects.filter(pk=job.pk).update(status="open", close_reason=None, closed_at=None, deadline=timezone.now() + timedelta(days=3))
        assert post(api_client, job).status_code == 201

    def test_unknown_slug_and_missing_slug_are_404(self, api_client):
        assert api_client.post(apply_url("does-not-exist"), form(), format="multipart").status_code == 404

    def test_a_draft_cannot_be_applied_to(self, api_client, team, job_factory):
        company, _ = team
        draft = job_factory(company)
        assert api_client.post(apply_url(str(draft.pk)), form(), format="multipart").status_code == 404

    def test_closed_wins_over_validation_errors(self, api_client, team, job_factory):
        company, _ = team
        job = job_factory(company, status="closed")
        assert post(api_client, job, {}).status_code == 410


class TestDuplicates:
    def test_the_same_email_cannot_apply_twice_to_one_job(self, api_client, open_job):
        assert post(api_client, open_job).status_code == 201
        response = post(api_client, open_job, form(email="  SARA.MALIK@example.COM "))
        assert response.status_code == 400
        assert response.json() == {"email": ["You have already applied for this position with this email."]}
        assert Application.objects.count() == 1

    def test_the_duplicate_message_comes_with_other_problems(self, api_client, open_job):
        post(api_client, open_job)
        response = post(api_client, open_job, form(phone="x"))
        assert set(response.json()) == {"email", "phone"}

    def test_a_rejected_duplicate_leaves_no_extra_file(self, api_client, open_job):
        post(api_client, open_job)
        before = len(stored_files(open_job))
        post(api_client, open_job)
        assert len(stored_files(open_job)) == before == 1


class TestCustomFields:
    def test_every_field_type_is_stored_in_form_order(self, api_client, form_job):
        response = post(api_client, form_job, full_answers())
        assert response.status_code == 201, response.content
        application = Application.objects.get()
        assert application.answers == {
            "linkedin_profile_url": "https://linkedin.com/in/sara",
            "why_us": "Great team and interesting problems.",
            "years_of_experience": 3.5,
            "contact_email": "sara@home.example",
            "available_from": "2026-12-01",
            "level": "Senior",
            "skills": ["Python", "SQL"],
            "nickname": "Sari",
        }
        record = ApplicationFile.objects.get()
        assert (record.field_key, record.original_name) == ("portfolio", "portfolio.pdf")
        assert re.fullmatch(rf"applications/{form_job.pk}/[0-9a-f]{{32}}\.pdf", record.file.name)
        assert len(stored_files(form_job)) == 2

    def test_optional_fields_may_be_left_out(self, api_client, form_job):
        data = full_answers()
        for key in ("linkedin_profile_url", "years_of_experience", "contact_email", "available_from", "skills", "portfolio", "nickname"):
            data.pop(key)
        assert post(api_client, form_job, data).status_code == 201
        assert set(Application.objects.get().answers) == {"why_us", "level"}
        assert ApplicationFile.objects.count() == 0

    def test_required_custom_fields_are_named_by_their_label(self, api_client, form_job):
        data = full_answers()
        data.pop("why_us")
        data.pop("level")
        response = post(api_client, form_job, data)
        assert response.status_code == 400
        assert response.json() == {"why_us": ["Why us is required."], "level": ["Level is required."]}

    @pytest.mark.parametrize(
        "key,value,message",
        [
            ("linkedin_profile_url", "not a url", "LinkedIn Profile URL must be a valid URL starting with http:// or https://."),
            ("linkedin_profile_url", "ftp://x.example", "LinkedIn Profile URL must be a valid URL starting with http:// or https://."),
            ("why_us", "x" * 201, "Why us must be 200 characters or fewer."),
            ("years_of_experience", "three", "Years of experience must be a number."),
            ("years_of_experience", "NaN", "Years of experience must be a number."),
            ("years_of_experience", "Infinity", "Years of experience must be a number."),
            ("contact_email", "nope", "Contact email must be a valid email address."),
            ("available_from", "01/12/2026", "Available from must be a date in YYYY-MM-DD format."),
            ("available_from", "2026-13-40", "Available from must be a date in YYYY-MM-DD format."),
            ("level", "Lead", "Select a valid option for Level."),
            ("level", "senior", "Select a valid option for Level."),
            ("skills", ["Python", "Rust"], "Select valid options for Skills."),
            ("nickname", "x" * 11, "Nickname must be 10 characters or fewer."),
        ],
    )
    def test_each_field_type_is_validated_by_its_own_rule(self, api_client, form_job, key, value, message):
        response = post(api_client, form_job, full_answers(**{key: value}))
        assert response.status_code == 400 and response.json() == {key: [message]}
        assert Application.objects.count() == 0 and stored_files(form_job) == []

    def test_text_limits_default_to_255_and_5000_without_a_max_length(self, api_client, team, job_factory):
        company, _ = team
        job = job_factory(company, status="open", fields=[
            {"label": "Short", "key": "short", "field_type": "short_text"},
            {"label": "Long", "key": "long", "field_type": "long_text"},
        ])
        too_short = post(api_client, job, form(short="x" * 256))
        assert too_short.json() == {"short": ["Short must be 255 characters or fewer."]}
        too_long = post(api_client, job, form(long="x" * 5001))
        assert too_long.json() == {"long": ["Long must be 5000 characters or fewer."]}
        assert post(api_client, job, form(short="x" * 255, long="y" * 5000)).status_code == 201

    @pytest.mark.parametrize("value,expected", [("42", 42), ("3.50", 3.5), ("-7", -7), ("1e3", 1000), ("0", 0)])
    def test_numbers_are_parsed(self, api_client, form_job, value, expected):
        post(api_client, form_job, full_answers(years_of_experience=value))
        assert Application.objects.get().answers["years_of_experience"] == expected

    def test_multiple_choice_uses_repeated_keys_and_ignores_duplicates(self, api_client, form_job):
        post(api_client, form_job, full_answers(skills=["SQL", "Go", "SQL"]))
        assert Application.objects.get().answers["skills"] == ["SQL", "Go"]

    def test_one_value_for_a_multiple_choice_field_is_a_list_of_one(self, api_client, form_job):
        post(api_client, form_job, full_answers(skills="Go"))
        assert Application.objects.get().answers["skills"] == ["Go"]

    def test_unknown_keys_are_ignored(self, api_client, form_job):
        data = full_answers(not_a_field="sneaky", status="shortlisted", job="x", reference="IH-HACKED")
        response = post(api_client, form_job, data)
        assert response.status_code == 201
        application = Application.objects.get()
        assert "not_a_field" not in application.answers and application.status == "submitted"
        assert application.reference != "IH-HACKED"

    def test_a_custom_file_must_pass_the_file_validator(self, api_client, form_job):
        bad = SimpleUploadedFile("evil.exe", b"MZ....", content_type="application/octet-stream")
        response = post(api_client, form_job, full_answers(portfolio=bad))
        assert response.status_code == 400 and response.json() == {"portfolio": ["Only PDF and DOCX files are accepted."]}
        assert stored_files(form_job) == []

    def test_a_required_custom_file_is_enforced(self, api_client, team, job_factory):
        company, _ = team
        job = job_factory(company, status="open", fields=[{"label": "Transcript", "key": "transcript", "field_type": "file", "required": True}])
        assert post(api_client, job).json() == {"transcript": ["Transcript is required."]}

    def test_a_file_sent_for_a_text_field_does_not_count_as_text(self, api_client, form_job):
        data = full_answers(nickname=None)
        data["nickname"] = pdf("nick.pdf")
        assert post(api_client, form_job, data).status_code == 201
        assert "nickname" not in Application.objects.get().answers

    def test_a_file_part_for_an_unknown_key_is_not_stored(self, api_client, form_job):
        data = full_answers(surprise=pdf("surprise.pdf"))
        post(api_client, form_job, data)
        assert ApplicationFile.objects.count() == 1 and len(stored_files(form_job)) == 2


class TestAbuseProtection:
    def test_the_honeypot_gets_a_fake_success_and_saves_nothing(self, api_client, open_job, django_capture_on_commit_callbacks):
        with django_capture_on_commit_callbacks(execute=True):
            response = post(api_client, open_job, form(**{"hp-website": "http://spam.example"}))
        assert response.status_code == 201
        assert set(response.json()) == {"reference", "job_title", "company", "submitted_at"}
        assert Application.objects.count() == 0 and mail.outbox == [] and stored_files(open_job) == []

    def test_an_empty_honeypot_is_fine(self, api_client, open_job):
        assert post(api_client, open_job, form(**{"hp-website": ""})).status_code == 201

    def test_submissions_are_throttled_per_ip(self, api_client, open_job):
        statuses = [post(api_client, open_job, form(email=f"p{i}@example.com")).status_code for i in range(11)]
        assert statuses[:10] == [201] * 10 and statuses[10] == 429
        assert Application.objects.count() == 10

    def test_a_different_ip_has_its_own_budget(self, api_client, open_job):
        for i in range(10):
            post(api_client, open_job, form(email=f"p{i}@example.com"), REMOTE_ADDR="198.51.100.1")
        assert post(api_client, open_job, form(email="late@example.com"), REMOTE_ADDR="198.51.100.2").status_code == 201

    def test_an_oversized_request_is_413_before_anything_is_stored(self, api_client, open_job):
        big = SimpleUploadedFile("cv.pdf", b"%PDF" + b"0" * (13 * 1024 * 1024), content_type="application/pdf")
        response = post(api_client, open_job, form(resume=big))
        assert response.status_code == 413 and response.json()["code"] == "request_too_large"
        assert Application.objects.count() == 0 and stored_files(open_job) == []

    def test_only_multipart_is_accepted(self, api_client, open_job):
        response = api_client.post(apply_url(open_job), {"full_name": "x"}, format="json")
        assert response.status_code == 415

    def test_only_post_is_allowed(self, api_client, open_job):
        assert api_client.get(apply_url(open_job)).status_code == 405
        assert api_client.delete(apply_url(open_job)).status_code == 405


class TestCandidateLink:
    def test_a_logged_in_candidate_is_linked_but_never_required(self, auth_client, user_factory, open_job):
        candidate = user_factory()
        assert post(auth_client(candidate), open_job).status_code == 201
        assert Application.objects.get().candidate_user == candidate

    def test_a_company_user_token_is_not_linked(self, clients, open_job):
        assert post(clients[MemberRole.RECRUITER], open_job).status_code == 201
        assert Application.objects.get().candidate_user is None

    def test_a_suspended_candidate_token_still_lets_the_application_through_unlinked(self, auth_client, user_factory, open_job):
        candidate = user_factory()
        client = auth_client(candidate)
        candidate.status = "suspended"
        candidate.save()
        assert post(client, open_job).status_code == 201
        assert Application.objects.get().candidate_user is None


class TestAtomicity:
    def test_a_temporary_database_error_is_retried_once(self, api_client, open_job):
        real_save = Application.save
        calls = {"n": 0}

        def flaky(self, *args, **kwargs):
            calls["n"] += 1
            if calls["n"] == 1:
                raise OperationalError("connection reset")
            return real_save(self, *args, **kwargs)

        with mock.patch.object(Application, "save", flaky):
            response = post(api_client, open_job)
        assert response.status_code == 201 and Application.objects.count() == 1
        assert len(stored_files(open_job)) == 1  # the first attempt's file was removed

    def test_a_second_failure_gives_503_and_leaves_no_record_and_no_orphan_file(self, api_client, open_job):
        before = stored_files(open_job)
        with mock.patch.object(Application, "save", side_effect=OperationalError("down")):
            response = post(api_client, open_job)
        assert response.status_code == 503
        assert response.json()["detail"] == "We could not save your application. Please try again."
        assert Application.objects.count() == 0 and ApplicationStatusChange.objects.count() == 0
        assert stored_files(open_job) == before

    def test_a_failure_while_saving_a_custom_file_rolls_everything_back(self, api_client, form_job):
        with mock.patch.object(ApplicationFile, "save", side_effect=OperationalError("down")):
            response = post(api_client, form_job, full_answers())
        assert response.status_code == 503
        assert Application.objects.count() == 0 and ApplicationFile.objects.count() == 0 and stored_files(form_job) == []

    def test_a_failure_writing_the_history_row_rolls_everything_back(self, api_client, open_job):
        with mock.patch.object(ApplicationStatusChange.objects, "create", side_effect=OperationalError("down")):
            response = post(api_client, open_job)
        assert response.status_code == 503
        assert Application.objects.count() == 0 and stored_files(open_job) == []

    def test_an_unexpected_error_is_not_swallowed_and_cleans_up(self, api_client, open_job):
        api_client.raise_request_exception = False
        with mock.patch.object(ApplicationStatusChange.objects, "create", side_effect=RuntimeError("bug")):
            response = post(api_client, open_job)
        assert response.status_code == 500
        assert Application.objects.count() == 0 and stored_files(open_job) == []

    def test_the_message_of_a_failure_does_not_leak_internals(self, api_client, open_job):
        with mock.patch.object(Application, "save", side_effect=OperationalError("secret-host-name")):
            response = post(api_client, open_job)
        assert "secret-host-name" not in response.content.decode()

"""Owner decision D-073: candidate sign-up also takes the optional profile answers (target role, skills,
links, CV), all created together with the account."""
import re
from pathlib import Path
from unittest import mock

import pytest
from django.conf import settings
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import DatabaseError

from apps.Module1_Authentication.models import CandidateProfile, User
from apps.common.tests.helpers import code_in, make_docx, make_image, make_pdf

pytestmark = pytest.mark.django_db
URL = "/api/auth/register/candidate/"
PASSWORD = "Sunny-Day-4711"


def payload(**overrides):
    data = {"full_name": "Ayesha Khan", "email": "ayesha@example.com", "password": PASSWORD, "confirm_password": PASSWORD}
    data.update(overrides)
    return data


def pdf(name="My CV.pdf", text="Resume body text"):
    return SimpleUploadedFile(name, make_pdf(text), content_type="application/pdf")


def resumes_on_disk():
    folder = Path(settings.PRIVATE_MEDIA_ROOT) / "resumes"
    return sorted(p.name for p in folder.glob("*")) if folder.exists() else []


class TestJsonSignUp:
    def test_optional_profile_fields_are_stored_with_the_account(self, api_client):
        response = api_client.post(URL, payload(
            target_role="Backend Developer", skills=["Python", " python ", "SQL"],
            linkedin_url="https://linkedin.com/in/ayesha", github_url="https://github.com/ayesha",
        ), format="json")
        assert response.status_code == 201 and response.json() == {"email": "ayesha@example.com", "status": "pending_verification"}
        profile = CandidateProfile.objects.get(user__email="ayesha@example.com")
        assert profile.target_role == "Backend Developer" and profile.skills == ["Python", "SQL"]
        assert profile.linkedin_url == "https://linkedin.com/in/ayesha" and profile.github_url == "https://github.com/ayesha"
        assert not profile.resume

    def test_the_old_minimal_payload_still_works(self, api_client):
        assert api_client.post(URL, payload(), format="json").status_code == 201
        profile = CandidateProfile.objects.get()
        assert (profile.target_role, profile.skills, profile.linkedin_url) == ("", [], "")

    def test_blank_optional_fields_are_fine(self, api_client):
        assert api_client.post(URL, payload(target_role="", linkedin_url="", github_url="", skills=[]), format="json").status_code == 201

    @pytest.mark.parametrize(
        "overrides,field",
        [
            ({"target_role": "x" * 101}, "target_role"),
            ({"linkedin_url": "not a url"}, "linkedin_url"),
            ({"github_url": "javascript:alert(1)"}, "github_url"),
            ({"linkedin_url": "https://x.example/" + "a" * 300}, "linkedin_url"),
            ({"skills": [f"s{i}" for i in range(21)]}, "skills"),
            ({"skills": ["x" * 51]}, "skills"),
            ({"skills": "Python"}, "skills"),
        ],
    )
    def test_invalid_profile_fields_are_400_and_create_nothing(self, api_client, overrides, field):
        response = api_client.post(URL, payload(**overrides), format="json")
        assert response.status_code == 400 and field in response.json()
        assert User.objects.count() == 0 and CandidateProfile.objects.count() == 0

    def test_server_owned_fields_in_the_body_are_ignored(self, api_client):
        api_client.post(URL, payload(role="platform_admin", status="active", resume_text="forged", experience_level="senior"), format="json")
        user = User.objects.get()
        profile = user.candidate_profile
        assert (user.role, user.status) == ("candidate", "pending_verification")
        assert profile.resume_text == "" and profile.experience_level == ""

    def test_all_problems_are_reported_together(self, api_client):
        response = api_client.post(URL, payload(email="bad", target_role="x" * 101, skills="Python"), format="json")
        assert {"email", "target_role", "skills"} <= set(response.json())


class TestMultipartWithCv:
    def post(self, client, resume=None, **overrides):
        data = payload(**overrides)
        if resume is not None:
            data["resume"] = resume
        return client.post(URL, data, format="multipart")

    def test_cv_and_repeated_skills_are_stored_privately_with_extracted_text(self, api_client):
        before = len(resumes_on_disk())
        response = self.post(api_client, pdf("Ayesha CV.pdf", "unique resume sentence"), skills=["Python", "SQL"], target_role="Data Engineer")
        assert response.status_code == 201
        profile = CandidateProfile.objects.get()
        assert profile.skills == ["Python", "SQL"] and profile.target_role == "Data Engineer"
        assert re.fullmatch(r"resumes/[0-9a-f]{32}\.pdf", profile.resume.name) and "Ayesha" not in profile.resume.name
        assert profile.resume_original_name == "Ayesha CV.pdf" and "unique resume sentence" in profile.resume_text
        assert len(resumes_on_disk()) == before + 1

    def test_a_docx_cv_is_accepted(self, api_client):
        docx = SimpleUploadedFile("cv.docx", make_docx(["docx body words"]), content_type="application/octet-stream")
        assert self.post(api_client, docx).status_code == 201
        assert "docx body words" in CandidateProfile.objects.get().resume_text

    @pytest.mark.parametrize(
        "upload,message",
        [
            (SimpleUploadedFile("photo.jpg", make_image("JPEG"), content_type="image/jpeg"), "Only PDF and DOCX files are accepted."),
            (SimpleUploadedFile("cv.pdf", make_image("PNG"), content_type="application/pdf"), "Only PDF and DOCX files are accepted."),
            (SimpleUploadedFile("cv.pdf", b"%PDF" + b"0" * (5 * 1024 * 1024 + 1), content_type="application/pdf"), "File must be 5 MB or smaller."),
        ],
    )
    def test_a_bad_cv_is_400_and_creates_nothing(self, api_client, upload, message):
        before = len(resumes_on_disk())
        response = self.post(api_client, upload)
        assert response.status_code == 400 and response.json()["resume"] == [message]
        assert User.objects.count() == 0 and len(resumes_on_disk()) == before

    def test_a_cv_that_cannot_be_read_still_signs_up_with_empty_text(self, api_client):
        broken = SimpleUploadedFile("cv.pdf", b"%PDF-1.4 truncated nonsense", content_type="application/pdf")
        assert self.post(api_client, broken).status_code == 201
        profile = CandidateProfile.objects.get()
        assert profile.resume and profile.resume_text == ""

    def test_a_taken_email_leaves_no_file_behind(self, api_client, user_factory):
        user_factory(email="ayesha@example.com")
        before = len(resumes_on_disk())
        assert self.post(api_client, pdf()).status_code == 400
        assert len(resumes_on_disk()) == before

    def test_a_race_on_the_email_leaves_no_file_behind(self, api_client, user_factory):
        user_factory(email="ayesha@example.com")
        before = len(resumes_on_disk())
        with mock.patch("apps.Module1_Authentication.serializers.ensure_email_available"):
            response = self.post(api_client, pdf())
        assert response.status_code == 400 and response.json() == {"email": ["Email already registered."]}
        assert len(resumes_on_disk()) == before

    def test_a_database_failure_rolls_back_everything_and_removes_the_file(self, api_client, django_capture_on_commit_callbacks):
        before = len(resumes_on_disk())
        with mock.patch("apps.Module1_Authentication.services.CandidateProfile.save", side_effect=DatabaseError):
            with django_capture_on_commit_callbacks(execute=True):
                with pytest.raises(DatabaseError):
                    self.post(api_client, pdf())
        assert User.objects.count() == 0 and CandidateProfile.objects.count() == 0 and mail.outbox == []
        assert len(resumes_on_disk()) == before

    def test_an_oversized_request_is_413_before_anything_is_stored(self, api_client):
        big = SimpleUploadedFile("cv.pdf", b"%PDF" + b"0" * (13 * 1024 * 1024), content_type="application/pdf")
        response = self.post(api_client, big)
        assert response.status_code == 413 and User.objects.count() == 0

    def test_sign_up_is_still_throttled(self, api_client):
        codes = [self.post(api_client, pdf(), email=f"p{i}@example.com").status_code for i in range(11)]
        assert codes[:10] == [201] * 10 and codes[10] == 429

    def test_the_cv_is_never_echoed_or_reachable_without_login(self, api_client):
        response = self.post(api_client, pdf())
        assert "resume" not in response.json() and api_client.get("/api/auth/profile/resume/").status_code == 401


def test_the_data_is_there_after_verification_and_login(api_client, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        response = api_client.post(URL, {**payload(target_role="QA Engineer", linkedin_url="https://linkedin.com/in/a"), "skills": ["Testing", "Python"], "resume": pdf("a.pdf", "qa resume")}, format="multipart")
    assert response.status_code == 201
    code = code_in(mail.outbox[-1])
    assert api_client.post("/api/auth/verify-email/", {"email": "ayesha@example.com", "code": code}, format="json").status_code == 200
    login = api_client.post("/api/auth/login/", {"email": "ayesha@example.com", "password": PASSWORD}, format="json")
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.json()['access']}")
    profile = api_client.get("/api/auth/profile/").json()
    assert profile["target_role"] == "QA Engineer" and profile["skills"] == ["Testing", "Python"]
    assert profile["linkedin_url"] == "https://linkedin.com/in/a" and profile["resume"] == "/api/auth/profile/resume/" and profile["resume_name"] == "a.pdf"
    download = api_client.get("/api/auth/profile/resume/")
    assert download.status_code == 200 and b"qa resume" in b"".join(download.streaming_content)

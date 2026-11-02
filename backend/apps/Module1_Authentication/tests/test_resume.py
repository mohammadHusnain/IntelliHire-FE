import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.Module1_Authentication import resume
from apps.Module1_Authentication.models import CandidateProfile
from apps.common.tests.helpers import make_docx, make_image, make_pdf

pytestmark = pytest.mark.django_db
URL = "/api/auth/profile/resume/"
PROFILE = "/api/auth/profile/"


@pytest.fixture
def candidate(user_factory):
    user = user_factory()
    CandidateProfile.objects.create(user=user)
    return user


def upload(client, name, content):
    return client.put(URL, {"resume": SimpleUploadedFile(name, content)}, format="multipart")


def profile_of(user):
    return CandidateProfile.objects.get(user=user)


def test_pdf_upload_is_stored_privately_and_its_text_is_extracted(auth_client, candidate):
    response = upload(auth_client(candidate), "Sana CV (final).pdf", make_pdf("Python developer with SQL"))
    assert response.status_code == 200 and response.json() == {"resume": "/api/auth/profile/resume/"}
    profile = profile_of(candidate)
    assert profile.resume.name.startswith("resumes/") and profile.resume.name.endswith(".pdf")
    assert "Sana" not in profile.resume.name
    assert profile.resume_original_name == "Sana CV (final).pdf"
    assert "Python developer with SQL" in profile.resume_text
    assert profile.resume.storage.exists(profile.resume.name)
    with pytest.raises(ValueError):
        profile.resume.url


def test_docx_upload_extracts_paragraphs_and_tables(auth_client, candidate):
    upload(auth_client(candidate), "cv.docx", make_docx(["Senior engineer"], table_cells=["Skills: Django", "Skills: Postgres"]))
    text = profile_of(candidate).resume_text
    assert "Senior engineer" in text and "Skills: Django" in text and "Skills: Postgres" in text


def test_profile_shows_the_authenticated_download_path_and_name(auth_client, candidate):
    client = auth_client(candidate)
    upload(client, "cv.pdf", make_pdf())
    body = client.get(PROFILE).json()
    assert body["resume"] == "/api/auth/profile/resume/" and body["resume_name"] == "cv.pdf"


def test_download_streams_the_file_with_its_original_name(auth_client, candidate):
    client = auth_client(candidate)
    content = make_pdf("Download me")
    upload(client, "My CV.pdf", content)
    response = client.get(URL)
    assert response.status_code == 200
    assert b"".join(response.streaming_content) == content
    assert response["Content-Disposition"] == 'attachment; filename="My CV.pdf"'
    assert response["Cache-Control"] == "private, no-store"
    assert response["Content-Type"] == "application/pdf"


def test_download_without_a_resume_is_404(auth_client, candidate):
    response = auth_client(candidate).get(URL)
    assert response.status_code == 404 and response.json()["code"] == "not_found"


def test_each_candidate_only_ever_reaches_their_own_resume(auth_client, candidate, user_factory):
    upload(auth_client(candidate), "mine.pdf", make_pdf("private"))
    other = user_factory()
    assert auth_client(other).get(URL).status_code == 404


def test_replacing_the_resume_deletes_the_old_file_and_updates_the_text(auth_client, candidate, django_capture_on_commit_callbacks):
    client = auth_client(candidate)
    upload(client, "old.pdf", make_pdf("old content"))
    old = profile_of(candidate)
    old_name, storage = old.resume.name, old.resume.storage
    with django_capture_on_commit_callbacks(execute=True):
        upload(client, "new.docx", make_docx(["new content"]))
    new = profile_of(candidate)
    assert new.resume.name != old_name and new.resume.name.endswith(".docx")
    assert not storage.exists(old_name) and storage.exists(new.resume.name)
    assert "new content" in new.resume_text and "old content" not in new.resume_text
    assert new.resume_original_name == "new.docx"


@pytest.mark.parametrize(
    "name,content",
    [("photo.jpg", make_image("JPEG")), ("cv.pdf", make_image("JPEG")), ("cv.doc", make_pdf()), ("run.exe", b"MZ\x90"), ("cv.docx", make_pdf())],
)
def test_wrong_type_is_rejected_with_the_documented_message_and_changes_nothing(auth_client, candidate, name, content):
    client = auth_client(candidate)
    upload(client, "keep.pdf", make_pdf("keep me"))
    before = profile_of(candidate)
    response = upload(client, name, content)
    assert response.status_code == 400
    assert response.json() == {"resume": ["Only PDF and DOCX files are accepted."]}
    after = profile_of(candidate)
    assert after.resume.name == before.resume.name and "keep me" in after.resume_text


def test_a_file_over_5_mb_is_rejected(auth_client, candidate):
    response = upload(auth_client(candidate), "big.pdf", make_pdf() + b"0" * (5 * 1024 * 1024))
    assert response.status_code == 400
    assert response.json() == {"resume": ["File must be 5 MB or smaller."]}


def test_a_missing_file_is_a_field_error(auth_client, candidate):
    assert auth_client(candidate).put(URL, {}, format="multipart").json() == {"resume": ["No file was submitted."]}


def test_an_unreadable_but_well_formed_file_is_still_saved_without_text(auth_client, candidate):
    response = upload(auth_client(candidate), "broken.pdf", b"%PDF-1.4 this is not really a pdf")
    assert response.status_code == 200
    profile = profile_of(candidate)
    assert profile.resume and profile.resume_text == ""


def test_a_corrupt_docx_is_saved_without_text(auth_client, candidate):
    assert upload(auth_client(candidate), "broken.docx", b"PK\x03\x04 not a zip").status_code == 200
    assert profile_of(candidate).resume_text == ""


def test_extracted_text_is_capped(auth_client, candidate):
    upload(auth_client(candidate), "long.docx", make_docx(["word " * 10_000]))
    assert len(profile_of(candidate).resume_text) <= resume.MAX_TEXT_CHARS


def test_nul_characters_never_reach_the_database():
    assert resume._clean("a\x00b  c") == "ab c"


def test_oversized_decompressed_docx_is_not_parsed(auth_client, candidate, monkeypatch):
    monkeypatch.setattr(resume, "MAX_DOCX_UNCOMPRESSED_BYTES", 10)
    assert upload(auth_client(candidate), "cv.docx", make_docx(["hello"])).status_code == 200
    assert profile_of(candidate).resume_text == ""


def test_a_failed_save_removes_the_newly_written_file(auth_client, candidate, monkeypatch):
    client = auth_client(candidate)
    storage = profile_of(candidate).resume.storage
    seen = []
    original = CandidateProfile.save

    def failing_save(self, *args, **kwargs):
        seen.append(self.resume.name)
        raise RuntimeError("db down")

    monkeypatch.setattr(CandidateProfile, "save", failing_save)
    with pytest.raises(RuntimeError):
        upload(client, "cv.pdf", make_pdf())
    monkeypatch.setattr(CandidateProfile, "save", original)
    assert seen and not storage.exists(seen[0])


def test_only_candidates_can_upload_or_download(api_client, auth_client, member_factory):
    assert api_client.put(URL, {}, format="multipart").status_code == 401
    assert api_client.get(URL).status_code == 401
    user = member_factory(role="admin")
    assert upload(auth_client(user), "cv.pdf", make_pdf()).status_code == 403
    assert auth_client(user).get(URL).status_code == 403


def test_post_is_not_allowed(auth_client, candidate):
    assert auth_client(candidate).post(URL, {}, format="multipart").status_code == 405

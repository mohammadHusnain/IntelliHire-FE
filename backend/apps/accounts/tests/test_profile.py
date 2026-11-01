import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.accounts.models import CandidateProfile
from apps.common.tests.helpers import make_image

pytestmark = pytest.mark.django_db
PROFILE = "/api/auth/profile/"


@pytest.fixture
def candidate(user_factory):
    user = user_factory()
    CandidateProfile.objects.create(user=user)
    return user


def test_a_new_profile_is_empty(auth_client, candidate):
    response = auth_client(candidate).get(PROFILE)
    assert response.status_code == 200
    body = response.json()
    assert body["resume"] is None and body["avatar"] is None and body["resume_name"] == ""
    assert body["skills"] == [] and body["education"] == [] and body["experience"] == []
    assert body["experience_level"] == "" and body["bio"] == ""
    assert set(body) == {
        "phone", "headline", "location", "bio", "target_role", "experience_level", "avatar", "linkedin_url",
        "github_url", "portfolio_url", "skills", "resume", "resume_name", "updated_at", "education", "experience",
    }


def test_patch_saves_immediately_and_returns_the_profile(auth_client, candidate):
    data = {
        "phone": "+92 300 1234567",
        "headline": "Backend developer",
        "location": "Lahore",
        "bio": "I build APIs.",
        "target_role": "Backend Developer",
        "experience_level": "mid",
        "linkedin_url": "https://linkedin.com/in/sana",
        "github_url": "https://github.com/sana",
        "portfolio_url": "https://sana.dev",
        "skills": ["Python", "SQL", "React"],
    }
    response = auth_client(candidate).patch(PROFILE, data, format="json")
    assert response.status_code == 200
    for key, value in data.items():
        assert response.json()[key] == value
    profile = CandidateProfile.objects.get(user=candidate)
    assert profile.headline == "Backend developer" and profile.skills == ["Python", "SQL", "React"]


def test_partial_updates_leave_other_fields_alone(auth_client, candidate):
    client = auth_client(candidate)
    client.patch(PROFILE, {"headline": "A", "location": "B"}, format="json")
    client.patch(PROFILE, {"headline": "C"}, format="json")
    body = client.get(PROFILE).json()
    assert (body["headline"], body["location"]) == ("C", "B")


def test_skills_are_trimmed_deduplicated_and_limited(auth_client, candidate):
    client = auth_client(candidate)
    response = client.patch(PROFILE, {"skills": [" Python ", "python", "SQL"]}, format="json")
    assert response.json()["skills"] == ["Python", "SQL"]
    blank = client.patch(PROFILE, {"skills": ["Python", "  "]}, format="json")
    assert blank.status_code == 400 and "skills" in blank.json()
    too_many = client.patch(PROFILE, {"skills": [f"skill{i}" for i in range(21)]}, format="json")
    assert too_many.status_code == 400 and "skills" in too_many.json()
    too_long = client.patch(PROFILE, {"skills": ["x" * 51]}, format="json")
    assert too_long.status_code == 400


@pytest.mark.parametrize(
    "field,value",
    [
        ("phone", "abc"),
        ("phone", "12345"),
        ("linkedin_url", "not a url"),
        ("github_url", "ftp//x"),
        ("experience_level", "guru"),
        ("headline", "x" * 151),
        ("bio", "x" * 401),
        ("target_role", "x" * 101),
    ],
)
def test_invalid_values_are_field_errors(auth_client, candidate, field, value):
    response = auth_client(candidate).patch(PROFILE, {field: value}, format="json")
    assert response.status_code == 400 and field in response.json()


def test_optional_fields_can_be_cleared(auth_client, candidate):
    client = auth_client(candidate)
    client.patch(PROFILE, {"phone": "+92 300 1234567", "experience_level": "senior"}, format="json")
    cleared = client.patch(PROFILE, {"phone": "", "experience_level": ""}, format="json")
    assert cleared.status_code == 200 and cleared.json()["phone"] == "" and cleared.json()["experience_level"] == ""


def test_read_only_and_foreign_fields_are_ignored(auth_client, candidate, user_factory):
    other = user_factory()
    other_profile = CandidateProfile.objects.create(user=other)
    auth_client(candidate).patch(
        PROFILE, {"user": other.pk, "id": other_profile.pk, "resume": "x", "resume_text": "evil", "education": [{"x": 1}]}, format="json"
    )
    mine = CandidateProfile.objects.get(user=candidate)
    assert mine.resume_text == "" and not mine.resume and mine.education.count() == 0
    assert CandidateProfile.objects.get(pk=other_profile.pk).user == other


def test_avatar_upload_replace_and_clear(auth_client, candidate, django_capture_on_commit_callbacks):
    client = auth_client(candidate)
    first = client.patch(PROFILE, {"avatar": SimpleUploadedFile("me.png", make_image("PNG"))}, format="multipart")
    assert first.status_code == 200
    assert first.json()["avatar"].startswith("http://testserver/media/avatars/") and first.json()["avatar"].endswith(".png")
    profile = CandidateProfile.objects.get(user=candidate)
    first_name = profile.avatar.name
    assert profile.avatar.storage.exists(first_name)

    with django_capture_on_commit_callbacks(execute=True):
        client.patch(PROFILE, {"avatar": SimpleUploadedFile("me.jpg", make_image("JPEG"))}, format="multipart")
    profile.refresh_from_db()
    assert profile.avatar.name != first_name and profile.avatar.name.endswith(".jpg")
    assert not profile.avatar.storage.exists(first_name)

    cleared_name = profile.avatar.name
    with django_capture_on_commit_callbacks(execute=True):
        cleared = client.patch(PROFILE, {"avatar": None}, format="json")
    assert cleared.status_code == 200 and cleared.json()["avatar"] is None
    assert not profile.avatar.storage.exists(cleared_name)


@pytest.mark.parametrize(
    "name,content",
    [("a.gif", make_image("GIF")), ("a.png", b"not an image at all"), ("a.png", make_image("JPEG")), ("a.pdf", b"%PDF-1.4")],
)
def test_avatar_must_be_a_real_jpg_or_png(auth_client, candidate, name, content):
    response = auth_client(candidate).patch(PROFILE, {"avatar": SimpleUploadedFile(name, content)}, format="multipart")
    assert response.status_code == 400 and "avatar" in response.json()


def test_avatar_over_2_mb_is_rejected(auth_client, candidate):
    big = make_image("PNG") + b"0" * (2 * 1024 * 1024)
    response = auth_client(candidate).patch(PROFILE, {"avatar": SimpleUploadedFile("a.png", big)}, format="multipart")
    assert response.status_code == 400


def test_skills_work_in_multipart_requests_too(auth_client, candidate):
    response = auth_client(candidate).patch(PROFILE, {"skills": ["Python", "SQL"], "headline": "Hi"}, format="multipart")
    assert response.status_code == 200 and response.json()["skills"] == ["Python", "SQL"]


def test_only_candidates_can_use_the_profile(api_client, auth_client, member_factory, user_factory):
    assert api_client.get(PROFILE).status_code == 401
    for user in (member_factory(role="admin"), member_factory(role="recruiter"), user_factory(role="platform_admin")):
        response = auth_client(user).get(PROFILE)
        assert response.status_code == 403
        assert response.json() == {"detail": "Unauthorized access.", "code": "permission_denied"}


def test_a_missing_profile_is_created_on_first_use(auth_client, user_factory):
    user = user_factory()
    assert not CandidateProfile.objects.filter(user=user).exists()
    assert auth_client(user).get(PROFILE).status_code == 200
    assert CandidateProfile.objects.filter(user=user).count() == 1


def test_put_and_delete_are_not_allowed(auth_client, candidate):
    client = auth_client(candidate)
    assert client.put(PROFILE, {}, format="json").status_code == 405
    assert client.delete(PROFILE).status_code == 405


def test_profile_reads_use_a_constant_number_of_queries(auth_client, candidate, django_assert_max_num_queries):
    from apps.accounts.models import Education

    profile = CandidateProfile.objects.get(user=candidate)
    for i in range(10):
        Education.objects.create(profile=profile, institution=f"U{i}", degree="BS", field_of_study="CS", start_year=2010 + i)
    client = auth_client(candidate)
    with django_assert_max_num_queries(6):
        assert client.get(PROFILE).status_code == 200

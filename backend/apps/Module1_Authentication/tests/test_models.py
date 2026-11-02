from datetime import date

import pytest
from django.contrib.auth.hashers import check_password
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, transaction

from apps.Module1_Authentication.models import CandidateProfile, Education, Experience, User

pytestmark = pytest.mark.django_db


def make_profile(user_factory):
    return CandidateProfile.objects.create(user=user_factory())


class TestUserManager:
    def test_create_user_lowercases_email_and_hashes_password(self):
        user = User.objects.create_user(
            "  Jane.Doe@Example.COM ", "Str0ng!pass-123", full_name="Jane", role="candidate", status="active"
        )
        assert user.email == "jane.doe@example.com"
        assert user.password != "Str0ng!pass-123"
        assert check_password("Str0ng!pass-123", user.password)
        assert user.is_staff is False and user.is_superuser is False

    def test_create_user_requires_email(self):
        with pytest.raises(ValueError):
            User.objects.create_user("", "pw", full_name="X", role="candidate", status="active")

    def test_create_superuser_is_an_active_verified_platform_admin(self):
        admin = User.objects.create_superuser("Admin@Example.com", "Str0ng!pass-123", full_name="Admin")
        assert admin.email == "admin@example.com"
        assert admin.role == User.Role.PLATFORM_ADMIN
        assert admin.status == User.Status.ACTIVE
        assert admin.email_verified and admin.is_staff and admin.is_superuser
        assert admin.is_active

    def test_save_lowercases_email_set_directly(self, user_factory):
        user = user_factory()
        user.email = "MiXeD@Example.com"
        user.save()
        user.refresh_from_db()
        assert user.email == "mixed@example.com"


class TestUser:
    def test_primary_key_is_a_uuid(self, user_factory):
        assert len(str(user_factory().pk)) == 36

    def test_email_is_unique_regardless_of_case(self, user_factory):
        user_factory(email="same@example.com")
        with pytest.raises(IntegrityError), transaction.atomic():
            user_factory(email="SAME@example.com")

    def test_database_rejects_non_lowercase_email(self, user_factory):
        user = user_factory()
        with pytest.raises(IntegrityError), transaction.atomic():
            User.objects.filter(pk=user.pk).update(email="UPPER@example.com")

    def test_database_rejects_unknown_role_and_status(self, user_factory):
        user = user_factory()
        with pytest.raises(IntegrityError), transaction.atomic():
            User.objects.filter(pk=user.pk).update(role="superhero")
        with pytest.raises(IntegrityError), transaction.atomic():
            User.objects.filter(pk=user.pk).update(status="banned")

    @pytest.mark.parametrize(
        "status,expected",
        [
            (User.Status.ACTIVE, True),
            (User.Status.PENDING_VERIFICATION, False),
            (User.Status.PENDING_APPROVAL, False),
            (User.Status.REJECTED, False),
            (User.Status.SUSPENDED, False),
        ],
    )
    def test_only_active_users_are_active(self, user_factory, status, expected):
        assert user_factory(status=status).is_active is expected

    def test_user_without_usable_password_cannot_authenticate_by_default(self):
        user = User.objects.create_user("x@example.com", None, full_name="X", role="candidate", status="active")
        assert user.has_usable_password() is False


class TestCandidateProfile:
    def test_one_profile_per_user(self, user_factory):
        user = user_factory()
        CandidateProfile.objects.create(user=user)
        with pytest.raises(IntegrityError), transaction.atomic():
            CandidateProfile.objects.create(user=user)

    def test_defaults_and_independent_skill_lists(self, user_factory):
        first, second = make_profile(user_factory), make_profile(user_factory)
        first.skills.append("Python")
        first.save()
        second.refresh_from_db()
        assert second.skills == []
        assert first.resume_text == "" and not first.resume and not first.avatar

    def test_profile_is_deleted_with_its_user(self, user_factory):
        profile = make_profile(user_factory)
        Education.objects.create(profile=profile, institution="MIT", degree="BS", field_of_study="CS", start_year=2018)
        profile.user.delete()
        assert CandidateProfile.objects.count() == 0 and Education.objects.count() == 0

    def test_resume_uses_private_storage_without_a_url(self, user_factory):
        profile = make_profile(user_factory)
        assert profile.resume.storage.location != profile.avatar.storage.location
        profile.resume.save("cv.pdf", SimpleUploadedFile("cv.pdf", b"%PDF-1.7"), save=True)
        try:
            assert profile.resume.name.startswith("resumes/") and "cv" not in profile.resume.name
            with pytest.raises(ValueError):
                profile.resume.url
        finally:
            profile.resume.delete(save=False)

    def test_resume_and_avatar_validators_reject_bad_files(self, user_factory):
        profile = make_profile(user_factory)
        profile.resume = SimpleUploadedFile("cv.pdf", b"\xff\xd8\xff not a pdf")
        profile.avatar = SimpleUploadedFile("a.png", b"GIF89a")
        with pytest.raises(ValidationError) as exc:
            profile.full_clean()
        assert set(exc.value.message_dict) == {"resume", "avatar"}


class TestEducation:
    def data(self, **overrides):
        return {"institution": "MIT", "degree": "BS", "field_of_study": "CS", "start_year": 2018, **overrides}

    def test_ongoing_education_has_no_end_year(self, user_factory):
        profile = make_profile(user_factory)
        assert Education.objects.create(profile=profile, **self.data()).end_year is None

    def test_end_year_cannot_precede_start_year(self, user_factory):
        profile = make_profile(user_factory)
        with pytest.raises(IntegrityError), transaction.atomic():
            Education.objects.create(profile=profile, **self.data(end_year=2017))
        Education.objects.create(profile=profile, **self.data(end_year=2018))


class TestExperience:
    def data(self, **overrides):
        return {"company": "Acme", "position": "Dev", "start_date": date(2022, 1, 1), **overrides}

    def test_current_job_has_no_end_date(self, user_factory):
        profile = make_profile(user_factory)
        Experience.objects.create(profile=profile, **self.data(is_current=True))
        with pytest.raises(IntegrityError), transaction.atomic():
            Experience.objects.create(profile=profile, **self.data(is_current=True, end_date=date(2023, 1, 1)))

    def test_past_job_needs_an_end_date_after_the_start(self, user_factory):
        profile = make_profile(user_factory)
        Experience.objects.create(profile=profile, **self.data(end_date=date(2022, 6, 1)))
        for end in (None, date(2022, 1, 1), date(2021, 12, 31)):
            with pytest.raises(IntegrityError), transaction.atomic():
                Experience.objects.create(profile=profile, **self.data(end_date=end))

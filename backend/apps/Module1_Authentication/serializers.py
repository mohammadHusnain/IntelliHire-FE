from datetime import date

from django.db import transaction
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.common.choices import UserRole
from apps.common.permissions import get_membership
from apps.common.validators import validate_cv_file, validate_phone, validate_profile_image

from .models import CandidateProfile, Education, Experience, User
from .validators import (
    PASSWORD_MISMATCH,
    check_password_strength,
    ensure_email_available,
    normalize_email,
)

MAX_SKILLS = 20
MAX_SKILL_LENGTH = 50
MAX_EDUCATION_ROWS = 50
MAX_EXPERIENCE_ROWS = 50
EARLIEST_YEAR = 1950
FUTURE_YEARS = 10
RESUME_DOWNLOAD_PATH = "/api/auth/profile/resume/"


class DetailSerializer(serializers.Serializer):
    detail = serializers.CharField()


class CompanySummarySerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    member_role = serializers.CharField()
    status = serializers.CharField()


class UserSerializer(serializers.ModelSerializer):
    company = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "full_name", "role", "status", "company"]
        read_only_fields = fields

    @extend_schema_field(CompanySummarySerializer(allow_null=True))
    def get_company(self, user):
        if user.role not in (UserRole.COMPANY_ADMIN, UserRole.HR):
            return None
        membership = get_membership(user)
        if membership is None:
            return None
        company = membership.company
        return {
            "id": str(company.pk),
            "name": company.name,
            "member_role": membership.role,
            "status": company.status,
        }


class PasswordPairSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=128)
    confirm_password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=128)

    def check_passwords(self, attrs, *, email, full_name):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": [PASSWORD_MISMATCH]})
        try:
            check_password_strength(attrs["password"], User(email=email, full_name=full_name))
        except serializers.ValidationError as exc:
            raise serializers.ValidationError({"password": exc.detail})


class CandidateRegistrationSerializer(PasswordPairSerializer):
    full_name = serializers.CharField(max_length=150)
    email = serializers.EmailField(max_length=254)

    def validate_email(self, value):
        email = normalize_email(value)
        ensure_email_available(email)
        return email

    def validate(self, attrs):
        self.check_passwords(attrs, email=attrs["email"], full_name=attrs["full_name"])
        return attrs


class RegistrationResponseSerializer(serializers.Serializer):
    email = serializers.EmailField()
    status = serializers.CharField()


class VerifyEmailSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=2000)


class VerifyEmailResponseSerializer(serializers.Serializer):
    detail = serializers.CharField()
    status = serializers.CharField()


class EmailOnlySerializer(serializers.Serializer):
    email = serializers.CharField(max_length=254)


class LoginSerializer(serializers.Serializer):
    email = serializers.CharField(max_length=254)
    password = serializers.CharField(trim_whitespace=False, max_length=128)


class RefreshTokenSerializer(serializers.Serializer):
    refresh = serializers.CharField(max_length=4000)


class TokenPairSerializer(serializers.Serializer):
    access = serializers.CharField()
    refresh = serializers.CharField()


class LoginResponseSerializer(TokenPairSerializer):
    user = UserSerializer()


class ResetPasswordSerializer(serializers.Serializer):
    uid = serializers.CharField(max_length=100)
    token = serializers.CharField(max_length=200)
    new_password = serializers.CharField(trim_whitespace=False, max_length=128)
    confirm_password = serializers.CharField(trim_whitespace=False, max_length=128)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": [PASSWORD_MISMATCH]})
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(trim_whitespace=False, max_length=128)
    new_password = serializers.CharField(trim_whitespace=False, max_length=128)


class MeUpdateSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=150)


class ResumeUploadSerializer(serializers.Serializer):
    resume = serializers.FileField(validators=[validate_cv_file])


class ResumeResponseSerializer(serializers.Serializer):
    resume = serializers.CharField()


class EducationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Education
        fields = ["id", "institution", "degree", "field_of_study", "start_year", "end_year", "grade"]

    def validate_start_year(self, value):
        return self._check_year(value)

    def validate_end_year(self, value):
        return value if value is None else self._check_year(value)

    @staticmethod
    def _check_year(value):
        latest = date.today().year + FUTURE_YEARS
        if not EARLIEST_YEAR <= value <= latest:
            raise serializers.ValidationError(f"Enter a year between {EARLIEST_YEAR} and {latest}.")
        return value

    def validate(self, attrs):
        start = attrs.get("start_year", getattr(self.instance, "start_year", None))
        end = attrs.get("end_year", getattr(self.instance, "end_year", None))
        if end is not None and start is not None and end < start:
            raise serializers.ValidationError({"end_year": ["End year cannot be before the start year."]})
        return attrs


class ExperienceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Experience
        fields = ["id", "company", "position", "start_date", "end_date", "is_current", "description"]

    def validate(self, attrs):
        current = self.instance
        is_current = attrs.get("is_current", getattr(current, "is_current", False))
        start = attrs.get("start_date", getattr(current, "start_date", None))
        end = attrs.get("end_date", getattr(current, "end_date", None))
        if is_current:
            if end is not None:
                raise serializers.ValidationError({"end_date": ["End date must be empty for a current position."]})
        elif end is None:
            raise serializers.ValidationError({"end_date": ["End date is required for a past position."]})
        elif start is not None and end <= start:
            raise serializers.ValidationError({"end_date": ["End date must be after the start date."]})
        return attrs


class CandidateProfileSerializer(serializers.ModelSerializer):
    avatar = serializers.ImageField(required=False, allow_null=True, validators=[validate_profile_image])
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True, validators=[validate_phone])
    skills = serializers.ListField(child=serializers.CharField(max_length=MAX_SKILL_LENGTH), required=False)
    resume = serializers.SerializerMethodField()
    resume_name = serializers.CharField(source="resume_original_name", read_only=True)
    education = EducationSerializer(many=True, read_only=True)
    experience = ExperienceSerializer(many=True, read_only=True)

    class Meta:
        model = CandidateProfile
        fields = [
            "phone",
            "headline",
            "location",
            "bio",
            "target_role",
            "experience_level",
            "avatar",
            "linkedin_url",
            "github_url",
            "portfolio_url",
            "skills",
            "resume",
            "resume_name",
            "updated_at",
            "education",
            "experience",
        ]
        read_only_fields = ["updated_at"]

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_resume(self, profile):
        return RESUME_DOWNLOAD_PATH if profile.resume else None

    def validate_skills(self, value):
        cleaned, seen = [], set()
        for skill in (item.strip() for item in value):
            if skill and skill.lower() not in seen:
                seen.add(skill.lower())
                cleaned.append(skill)
        if len(cleaned) > MAX_SKILLS:
            raise serializers.ValidationError(f"Add at most {MAX_SKILLS} skills.")
        return cleaned

    def update(self, instance, validated_data):
        old_avatar = instance.avatar.name if "avatar" in validated_data else ""
        with transaction.atomic():
            instance = super().update(instance, validated_data)
            if old_avatar and old_avatar != instance.avatar.name:
                storage = instance.avatar.storage
                transaction.on_commit(lambda: storage.delete(old_avatar))
        return instance

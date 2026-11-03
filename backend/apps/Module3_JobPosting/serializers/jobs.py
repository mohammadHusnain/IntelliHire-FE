from django.utils import timezone
from rest_framework import serializers

from ..models import EducationLevel, EmploymentType, JobPosting, WorkMode
from ..services.form import days_left
from ..services.rules import deadline_problems
from .fields import ApplicationFieldSerializer

MAX_SKILLS = 30
MAX_SKILL_LENGTH = 50
MAX_TEXT_LENGTH = 10000
MAX_SALARY = 1_000_000_000


def _clean_skills(value):
    cleaned, seen = [], set()
    for skill in (item.strip() for item in value):
        if not skill:
            raise serializers.ValidationError("Skills cannot be empty.")
        if skill.lower() not in seen:
            seen.add(skill.lower())
            cleaned.append(skill)
    if len(cleaned) > MAX_SKILLS:
        raise serializers.ValidationError(f"Add at most {MAX_SKILLS} skills.")
    return cleaned


class JobWriteSerializer(serializers.Serializer):
    """Fields HR may send. Company, status, form_slug and created_by are never read from the body."""

    title = serializers.CharField(max_length=150)
    department = serializers.CharField(max_length=100)
    description = serializers.CharField(max_length=MAX_TEXT_LENGTH, required=False, allow_blank=True)
    responsibilities = serializers.CharField(max_length=MAX_TEXT_LENGTH, required=False, allow_blank=True)
    employment_type = serializers.ChoiceField(choices=EmploymentType.choices, required=False, allow_blank=True)
    work_mode = serializers.ChoiceField(choices=WorkMode.choices, required=False, allow_blank=True)
    location = serializers.CharField(max_length=200, required=False, allow_blank=True)
    required_skills = serializers.ListField(child=serializers.CharField(max_length=MAX_SKILL_LENGTH, allow_blank=True), required=False)
    soft_skills = serializers.ListField(child=serializers.CharField(max_length=MAX_SKILL_LENGTH, allow_blank=True), required=False)
    min_experience_years = serializers.IntegerField(min_value=0, max_value=30, required=False)
    education_level = serializers.ChoiceField(choices=EducationLevel.choices, required=False)
    salary_min = serializers.IntegerField(min_value=0, max_value=MAX_SALARY, required=False, allow_null=True)
    salary_max = serializers.IntegerField(min_value=0, max_value=MAX_SALARY, required=False, allow_null=True)
    salary_currency = serializers.CharField(max_length=10, required=False, allow_blank=True)
    show_salary = serializers.BooleanField(required=False)
    openings = serializers.IntegerField(min_value=1, max_value=1000, required=False)
    deadline = serializers.DateTimeField(required=False, allow_null=True)
    publish = serializers.BooleanField(write_only=True, required=False, default=False)

    def validate_required_skills(self, value):
        return _clean_skills(value)

    def validate_soft_skills(self, value):
        return _clean_skills(value)

    def validate_deadline(self, value):
        if value is not None and value <= timezone.now():
            raise serializers.ValidationError(deadline_problems(value)[0])
        return value

    def validate(self, attrs):
        current = self.instance
        low = attrs.get("salary_min", getattr(current, "salary_min", None))
        high = attrs.get("salary_max", getattr(current, "salary_max", None))
        if low is not None and high is not None and high < low:
            raise serializers.ValidationError({"salary_max": ["Maximum salary must be at least the minimum."]})
        return attrs


class JobCreatorSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    full_name = serializers.CharField()


class JobListSerializer(serializers.ModelSerializer):
    applications_count = serializers.IntegerField(read_only=True)
    days_left = serializers.SerializerMethodField()
    share_url = serializers.CharField(read_only=True)

    class Meta:
        model = JobPosting
        fields = [
            "id",
            "title",
            "department",
            "employment_type",
            "work_mode",
            "location",
            "status",
            "deadline",
            "days_left",
            "applications_count",
            "share_url",
            "created_at",
            "published_at",
        ]
        read_only_fields = fields

    def get_days_left(self, job) -> int | None:
        return days_left(job)


class JobDetailSerializer(JobListSerializer):
    custom_fields = ApplicationFieldSerializer(many=True, read_only=True)
    created_by = serializers.SerializerMethodField()

    class Meta(JobListSerializer.Meta):
        fields = JobListSerializer.Meta.fields + [
            "description",
            "responsibilities",
            "required_skills",
            "soft_skills",
            "min_experience_years",
            "education_level",
            "salary_min",
            "salary_max",
            "salary_currency",
            "show_salary",
            "openings",
            "form_slug",
            "close_reason",
            "closed_at",
            "updated_at",
            "created_by",
            "custom_fields",
        ]
        read_only_fields = fields

    def get_created_by(self, job) -> dict | None:
        user = job.created_by
        return {"id": str(user.pk), "full_name": user.full_name} if user else None


class ReopenSerializer(serializers.Serializer):
    deadline = serializers.DateTimeField()


class FormFieldSerializer(serializers.Serializer):
    key = serializers.CharField()
    label = serializers.CharField()
    type = serializers.CharField()
    required = serializers.BooleanField()
    options = serializers.ListField(child=serializers.CharField())
    option_labels = serializers.DictField(child=serializers.CharField(), allow_null=True)
    help_text = serializers.CharField(allow_blank=True)
    max_length = serializers.IntegerField(allow_null=True)
    built_in = serializers.BooleanField()


class FormCompanySerializer(serializers.Serializer):
    name = serializers.CharField()
    logo = serializers.CharField(allow_null=True)


class FormSalarySerializer(serializers.Serializer):
    min = serializers.IntegerField(allow_null=True)
    max = serializers.IntegerField(allow_null=True)
    currency = serializers.CharField(allow_blank=True)


class FormJobSerializer(serializers.Serializer):
    title = serializers.CharField()
    company = FormCompanySerializer()
    department = serializers.CharField()
    location = serializers.CharField(allow_blank=True)
    work_mode = serializers.CharField(allow_blank=True)
    employment_type = serializers.CharField(allow_blank=True)
    description = serializers.CharField(allow_blank=True)
    responsibilities = serializers.CharField(allow_blank=True)
    required_skills = serializers.ListField(child=serializers.CharField())
    soft_skills = serializers.ListField(child=serializers.CharField())
    deadline = serializers.DateTimeField(allow_null=True)
    salary = FormSalarySerializer(allow_null=True)


class FormSchemaSerializer(serializers.Serializer):
    accepting = serializers.BooleanField()
    message = serializers.CharField(allow_null=True)
    job = FormJobSerializer()
    fields = FormFieldSerializer(many=True)

from rest_framework import serializers

from ..models import Application, ApplicationStatus
from ..services.review import NOTE_MAX_LENGTH
from apps.Module3_JobPosting.models import FieldType


def resume_path(application):
    return f"/api/applications/{application.pk}/resume/"


def file_path(application, key):
    return f"/api/applications/{application.pk}/files/{key}/"


class JobSummarySerializer(serializers.Serializer):
    id = serializers.UUIDField()
    title = serializers.CharField()


class ApplicationListSerializer(serializers.ModelSerializer):
    has_cv = serializers.SerializerMethodField()

    class Meta:
        model = Application
        fields = [
            "id", "reference", "full_name", "email", "phone", "education_level",
            "institution", "status", "submitted_at", "has_cv",
        ]
        read_only_fields = fields

    def get_has_cv(self, application) -> bool:
        return bool(application.resume)


class CompanyApplicationListSerializer(ApplicationListSerializer):
    job = JobSummarySerializer(read_only=True)

    class Meta(ApplicationListSerializer.Meta):
        fields = ApplicationListSerializer.Meta.fields + ["job"]
        read_only_fields = fields


class FileLinkSerializer(serializers.Serializer):
    name = serializers.CharField()
    url = serializers.CharField()


class AnswerSerializer(serializers.Serializer):
    key = serializers.CharField()
    label = serializers.CharField()
    type = serializers.CharField()
    value = serializers.JSONField(allow_null=True)


class StatusHistorySerializer(serializers.Serializer):
    from_status = serializers.CharField(allow_null=True)
    to_status = serializers.CharField()
    changed_by = serializers.JSONField(allow_null=True)
    note = serializers.CharField(allow_blank=True)
    changed_at = serializers.DateTimeField()


class ApplicationDetailSerializer(serializers.ModelSerializer):
    job = JobSummarySerializer(read_only=True)
    resume = serializers.SerializerMethodField()
    answers = serializers.SerializerMethodField()
    status_history = serializers.SerializerMethodField()

    class Meta:
        model = Application
        fields = [
            "id", "reference", "status", "submitted_at", "updated_at", "job", "full_name", "email", "phone",
            "education_level", "institution", "graduation_year", "resume", "answers", "status_history",
        ]
        read_only_fields = fields

    def get_resume(self, application) -> dict:
        return {"name": application.resume_original_name, "url": resume_path(application)}

    def get_answers(self, application) -> list:
        """Stored answers joined with the job's current custom fields, in form order.
        A renamed field shows its new label; an unanswered field shows `null`."""
        files = {record.field_key: record for record in application.files.all()}
        result = []
        for field in application.job.custom_fields.all():
            if field.field_type == FieldType.FILE:
                record = files.get(field.key)
                value = {"name": record.original_name, "url": file_path(application, field.key)} if record else None
            else:
                value = application.answers.get(field.key)
            result.append({"key": field.key, "label": field.label, "type": field.field_type, "value": value})
        return result

    def get_status_history(self, application) -> list:
        return [
            {
                "from_status": change.from_status or None,
                "to_status": change.to_status,
                "changed_by": (
                    {"id": str(change.changed_by.pk), "full_name": change.changed_by.full_name}
                    if change.changed_by
                    else None
                ),
                "note": change.note,
                "changed_at": change.changed_at,
            }
            for change in application.status_history.all()
        ]


class StatusChangeSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=ApplicationStatus.choices)
    note = serializers.CharField(max_length=NOTE_MAX_LENGTH, required=False, allow_blank=True, default="")


class ApplicationListResponseSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    next = serializers.CharField(allow_null=True)
    previous = serializers.CharField(allow_null=True)
    results = ApplicationListSerializer(many=True)
    status_counts = serializers.DictField(child=serializers.IntegerField())


class PublicSubmissionResponseSerializer(serializers.Serializer):
    reference = serializers.CharField()
    job_title = serializers.CharField()
    company = serializers.CharField()
    submitted_at = serializers.DateTimeField()


class ApplySerializer(serializers.Serializer):
    """Documentation only: the submission is validated against the job's own form (see services/validation)."""

    full_name = serializers.CharField()
    email = serializers.EmailField()
    phone = serializers.CharField()
    education_level = serializers.CharField()
    institution = serializers.CharField()
    graduation_year = serializers.IntegerField()
    resume = serializers.FileField()

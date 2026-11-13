from datetime import date

from rest_framework import serializers

from apps.Module3_JobPosting.models import JobPosting, JobStatus

from .models import Community, CommunityPost


class ShortList(serializers.ListField):
    child = serializers.CharField(max_length=100, allow_blank=True)

    def __init__(self, **kwargs):
        kwargs.setdefault("required", False)
        kwargs.setdefault("max_length", 20)
        super().__init__(**kwargs)

    def to_internal_value(self, data):
        return [item.strip() for item in super().to_internal_value(data) if item.strip()]


class CommunityInputSerializer(serializers.ModelSerializer):
    filter_universities = ShortList()
    filter_degrees = ShortList()
    filter_skills = ShortList()

    class Meta:
        model = Community
        fields = [
            "name", "description", "mission", "join_mode", "filter_universities", "filter_degrees", "filter_grad_year_from",
            "filter_grad_year_to", "filter_skills", "filter_skill_mode",
        ]  # fmt: skip
        extra_kwargs = {"name": {"validators": []}, "description": {"required": True, "allow_blank": False}, "mission": {"required": True, "allow_blank": False}}

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Enter a name.")
        return value

    def validate(self, data):
        start = data.get("filter_grad_year_from", getattr(self.instance, "filter_grad_year_from", None))
        end = data.get("filter_grad_year_to", getattr(self.instance, "filter_grad_year_to", None))
        for key, value in (("filter_grad_year_from", start), ("filter_grad_year_to", end)):
            if value is not None and not 1950 <= value <= date.today().year + 15:
                raise serializers.ValidationError({key: ["Enter a realistic year."]})
        if start is not None and end is not None and start > end:
            raise serializers.ValidationError({"filter_grad_year_to": ["The end year cannot be before the start year."]})
        return data


class CommunityReasonSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=500, trim_whitespace=True)


class CommunityInviteSerializer(serializers.Serializer):
    user_id = serializers.UUIDField()
    message = serializers.CharField(required=False, allow_blank=True, max_length=500)


class CommunityMessageSerializer(serializers.Serializer):
    message = serializers.CharField(required=False, allow_blank=True, max_length=500)


class PostInputSerializer(serializers.ModelSerializer):
    notify_members = serializers.BooleanField(required=False, default=False, write_only=True)
    job = serializers.PrimaryKeyRelatedField(queryset=JobPosting.objects.all(), required=False, allow_null=True)
    apply_url = serializers.URLField(required=False, allow_blank=True, max_length=500)

    class Meta:
        model = CommunityPost
        fields = ["kind", "title", "body", "job", "apply_url", "closes_at", "notify_members"]
        extra_kwargs = {"body": {"max_length": 5000}, "title": {"max_length": 200}}

    def validate_job(self, job):
        company = self.context.get("company")
        if job is not None and (job.company_id != getattr(company, "pk", None) or job.status == JobStatus.DRAFT):
            raise serializers.ValidationError("Choose a published job of your company.")
        return job


def community_row(community, **extra):
    return {
        "id": community.pk, "name": community.name, "slug": community.slug, "description": community.description, "mission": community.mission,
        "join_mode": community.join_mode, "status": community.status, "member_count": community.member_count,
        "filters": {
            "universities": community.filter_universities, "degrees": community.filter_degrees, "grad_year_from": community.filter_grad_year_from,
            "grad_year_to": community.filter_grad_year_to, "skills": community.filter_skills, "skill_mode": community.filter_skill_mode,
        },
        "created_at": community.created_at, **extra,
    }  # fmt: skip


def post_row(post, closed=False):
    return {
        "id": post.pk, "community_id": post.community_id, "kind": post.kind, "title": post.title, "body": post.body,
        "job_id": post.job_id, "apply_url": post.apply_url, "closes_at": post.closes_at, "closed": closed, "status": post.status,
        "created_at": post.created_at,
    }  # fmt: skip


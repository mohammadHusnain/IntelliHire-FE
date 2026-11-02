from rest_framework import serializers


class DashboardCompanySerializer(serializers.Serializer):
    name = serializers.CharField()
    logo = serializers.CharField(allow_null=True)
    status = serializers.CharField()
    profile_completion = serializers.IntegerField()


class DashboardJobsSerializer(serializers.Serializer):
    open = serializers.IntegerField()
    draft = serializers.IntegerField()
    closed = serializers.IntegerField()


class DashboardApplicantsSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    new_last_7_days = serializers.IntegerField()


class DashboardPipelineSerializer(serializers.Serializer):
    submitted = serializers.IntegerField()
    under_review = serializers.IntegerField()
    shortlisted = serializers.IntegerField()
    interview = serializers.IntegerField()
    selected = serializers.IntegerField()
    rejected = serializers.IntegerField()
    on_hold = serializers.IntegerField()


class ClosingSoonSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    title = serializers.CharField()
    deadline = serializers.DateTimeField()
    application_count = serializers.IntegerField()


class RecentApplicationSerializer(serializers.Serializer):
    candidate_name = serializers.CharField()
    job_title = serializers.CharField()
    submitted_at = serializers.DateTimeField()
    status = serializers.CharField()


class DashboardTeamSerializer(serializers.Serializer):
    active_members = serializers.IntegerField()
    pending_invitations = serializers.IntegerField()


class DashboardSerializer(serializers.Serializer):
    company = DashboardCompanySerializer()
    jobs = DashboardJobsSerializer()
    applicants = DashboardApplicantsSerializer()
    pipeline = DashboardPipelineSerializer()
    closing_soon = ClosingSoonSerializer(many=True)
    recent_applications = RecentApplicationSerializer(many=True)
    team = DashboardTeamSerializer()

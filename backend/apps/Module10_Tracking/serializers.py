"""Candidate-facing shapes. Whitelists on purpose: nothing from the company side (scores, notes, HR names) can leak through."""
from rest_framework import serializers


class StageSerializer(serializers.Serializer):
    key = serializers.CharField()
    label = serializers.CharField()
    state = serializers.ChoiceField(choices=["done", "current", "waiting", "skipped"])


class PendingInvitationSerializer(serializers.Serializer):
    kind = serializers.CharField(help_text="screening or technical")
    expires_at = serializers.DateTimeField()
    can_get_link = serializers.BooleanField(help_text="Use the `invitation/link` action to get a fresh link.")


class TrackedDecisionSerializer(serializers.Serializer):
    decision = serializers.CharField()
    label = serializers.CharField()
    decided_at = serializers.DateTimeField()


class TimelineSerializer(serializers.Serializer):
    status = serializers.CharField()
    label = serializers.CharField()
    at = serializers.DateTimeField()


class MyApplicationRowSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    reference = serializers.CharField()
    job_title = serializers.CharField()
    company_name = serializers.CharField()
    applied_at = serializers.DateTimeField()
    status = serializers.CharField()
    status_label = serializers.CharField()
    current_stage = serializers.CharField(allow_null=True, help_text="cv, screening, technical or decision; null once decided.")
    pending_invitation = serializers.BooleanField(help_text="An interview invitation is waiting.")


class MyApplicationDetailSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    reference = serializers.CharField()
    job_title = serializers.CharField()
    company_name = serializers.CharField()
    applied_at = serializers.DateTimeField()
    status = serializers.CharField()
    status_label = serializers.CharField()
    stages = StageSerializer(many=True)
    current_stage = serializers.CharField(allow_null=True)
    pending_invitation = PendingInvitationSerializer(allow_null=True)
    decision = TrackedDecisionSerializer(allow_null=True, help_text="Only once HR recorded a decision. HR's note is never shown.")
    timeline = TimelineSerializer(many=True)


class InterviewLinkSerializer(serializers.Serializer):
    url = serializers.CharField(help_text="The new private link. The one in the earlier email no longer works.")
    kind = serializers.CharField()
    expires_at = serializers.DateTimeField()


class DashboardInvitationSerializer(serializers.Serializer):
    application_id = serializers.UUIDField()
    reference = serializers.CharField()
    job_title = serializers.CharField()
    company_name = serializers.CharField()
    kind = serializers.CharField()
    expires_at = serializers.DateTimeField()


class ProfileCompletenessSerializer(serializers.Serializer):
    percent = serializers.IntegerField()
    missing = serializers.ListField(child=serializers.CharField())


class CandidateDashboardSerializer(serializers.Serializer):
    counts = serializers.DictField(child=serializers.IntegerField(), help_text="Applications by status label.")
    total = serializers.IntegerField()
    pending_invitations = DashboardInvitationSerializer(many=True)
    recent_mock_sessions = serializers.ListField(child=serializers.DictField(), help_text="The last 3 mock interviews (empty until Module 11).")
    unread_notifications = serializers.IntegerField()
    profile = ProfileCompletenessSerializer()


class RequestLinkSerializer(serializers.Serializer):
    email = serializers.EmailField()


class NeutralSerializer(serializers.Serializer):
    detail = serializers.CharField()

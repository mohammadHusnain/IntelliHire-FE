"""Platform-admin endpoints (FR-71 to FR-76, UC-13). Read everything; change only platform-level things."""
from django.http import HttpResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status as http
from rest_framework.exceptions import NotFound
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.common.errors import ApiError
from apps.common.pagination import StandardPagination
from apps.common.permissions import IsPlatformAdmin
from apps.Module1_Authentication.models import User
from apps.Module1_Authentication.views import PublicAPIView
from apps.Module12_Communities.models import Community
from apps.Module2_CompanyManagement.models import Company
from apps.Module3_JobPosting.models import JobPosting, JobStatus
from apps.Module5_Foundation.models import ActivityEvent, SystemAlert

from .models import FlagSource, FlagStatus, FlagTarget, ModerationFlag
from .serializers import (
    AdminReasonSerializer,
    AISettingsSerializer,
    FlagInputSerializer,
    PromptInputSerializer,
    PromptVersionSerializer,
    PublicReportSerializer,
    ReportInputSerializer,
    ResolveSerializer,
    RollbackSerializer,
    alert_row,
    flag_row,
)
from .services import ai_admin, details, metrics, moderation

OBJECT = OpenApiTypes.OBJECT


def _date(value, name):
    from datetime import date

    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ApiError(f"{name} must be a date (YYYY-MM-DD).", "invalid_filter", 400) from None


class _Admin(GenericAPIView):
    permission_classes = [IsPlatformAdmin]
    filter_backends = []
    pagination_class = StandardPagination
    queryset = ModerationFlag.objects.none()
    serializer_class = FlagInputSerializer

    def page(self, queryset, build):
        page = self.paginate_queryset(queryset)
        return self.get_paginated_response([build(item) for item in page])


class DashboardView(_Admin):
    pagination_class = None

    @extend_schema(summary="Platform dashboard", description="Users, companies, jobs, applications, interviews, communities, open flags, active alerts and the AI summary for the last 24 hours.", responses={200: OBJECT})
    def get(self, request):
        return Response(metrics.dashboard())


class UserDetailView(_Admin):
    pagination_class = None

    @extend_schema(summary="One account in full", description="Facts, company membership, last login, counts, the last 20 activity events by or about them, and open flags.", responses={200: OBJECT})
    def get(self, request, user_id):
        user = User.objects.select_related("company_membership__company").filter(pk=user_id).first()
        if user is None:
            raise NotFound("User not found.")
        return Response(details.user_detail(user))


class CompanyOnboardingView(_Admin):
    pagination_class = None

    @extend_schema(summary="A company's onboarding progress and staff", responses={200: OBJECT})
    def get(self, request, company_id):
        company = Company.objects.filter(pk=company_id).first()
        if company is None:
            raise NotFound("Company not found.")
        return Response(details.company_onboarding(company))


class JobMonitorView(_Admin):
    @extend_schema(
        operation_id="platform_admin_jobs_list", summary="Jobs across every company (read-only)",
        parameters=[OpenApiParameter("company", str, required=False), OpenApiParameter("status", str, enum=JobStatus.values, required=False), OpenApiParameter("q", str, required=False), OpenApiParameter("created_from", str, required=False), OpenApiParameter("created_to", str, required=False)],
        responses={200: OBJECT},
    )  # fmt: skip
    def get(self, request):
        p = request.query_params
        if p.get("status") and p["status"] not in JobStatus.values:
            raise ApiError("Unknown status.", "invalid_filter", 400)
        queryset = details.jobs_queryset(p.get("company") or None, p.get("status") or None, p.get("q", ""), _date(p.get("created_from"), "created_from"), _date(p.get("created_to"), "created_to"))
        return self.page(queryset, details.job_row)


class JobDetailView(_Admin):
    pagination_class = None

    @extend_schema(summary="One job (read-only)", responses={200: OBJECT})
    def get(self, request, job_id):
        job = JobPosting.objects.select_related("company", "created_by").filter(pk=job_id).first()
        if job is None:
            raise NotFound("Job not found.")
        return Response(details.job_detail(job))


class CommunityMonitorView(_Admin):
    @extend_schema(operation_id="platform_admin_communities_list", summary="Communities across every company (read-only)", parameters=[OpenApiParameter("company", str, required=False), OpenApiParameter("status", str, required=False), OpenApiParameter("q", str, required=False)], responses={200: OBJECT})
    def get(self, request):
        p = request.query_params
        return self.page(details.communities_queryset(p.get("company") or None, p.get("status") or None, p.get("q", "")), details.community_row)


class CommunityDetailView(_Admin):
    pagination_class = None

    @extend_schema(summary="One community (read-only), with its recent posts", responses={200: OBJECT})
    def get(self, request, community_id):
        community = Community.objects.select_related("company").filter(pk=community_id).first()
        if community is None:
            raise NotFound("Community not found.")
        return Response(details.community_detail(community))


class FlagCreateView(_Admin):
    pagination_class = None

    @extend_schema(summary="Flag something for review", request=FlagInputSerializer, responses={201: OBJECT})
    def post(self, request):
        data = FlagInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        flag, _ = moderation.raise_flag(source=FlagSource.ADMIN, reported_by=request.user, **data.validated_data)
        return Response(flag_row(flag, moderation.describe(flag)), status=http.HTTP_201_CREATED)


class ModerationQueueView(_Admin):
    @extend_schema(
        summary="The moderation queue",
        parameters=[OpenApiParameter("status", str, enum=FlagStatus.values, required=False), OpenApiParameter("target_type", str, enum=FlagTarget.values, required=False)],
        responses={200: OBJECT},
    )  # fmt: skip
    def get(self, request):
        queryset = ModerationFlag.objects.select_related("reported_by", "resolved_by")
        p = request.query_params
        for field, allowed in (("status", FlagStatus.values), ("target_type", FlagTarget.values)):
            if p.get(field):
                if p[field] not in allowed:
                    raise ApiError(f"Unknown {field}.", "invalid_filter", 400)
                queryset = queryset.filter(**{field: p[field]})
        return self.page(queryset, lambda f: flag_row(f, moderation.describe(f)))


class _FlagAction(_Admin):
    pagination_class = None

    def flag(self, flag_id):
        found = ModerationFlag.objects.select_related("reported_by", "resolved_by").filter(pk=flag_id).first()
        if found is None:
            raise NotFound("Flag not found.")
        return found


class FlagReviewView(_FlagAction):
    @extend_schema(summary="Mark a flag as being reviewed", request=None, responses={200: OBJECT})
    def post(self, request, flag_id):
        return Response(flag_row(moderation.review(self.flag(flag_id))))


class FlagResolveView(_FlagAction):
    serializer_class = ResolveSerializer

    @extend_schema(
        summary="Resolve a flag",
        description="A note is always required. `action: act` takes the one action that fits the target (suspend the user or company, close the job, remove the community, archive the post) through the existing service. A flag whose target is gone can only be dismissed.",
        request=ResolveSerializer, responses={200: OBJECT},
    )  # fmt: skip
    def post(self, request, flag_id):
        flag = self.flag(flag_id)
        data = ResolveSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        resolved = moderation.resolve(flag, request.user, data.validated_data["note"], data.validated_data["action"] == "act")
        return Response(flag_row(resolved, moderation.describe(resolved)))


class ActivityView(_Admin):
    @extend_schema(
        operation_id="platform_admin_activity_list", summary="The activity log (read-only)",
        parameters=[OpenApiParameter(n, str, required=False) for n in ("event_type", "actor", "company", "from", "to")],
        responses={200: OBJECT},
    )  # fmt: skip
    def get(self, request):
        p = request.query_params
        queryset = details.activity_queryset(p.get("event_type") or None, p.get("actor") or None, p.get("company") or None, _date(p.get("from"), "from"), _date(p.get("to"), "to"))
        return self.page(queryset, details.activity_row)


class ActivityExportView(_Admin):
    pagination_class = None

    @extend_schema(summary="Export the filtered log as CSV", description="UTF-8 with a BOM, spreadsheet-safe, capped at 5000 rows. The log itself can never be edited.", parameters=[OpenApiParameter(n, str, required=False) for n in ("event_type", "actor", "company", "from", "to")], responses={(200, "text/csv"): OpenApiTypes.STR})
    def get(self, request):
        p = request.query_params
        queryset = details.activity_queryset(p.get("event_type") or None, p.get("actor") or None, p.get("company") or None, _date(p.get("from"), "from"), _date(p.get("to"), "to"))
        response = HttpResponse(details.activity_csv(queryset), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="activity-{details.stamp()}.csv"'
        return response


class ActivityDetailView(_Admin):
    pagination_class = None

    @extend_schema(summary="One log entry with its metadata", responses={200: OBJECT})
    def get(self, request, event_id):
        event = ActivityEvent.objects.select_related("actor").filter(pk=event_id).first()
        if event is None:
            raise NotFound("Event not found.")
        return Response(details.activity_row(event, metadata=True))


class ActivityFlagView(_Admin):
    pagination_class = None
    serializer_class = AdminReasonSerializer

    @extend_schema(summary="Flag what a log entry points at", request=AdminReasonSerializer, responses={201: OBJECT})
    def post(self, request, event_id):
        event = ActivityEvent.objects.filter(pk=event_id).first()
        if event is None:
            raise NotFound("Event not found.")
        data = AdminReasonSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        if not event.target_type or not event.target_id:
            raise ApiError("This entry does not point at anything that can be flagged.", "no_target", 400)
        flag, _ = moderation.raise_flag(target_type=event.target_type, target_id=event.target_id, reason=data.validated_data["reason"], source=FlagSource.ADMIN, reported_by=request.user)
        return Response(flag_row(flag, moderation.describe(flag)), status=http.HTTP_201_CREATED)


class HealthView(_Admin):
    pagination_class = None

    @extend_schema(summary="System health", description="Database, storage, broker, worker heartbeat, email queue, AI in the last hour, CPU, memory and disk, active alerts and the last successful backup (with a warning after 26 hours).", responses={200: OBJECT})
    def get(self, request):
        return Response(metrics.health())


class AlertListView(_Admin):
    @extend_schema(summary="System alerts", parameters=[OpenApiParameter("active", bool, required=False)], responses={200: OBJECT})
    def get(self, request):
        queryset = SystemAlert.objects.all().order_by("-created_at")
        value = request.query_params.get("active")
        if value is not None:
            queryset = queryset.filter(is_active=value.lower() == "true")
        return self.page(queryset, alert_row)


class AlertAcknowledgeView(_Admin):
    pagination_class = None

    @extend_schema(summary="Acknowledge an alert (it hides until the condition returns)", request=None, responses={200: OBJECT})
    def post(self, request, alert_id):
        from django.utils import timezone

        alert = SystemAlert.objects.filter(pk=alert_id).first()
        if alert is None:
            raise NotFound("Alert not found.")
        SystemAlert.objects.filter(pk=alert.pk, acknowledged_at__isnull=True).update(acknowledged_at=timezone.now(), acknowledged_by=request.user)
        alert.refresh_from_db()
        return Response(alert_row(alert))


class AISettingsView(_Admin):
    pagination_class = None
    serializer_class = AISettingsSerializer

    @extend_schema(summary="AI settings", responses={200: AISettingsSerializer})
    def get(self, request):
        return Response(AISettingsSerializer(ai_admin.settings_row()).data)

    @extend_schema(summary="Change the AI settings", description="Models must be in the allowed list; every change is audited with the old and new values. API keys live in the environment and are never read or written here.", request=AISettingsSerializer, responses={200: AISettingsSerializer})
    def put(self, request):
        data = AISettingsSerializer(ai_admin.settings_row(), data=request.data, partial=True)
        data.is_valid(raise_exception=True)
        return Response(AISettingsSerializer(ai_admin.save_settings(request.user, data.validated_data)).data)


class PromptListView(_Admin):
    pagination_class = None

    @extend_schema(summary="Prompt keys with their active version", responses={200: OBJECT})
    def get(self, request):
        return Response(ai_admin.prompt_keys())


class PromptVersionsView(_Admin):
    pagination_class = None
    serializer_class = PromptInputSerializer

    @extend_schema(summary="Every version of one prompt, newest first", responses={200: PromptVersionSerializer(many=True)})
    def get(self, request, key):
        return Response(PromptVersionSerializer(ai_admin.versions_of(key), many=True).data)

    @extend_schema(summary="Save a new version (it becomes active)", description="The schema must be valid JSON Schema and the texts must keep every placeholder the active version used.", request=PromptInputSerializer, responses={201: PromptVersionSerializer})
    def post(self, request, key):
        data = PromptInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        return Response(PromptVersionSerializer(ai_admin.save_version(key, request.user, data.validated_data)).data, status=http.HTTP_201_CREATED)


class PromptRollbackView(_Admin):
    pagination_class = None
    serializer_class = RollbackSerializer

    @extend_schema(summary="Make an earlier version active again", request=RollbackSerializer, responses={200: PromptVersionSerializer})
    def post(self, request, key):
        data = RollbackSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        return Response(PromptVersionSerializer(ai_admin.rollback(key, request.user, data.validated_data["version"])).data)


class AIUsageView(_Admin):
    pagination_class = None

    @extend_schema(summary="AI usage per feature per day", description="No data means no rows, not an error.", parameters=[OpenApiParameter(n, str, required=False) for n in ("from", "to", "feature")], responses={200: OBJECT})
    def get(self, request):
        p = request.query_params
        return Response(metrics.ai_usage(_date(p.get("from"), "from"), _date(p.get("to"), "to"), p.get("feature") or None))


# --- Reporting content (not admin-only) --------------------------------------------------------------------------
class ReportView(APIView):
    """Any signed-in user can report a job, community or post."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "report_content"
    serializer_class = ReportInputSerializer

    @extend_schema(
        summary="Report content", description="Reporting the same thing twice within 24 hours returns the flag already raised.",
        request=ReportInputSerializer, responses={201: OBJECT, 429: OBJECT},
    )  # fmt: skip
    def post(self, request):
        data = ReportInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        flag, created = moderation.raise_flag(source=FlagSource.REPORTED, reported_by=request.user, **data.validated_data)
        return Response({"id": flag.pk, "status": flag.status, "created": created}, status=http.HTTP_201_CREATED)


class PublicReportJobView(PublicAPIView):
    """A visitor can report a job from its public page."""

    throttle_scope = "report_public"
    serializer_class = PublicReportSerializer

    @extend_schema(
        summary="Report a public job", description="Always 201, whether or not the slug exists, so the form cannot be used to probe. Deduplicated per address and job for 24 hours; the address is only ever stored as a hash.",
        request=PublicReportSerializer, responses={201: OBJECT},
    )  # fmt: skip
    def post(self, request):
        data = PublicReportSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        job = JobPosting.objects.filter(form_slug=data.validated_data["form_slug"]).exclude(status=JobStatus.DRAFT).first()
        if job is not None:
            from rest_framework.throttling import BaseThrottle

            moderation.raise_flag(
                target_type=FlagTarget.JOB, target_id=job.pk, reason=data.validated_data["reason"], source=FlagSource.REPORTED,
                reporter_fingerprint=moderation.fingerprint(BaseThrottle().get_ident(request)),
            )  # fmt: skip
        return Response({"detail": "Thank you. Our team will look into it."}, status=http.HTTP_201_CREATED)

"""Candidate (JWT) and public (tracking link) endpoints. Thin: they find the application and call a service."""
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework.exceptions import NotFound
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from apps.common.errors import ApiError
from apps.common.pagination import StandardPagination
from apps.common.permissions import IsCandidate
from apps.Module1_Authentication.views import PublicAPIView
from apps.Module4_ApplicationManagement.models import Application
from apps.Module5_Foundation.serializers import ErrorSerializer

from .labels import STATUS_LABELS
from .serializers import (
    MyApplicationDetailSerializer,
    MyApplicationRowSerializer,
    CandidateDashboardSerializer,
    InterviewLinkSerializer,
    NeutralSerializer,
    RequestLinkSerializer,
)
from .services import access, dashboard, interview_link, lost_links

NOT_YOURS = OpenApiResponse(ErrorSerializer, description="No such application, or it is not yours.")
NO_INVITE = OpenApiResponse(ErrorSerializer, description="No interview is waiting (code `no_pending_interview`).")
TOO_MANY = OpenApiResponse(ErrorSerializer, description="Too many requests.")


class _CandidateView(GenericAPIView):
    permission_classes = [IsCandidate]
    filter_backends = []
    pagination_class = None
    queryset = Application.objects.none()

    def application(self, request, application_id):
        application = access.of_candidate(request.user).filter(pk=application_id).first()
        if application is None:
            raise NotFound("Application not found.")
        return application


def _row(data):
    return {**data, "pending_invitation": data["pending_invitation"] is not None}


class CandidateApplicationsView(_CandidateView):
    serializer_class = MyApplicationRowSerializer
    pagination_class = StandardPagination

    @extend_schema(
        summary="My applications",
        description="Every application tied to this account (made while signed in, or with its verified email), newest first, with the current stage and whether an interview invitation is waiting. No scores or notes, ever.",
        parameters=[OpenApiParameter("status", str, enum=list(STATUS_LABELS), required=False)],
        responses={200: MyApplicationRowSerializer(many=True), 400: OpenApiResponse(ErrorSerializer, description="Unknown status (code `invalid_filter`).")},
    )
    def get(self, request):
        queryset = access.of_candidate(request.user).order_by("-submitted_at", "-pk")
        status = request.query_params.get("status")
        if status:
            if status not in STATUS_LABELS:
                raise ApiError("Unknown status.", "invalid_filter", 400)
            queryset = queryset.filter(status=status)
        page = self.paginate_queryset(queryset)
        return self.get_paginated_response(MyApplicationRowSerializer([_row(access.summary(a)) for a in page], many=True).data)


class CandidateApplicationView(_CandidateView):
    serializer_class = MyApplicationDetailSerializer

    @extend_schema(
        summary="One of my applications",
        description="Status label, the four-stage tracker, a waiting interview invitation, HR's decision (only once recorded; never the note) and a timeline of labels and dates.",
        responses={200: MyApplicationDetailSerializer, 404: NOT_YOURS},
    )
    def get(self, request, application_id):
        return Response(access.detail(self.application(request, application_id)))


class CandidateInterviewLinkView(_CandidateView):
    serializer_class = InterviewLinkSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "track_link"

    @extend_schema(
        summary="Get a fresh link for the interview that is waiting",
        description="Issues a new private link and invalidates the earlier one (the raw link is never stored, so it cannot be shown again).",
        request=None,
        responses={200: InterviewLinkSerializer, 404: NO_INVITE, 429: TOO_MANY},
    )
    def post(self, request, application_id):
        return Response(interview_link.issue(self.application(request, application_id)))


class CandidateDashboardView(_CandidateView):
    serializer_class = CandidateDashboardSerializer

    @extend_schema(
        summary="My dashboard",
        description="Applications by label, interview invitations waiting, the last 3 mock sessions, unread notifications and profile completeness.",
        responses={200: CandidateDashboardSerializer},
    )
    def get(self, request):
        return Response(dashboard.build(request.user))


# --- Public: the private tracking link -------------------------------------------------------------------------
class _TrackView(PublicAPIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "track_open"

    def application(self, token):
        application = access.by_tracking_token(token)
        if application is None:
            raise NotFound("Application not found.")
        return application


class PublicTrackView(_TrackView):
    serializer_class = MyApplicationDetailSerializer

    @extend_schema(
        summary="Follow an application with its private link",
        description="The same single-application view a signed-in candidate gets. The token in the path is the whole credential.",
        responses={200: MyApplicationDetailSerializer, 404: OpenApiResponse(ErrorSerializer, description="Unknown link."), 429: TOO_MANY},
    )
    def get(self, request, token):
        return Response(access.detail(self.application(token)))


class PublicTrackLinkView(_TrackView):
    serializer_class = InterviewLinkSerializer
    throttle_scope = "track_link"

    @extend_schema(
        summary="Get a fresh link for the interview that is waiting",
        description="Issues a new private interview link and invalidates the earlier one.",
        request=None,
        responses={200: InterviewLinkSerializer, 404: NO_INVITE, 429: TOO_MANY},
    )
    def post(self, request, token):
        return Response(interview_link.issue(self.application(token)))


class PublicRequestLinkView(PublicAPIView):
    serializer_class = RequestLinkSerializer
    throttle_scope = "track_request"

    @extend_schema(
        summary="Lost link: email me fresh tracking links",
        description=(
            "Always answers 200 with the same message, whether or not the address applied, so nobody can probe which emails "
            "did. Fresh links for every application made with that address are emailed, and replace the old ones. "
            "Limited to 3 requests per hour per IP address, and 3 such emails per hour to one address."
        ),
        request=RequestLinkSerializer,
        responses={200: NeutralSerializer, 400: OpenApiResponse(description="Not an email address."), 429: TOO_MANY},
    )
    def post(self, request):
        data = RequestLinkSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        lost_links.request_links(data.validated_data["email"])
        return Response({"detail": lost_links.NEUTRAL})

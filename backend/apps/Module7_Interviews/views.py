"""Company-side endpoints (JWT). Thin: they find the object inside the caller's company and call a service."""
from django.db.models import Count, Q
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response

from apps.common.errors import ApiError
from apps.common.pagination import StandardPagination
from apps.common.permissions import IsCompanyUser
from apps.Module3_JobPosting.models import JobPosting
from apps.Module3_JobPosting.services.queries import jobs_of
from apps.Module4_ApplicationManagement.models import Application
from apps.Module4_ApplicationManagement.services.review import applications_of
from apps.Module5_Foundation.serializers import ErrorSerializer

from .models import InterviewSession, SessionKind, SessionStatus
from .permissions import CanManageInterviews, CanReevaluate
from .serializers import (
    ExpiryResponseSerializer,
    ExtendSerializer,
    InterviewDetailSerializer,
    InterviewSessionSerializer,
    InviteResponseSerializer,
    InviteSerializer,
)
from .services import actions
from .services.invite import invite

NOT_FOUND = OpenApiResponse(ErrorSerializer, description="No such application, job or interview in your company.")
FORBIDDEN = OpenApiResponse(ErrorSerializer, description="Your role may not do this (viewers only read).")
CLOSED = OpenApiResponse(ErrorSerializer, description="The interview is already closed (code `interview_closed`).")


def company_of(request):
    return request.user.company_membership.company


def sessions_of(company):
    """Every interview of the company's applications, with the answered count computed in the same query."""
    return (
        InterviewSession.objects.filter(application__job__company=company)
        .select_related("application", "created_by")
        .annotate(answered=Count("turns", filter=Q(turns__answered_at__isnull=False)))
    )


def session_of(request, session_id):
    try:
        return sessions_of(company_of(request)).get(pk=session_id)
    except InterviewSession.DoesNotExist:
        raise NotFound("Interview not found.") from None


def _fresh(request, session):
    return session_of(request, session.pk)


class _View(GenericAPIView):
    permission_classes = [IsCompanyUser]
    filter_backends = []
    pagination_class = None
    queryset = InterviewSession.objects.none()


class ApplicationInterviewsView(_View):
    serializer_class = InterviewSessionSerializer

    def get_permissions(self):
        return [IsCompanyUser() if self.request.method == "GET" else CanManageInterviews()]

    def _application(self, request, application_id):
        try:
            return applications_of(company_of(request)).get(pk=application_id)
        except Application.DoesNotExist:
            raise NotFound("Application not found.") from None

    @extend_schema(
        summary="Interviews sent to one candidate",
        description="Every interview of this application, newest first, with its status, score and recommendation (empty until evaluated).",
        responses={200: InterviewSessionSerializer(many=True), 404: NOT_FOUND},
    )
    def get(self, request, application_id):
        application = self._application(request, application_id)
        sessions = sessions_of(company_of(request)).filter(application=application).order_by("-invited_at", "-id")
        return Response(InterviewSessionSerializer(sessions, many=True).data)

    @extend_schema(
        summary="Invite the candidate to an interview (admin, HR manager, recruiter)",
        description=(
            "Creates the interview, moves the application to `interview` and emails the candidate a private link "
            "(never returned here). Allowed for a shortlisted application or one already at `interview`; from any other "
            "status send `override: true` and a `note`. Only `screening` can be sent today."
        ),
        request=InviteSerializer,
        responses={
            201: InviteResponseSerializer,
            400: OpenApiResponse(description="Invalid input, or a kind that cannot be sent yet (`kind_not_available`)."),
            403: FORBIDDEN, 404: NOT_FOUND,
            409: OpenApiResponse(ErrorSerializer, description="An open interview of this kind exists (`open_session_exists`), the status needs an override (`prerequisite_missing`), or the company is not active (`company_not_active`)."),
        },  # fmt: skip
    )
    def post(self, request, application_id):
        application = self._application(request, application_id)
        data = InviteSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        session = invite(
            application, kind=data.validated_data["kind"], user=request.user,
            expires_in_days=data.validated_data.get("expires_in_days"), override=data.validated_data["override"],
            note=data.validated_data.get("note", ""),
        )  # fmt: skip
        fresh = _fresh(request, session)
        fresh.invite_warnings = getattr(session, "invite_warnings", [])
        return Response(InviteResponseSerializer(fresh).data, status=status.HTTP_201_CREATED)


class InterviewDetailView(_View):
    serializer_class = InterviewDetailSerializer

    @extend_schema(
        summary="One interview in full",
        description="The transcript, each answer's score and feedback when present, the report and the AI disclaimer. Candidates never see this.",
        responses={200: InterviewDetailSerializer, 404: NOT_FOUND},
    )
    def get(self, request, session_id):
        session = sessions_of(company_of(request)).prefetch_related("turns").filter(pk=session_id).first()
        if session is None:
            raise NotFound("Interview not found.")
        return Response(InterviewDetailSerializer(session).data)


class _ActionView(_View):
    permission_classes = [CanManageInterviews]
    serializer_class = InterviewSessionSerializer


class InterviewResendView(_ActionView):
    @extend_schema(
        summary="Send the link again with a new token",
        description="The old link stops working. The deadline stays the same.",
        request=None,
        responses={200: InterviewSessionSerializer, 403: FORBIDDEN, 404: NOT_FOUND, 409: CLOSED},
    )
    def post(self, request, session_id):
        session = actions.resend(session_of(request, session_id), request.user)
        return Response(InterviewSessionSerializer(_fresh(request, session)).data)


class InterviewExtendView(_ActionView):
    serializer_class = ExtendSerializer

    @extend_schema(
        summary="Extend the deadline by 1 to 14 days",
        description="Counted from the later of the current deadline and now. An expired link comes back to life.",
        request=ExtendSerializer,
        responses={200: ExpiryResponseSerializer, 400: OpenApiResponse(description="`days` outside 1 to 14."), 403: FORBIDDEN, 404: NOT_FOUND, 409: CLOSED},
    )
    def post(self, request, session_id):
        session = session_of(request, session_id)  # another company's interview is 404 before anything else is checked
        data = ExtendSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        session = actions.extend(session, request.user, data.validated_data["days"])
        return Response({"expires_at": session.expires_at})


class InterviewCancelView(_ActionView):
    @extend_schema(
        summary="Cancel the interview and kill its link",
        description="The application's status is not changed.",
        request=None,
        responses={200: InterviewSessionSerializer, 403: FORBIDDEN, 404: NOT_FOUND, 409: CLOSED},
    )
    def post(self, request, session_id):
        session = actions.cancel(session_of(request, session_id), request.user)
        return Response(InterviewSessionSerializer(_fresh(request, session)).data)


class InterviewReevaluateView(_ActionView):
    permission_classes = [CanReevaluate]

    @extend_schema(
        summary="Score the interview and write the report again (admin, HR manager)",
        description="Runs in the background. Answers that cannot be re-scored keep their earlier score. Does nothing until the scoring code is connected.",
        request=None,
        responses={
            202: OpenApiResponse(description="Queued."), 403: FORBIDDEN, 404: NOT_FOUND,
            409: OpenApiResponse(ErrorSerializer, description="The interview is not finished (`not_completed`) or an evaluation is running (`evaluation_running`)."),
        },  # fmt: skip
    )
    def post(self, request, session_id):
        actions.reevaluate(session_of(request, session_id), request.user)
        return Response({"detail": "Evaluation queued."}, status=status.HTTP_202_ACCEPTED)


class JobInterviewsView(_View):
    serializer_class = InterviewSessionSerializer
    pagination_class = StandardPagination

    @extend_schema(
        summary="Interviews of one job",
        parameters=[
            OpenApiParameter("kind", str, enum=SessionKind.values, required=False),
            OpenApiParameter("status", str, enum=SessionStatus.values, required=False),
        ],
        responses={200: InterviewSessionSerializer(many=True), 400: OpenApiResponse(ErrorSerializer, description="Unknown `kind` or `status` (code `invalid_filter`)."), 404: NOT_FOUND},
    )
    def get(self, request, job_id):
        try:
            job = jobs_of(company_of(request)).get(pk=job_id)
        except JobPosting.DoesNotExist:
            raise NotFound("Job not found.") from None
        sessions = sessions_of(company_of(request)).filter(application__job=job)
        for field, allowed in (("kind", SessionKind.values), ("status", SessionStatus.values)):
            value = request.query_params.get(field)
            if value:
                if value not in allowed:
                    raise ApiError(f"Unknown {field}.", "invalid_filter", 400)
                sessions = sessions.filter(**{field: value})
        page = self.paginate_queryset(sessions.order_by("-invited_at", "-id"))
        return self.get_paginated_response(InterviewSessionSerializer(page, many=True).data)

"""Candidate endpoints (JWT). Thin: they find the caller's own session and call a service or the shared interview engine."""
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import status as http
from rest_framework.exceptions import NotFound
from rest_framework.generics import GenericAPIView
from rest_framework.parsers import JSONParser
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from apps.common.errors import ApiError
from apps.common.pagination import StandardPagination
from apps.common.parsers import LimitedMultiPartParser
from apps.common.permissions import IsCandidate
from apps.Module5_Foundation.serializers import ErrorSerializer
from apps.Module7_Interviews.models import InterviewSession, SessionStatus
from apps.Module7_Interviews.serializers import AnswerSerializer, PublicProgressSerializer
from apps.Module7_Interviews.services import engine

from .models import InterviewRole, InterviewType
from .serializers import CreateMockSerializer, MockDetailSerializer, MockRowSerializer, MockProgressSerializer, RoleSerializer
from .services import history, progress, sessions

NOT_YOURS = OpenApiResponse(ErrorSerializer, description="No such session, or it is not yours.")
GONE = OpenApiResponse(ErrorSerializer, description="The session is finished or closed (code `interview_completed`, `interview_cancelled`, `interview_expired`).")


class _MockView(GenericAPIView):
    permission_classes = [IsCandidate]
    filter_backends = []
    pagination_class = None
    queryset = InterviewSession.objects.none()

    def session(self, request, session_id):
        found = history.mine(request.user).filter(pk=session_id).first()
        if found is None:
            raise NotFound("Session not found.")
        return found


class RolesView(_MockView):
    serializer_class = RoleSerializer
    pagination_class = StandardPagination

    @extend_schema(
        summary="The role catalog",
        parameters=[OpenApiParameter("q", str, required=False, description="Search title, category and description."), OpenApiParameter("category", str, required=False)],
        responses={200: RoleSerializer(many=True)},
    )
    def get(self, request):
        roles = InterviewRole.objects.filter(is_active=True)
        if request.query_params.get("category"):
            roles = roles.filter(category__iexact=request.query_params["category"])
        term = (request.query_params.get("q") or "").strip()
        if term:
            from django.db.models import Q

            roles = roles.filter(Q(title__icontains=term) | Q(category__icontains=term) | Q(description__icontains=term))
        page = self.paginate_queryset(roles)
        return self.get_paginated_response(RoleSerializer(page, many=True).data)


class MockListCreateView(_MockView):
    serializer_class = MockRowSerializer
    pagination_class = StandardPagination

    @extend_schema(
        summary="My mock interviews, newest first",
        parameters=[OpenApiParameter("status", str, enum=SessionStatus.values, required=False)],
        responses={200: MockRowSerializer(many=True), 400: OpenApiResponse(ErrorSerializer, description="Unknown status (code `invalid_filter`).")},
    )
    def get(self, request):
        queryset = history.mine(request.user).order_by("-invited_at", "-id")
        value = request.query_params.get("status")
        if value:
            if value not in SessionStatus.values:
                raise ApiError("Unknown status.", "invalid_filter", 400)
            queryset = queryset.filter(status=value)
        page = self.paginate_queryset(queryset)
        return self.get_paginated_response(MockRowSerializer([history.row(s) for s in page], many=True).data)

    @extend_schema(
        summary="Start a practice interview",
        description=(
            "Creates the session (no questions are asked until `start`). Checks, in order: no other session in progress "
            "(409, with `session_id` to resume), fewer than 5 sessions today (429, with `resets_at` and `Retry-After`), and for "
            "`use_cv` a CV with readable text on your profile (400 `cv_missing`). A general interview never needs a CV."
        ),
        request=CreateMockSerializer,
        responses={
            201: MockDetailSerializer, 400: OpenApiResponse(description="Invalid input, or no CV for `use_cv` (code `cv_missing`)."),
            409: OpenApiResponse(description="A session is already in progress: {detail, code: session_in_progress, session_id}."),
            429: OpenApiResponse(description="Daily limit reached: {detail, code: daily_limit, resets_at}."),
        },  # fmt: skip
    )
    def post(self, request):
        data = CreateMockSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        values = data.validated_data
        role = None
        if values["interview_type"] == InterviewType.ROLE_SPECIFIC:
            role = InterviewRole.objects.filter(pk=values.get("role_id"), is_active=True).first()
            if role is None:
                raise ApiError("Choose a role from the catalog.", "role_not_found", 400)
        try:
            session = sessions.create(request.user, interview_type=values["interview_type"], role=role, use_cv=values["use_cv"], question_count=values.get("question_count"))
        except sessions.OpenSessionExists as exc:
            return Response(
                {"detail": "You already have a practice interview in progress. Resume or end it first.", "code": "session_in_progress", "session_id": exc.session_id},
                status=http.HTTP_409_CONFLICT,
            )
        except sessions.DailyLimitReached as exc:
            wait = max(1, int((exc.resets_at - timezone.now()).total_seconds()))
            return Response(
                {"detail": "You have reached today's limit of practice interviews. Try again tomorrow.", "code": "daily_limit", "resets_at": exc.resets_at},
                status=http.HTTP_429_TOO_MANY_REQUESTS, headers={"Retry-After": str(wait)},
            )
        return Response(history.detail(session), status=http.HTTP_201_CREATED)


class MockDetailView(_MockView):
    serializer_class = MockDetailSerializer

    @extend_schema(
        summary="One mock interview",
        description="While it is open: the question waiting for an answer. Once it is done: the full report and the transcript. Only yours.",
        responses={200: MockDetailSerializer, 404: NOT_YOURS},
    )
    def get(self, request, session_id):
        session = self.session(request, session_id)
        session = history.mine(request.user).prefetch_related("turns").get(pk=session.pk)
        return Response(history.detail(session))

    @extend_schema(
        summary="Delete a mock interview and its transcript",
        description="A hard delete of the questions, answers, feedback and CV excerpt (privacy). An event is kept without any content, and the session still counts towards today's allowance.",
        responses={204: OpenApiResponse(description="Deleted."), 404: NOT_YOURS},
    )
    def delete(self, request, session_id):
        sessions.delete(self.session(request, session_id), request.user)
        return Response(status=http.HTTP_204_NO_CONTENT)


class MockStartView(_MockView):
    serializer_class = PublicProgressSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "interview_answer"

    @extend_schema(
        summary="Start the interview, or resume it",
        description="The first question, or the one still waiting after a break or a refresh. Same behaviour as the screening interview.",
        request=None,
        responses={200: PublicProgressSerializer, 404: NOT_YOURS, 410: GONE, 429: OpenApiResponse(ErrorSerializer, description="Too many requests."), 503: OpenApiResponse(ErrorSerializer, description="No question could be made right now; try again (`Retry-After`).")},
    )
    def post(self, request, session_id):
        return Response(engine.start(self.session(request, session_id)))


class MockAnswerView(_MockView):
    serializer_class = AnswerSerializer
    parser_classes = [JSONParser, LimitedMultiPartParser]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "interview_answer"

    @extend_schema(
        summary="Answer the current question",
        description=(
            "Send `turn_index` and either `answer_text` (JSON) or an `audio` file (multipart). Answering the same question twice returns "
            "the stored result. The answer is saved before it is scored. Returns the next question, or `done: true` after the last one. "
            "Voice answers are 422 `voice_not_available` until speech-to-text is connected."
        ),
        request={"application/json": AnswerSerializer, "multipart/form-data": AnswerSerializer},
        responses={
            200: PublicProgressSerializer, 400: OpenApiResponse(description="Empty or too long answer."), 404: NOT_YOURS,
            409: OpenApiResponse(ErrorSerializer, description="Not the current question (`wrong_turn`) or not started (`not_started`)."), 410: GONE,
            422: OpenApiResponse(ErrorSerializer, description="Voice is not available yet, or the recording could not be read. Ask the candidate to type."),
            429: OpenApiResponse(ErrorSerializer, description="Too many requests."), 503: OpenApiResponse(ErrorSerializer, description="No question could be made right now."),
        },  # fmt: skip
    )
    def post(self, request, session_id):
        session = self.session(request, session_id)
        data = AnswerSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        values = data.validated_data
        return Response(engine.answer(session, values["turn_index"], values.get("answer_text"), values.get("audio")))


class MockEndView(_MockView):
    serializer_class = MockDetailSerializer

    @extend_schema(
        summary="End the interview early",
        description="With at least 3 answers the session is finished with partial feedback. With fewer it is cancelled and does not count towards the daily limit.",
        request=None,
        responses={200: MockDetailSerializer, 404: NOT_YOURS, 409: OpenApiResponse(ErrorSerializer, description="Already closed (`session_closed`).")},
    )
    def post(self, request, session_id):
        ended = sessions.end(self.session(request, session_id))
        return Response(history.detail(history.mine(request.user).prefetch_related("turns").get(pk=ended.pk)))


class MockFeedbackRetryView(_MockView):
    @extend_schema(
        summary="Try generating the feedback again",
        request=None,
        responses={202: OpenApiResponse(description="Queued."), 404: NOT_YOURS, 409: OpenApiResponse(ErrorSerializer, description="The feedback has not failed (`not_failed`).")},
    )
    def post(self, request, session_id):
        sessions.retry_feedback(self.session(request, session_id))
        return Response({"detail": "Feedback queued."}, status=http.HTTP_202_ACCEPTED)


class MockProgressView(_MockView):
    serializer_class = MockProgressSerializer

    @extend_schema(
        summary="My progress",
        description="Score over time, the average per dimension over the last 10 scored sessions, best and latest score and a trend. With no scored sessions this is an empty state, not an error.",
        responses={200: MockProgressSerializer},
    )
    def get(self, request):
        return Response(progress.compute(request.user))

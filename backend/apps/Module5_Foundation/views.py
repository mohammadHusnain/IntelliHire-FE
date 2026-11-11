from django.utils import timezone
from drf_spectacular.utils import OpenApiExample, OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework.exceptions import NotFound
from rest_framework.generics import GenericAPIView, ListAPIView
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from apps.common.errors import ApiError

from .models import Notification
from .serializers import CountSerializer, ErrorSerializer, NotificationSerializer

TRUE, FALSE = {"true", "1"}, {"false", "0"}

UNAUTHORIZED = OpenApiResponse(ErrorSerializer, description="Missing, expired or invalid access token, or the account is not active.")
THROTTLED = OpenApiResponse(ErrorSerializer, description="More than 120 requests per minute from this user.")
NOT_FOUND = OpenApiResponse(ErrorSerializer, description="No such notification for this user. Another user's notification looks exactly the same.")
ROW_EXAMPLE = {
    "id": "0b1f6c1e-6a5e-4a54-9a64-3a7f3c3b5f10",
    "kind": "interview_invited",
    "title": "You have been invited to an interview",
    "body": "Backend Developer at Acme Labs. Open the link before 18 November.",
    "link": "/candidate/applications/5d3c2b0e-1d55-4c1e-8c0e-9d3b8a1f7a22",
    "payload": {"application_id": "5d3c2b0e-1d55-4c1e-8c0e-9d3b8a1f7a22"},
    "read": False,
    "read_at": None,
    "created_at": "2026-11-11T12:00:00Z",
}


class _Mine:
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "notifications"

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Notification.objects.none()
        return Notification.objects.filter(user=self.request.user)


class NotificationListView(_Mine, ListAPIView):
    serializer_class = NotificationSerializer
    filter_backends = []

    @extend_schema(
        summary="My notifications, newest first",
        description=(
            "The signed-in user's own in-app notifications, for any kind of account (candidate, company user or platform "
            "admin). Text is plain: show it as text, never as HTML. `link` is empty or a path inside the frontend."
        ),
        parameters=[
            OpenApiParameter("unread", bool, required=False, description="true: only unread; false: only read; omit for both."),
        ],
        responses={
            200: NotificationSerializer(many=True),
            400: OpenApiResponse(ErrorSerializer, description="`unread` is not true or false (code `invalid_filter`)."),
            401: UNAUTHORIZED,
            429: THROTTLED,
        },
        examples=[OpenApiExample("A page", value={"count": 1, "next": None, "previous": None, "results": [ROW_EXAMPLE]}, response_only=True, status_codes=["200"])],
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        queryset = super().get_queryset()
        raw = self.request.query_params.get("unread")
        if raw is None or raw == "":
            return queryset
        value = raw.lower()
        if value not in TRUE | FALSE:
            raise ApiError("unread must be true or false.", "invalid_filter", 400)
        return queryset.filter(read_at__isnull=value in TRUE)


class UnreadCountView(_Mine, GenericAPIView):
    serializer_class = CountSerializer
    pagination_class = None

    @extend_schema(
        summary="How many notifications are unread",
        description="For the notification bell badge.",
        responses={200: CountSerializer, 401: UNAUTHORIZED, 429: THROTTLED},
        examples=[OpenApiExample("Three unread", value={"count": 3}, response_only=True)],
    )
    def get(self, request):
        return Response({"count": self.get_queryset().filter(read_at__isnull=True).count()})


class MarkReadView(_Mine, GenericAPIView):
    serializer_class = NotificationSerializer
    pagination_class = None

    @extend_schema(
        summary="Mark one notification as read (safe to repeat)",
        description="Sets `read_at` the first time; calling it again changes nothing and keeps the first time.",
        request=None,
        responses={200: NotificationSerializer, 401: UNAUTHORIZED, 404: NOT_FOUND, 429: THROTTLED},
    )
    def post(self, request, notification_id):
        queryset = self.get_queryset().filter(pk=notification_id)
        if not queryset.exists():
            raise NotFound("Notification not found.")
        queryset.filter(read_at__isnull=True).update(read_at=timezone.now())
        return Response(NotificationSerializer(queryset.get()).data)


class MarkAllReadView(_Mine, GenericAPIView):
    serializer_class = CountSerializer
    pagination_class = None

    @extend_schema(
        summary="Mark every notification as read; returns how many changed",
        description="Only the caller's own unread notifications are touched. `count` is how many changed, so a second call returns 0.",
        request=None,
        responses={200: CountSerializer, 401: UNAUTHORIZED, 429: THROTTLED},
        examples=[OpenApiExample("Two changed", value={"count": 2}, response_only=True)],
    )
    def post(self, request):
        count = self.get_queryset().filter(read_at__isnull=True).update(read_at=timezone.now())
        return Response({"count": count})

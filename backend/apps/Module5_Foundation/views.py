from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import NotFound
from rest_framework.generics import GenericAPIView, ListAPIView
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from apps.common.errors import ApiError

from .models import Notification
from .serializers import CountSerializer, NotificationSerializer

TRUE, FALSE = {"true", "1"}, {"false", "0"}


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
        parameters=[OpenApiParameter("unread", bool, required=False, description="true: only unread; false: only read.")],
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

    @extend_schema(summary="How many notifications are unread", responses=CountSerializer)
    def get(self, request):
        return Response({"count": self.get_queryset().filter(read_at__isnull=True).count()})


class MarkReadView(_Mine, GenericAPIView):
    serializer_class = NotificationSerializer
    pagination_class = None

    @extend_schema(summary="Mark one notification as read (safe to repeat)", request=None, responses=NotificationSerializer)
    def post(self, request, notification_id):
        queryset = self.get_queryset().filter(pk=notification_id)
        if not queryset.exists():
            raise NotFound("Notification not found.")
        queryset.filter(read_at__isnull=True).update(read_at=timezone.now())
        return Response(NotificationSerializer(queryset.get()).data)


class MarkAllReadView(_Mine, GenericAPIView):
    serializer_class = CountSerializer
    pagination_class = None

    @extend_schema(summary="Mark every notification as read; returns how many changed", request=None, responses=CountSerializer)
    def post(self, request):
        count = self.get_queryset().filter(read_at__isnull=True).update(read_at=timezone.now())
        return Response({"count": count})

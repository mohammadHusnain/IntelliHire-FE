from django.urls import path

from .consumer import InterviewLiveConsumer

# The token travels in the first frame, not the path, so it never reaches an access log.
websocket_urlpatterns = [path("ws/interviews/live/", InterviewLiveConsumer.as_asgi())]

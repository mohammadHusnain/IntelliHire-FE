import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.production")

from django.core.asgi import get_asgi_application  # noqa: E402

django_application = get_asgi_application()  # must run before anything imports models

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402

from apps.Module7_Interviews.live.routing import websocket_urlpatterns  # noqa: E402

# No AuthMiddlewareStack: a candidate has no account, only their interview token, which is
# checked inside the consumer. No channel layer either - each call talks to its own Gemini
# session, so there is no group fan-out to route.
application = ProtocolTypeRouter({
    "http": django_application,
    "websocket": URLRouter(websocket_urlpatterns),
})

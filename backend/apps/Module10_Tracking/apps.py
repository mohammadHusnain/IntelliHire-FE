from django.apps import AppConfig


class TrackingConfig(AppConfig):
    name = "apps.Module10_Tracking"
    label = "tracking"

    def ready(self):
        from . import receivers  # noqa: F401

from django.apps import AppConfig


class InterviewsConfig(AppConfig):
    name = "apps.Module7_Interviews"
    label = "interviews"

    def ready(self):
        from . import receivers  # noqa: F401

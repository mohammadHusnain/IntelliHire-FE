from django.apps import AppConfig


class TechnicalInterviewConfig(AppConfig):
    name = "apps.Module8_TechnicalInterview"
    label = "technical_interview"

    def ready(self):
        from apps.Module7_Interviews.services import kinds

        from . import receivers  # noqa: F401
        from .rules import TechnicalRules

        kinds.register(TechnicalRules())

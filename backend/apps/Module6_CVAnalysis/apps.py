from django.apps import AppConfig


class CVAnalysisConfig(AppConfig):
    name = "apps.Module6_CVAnalysis"
    label = "cv_analysis"

    def ready(self):
        from . import receivers  # noqa: F401

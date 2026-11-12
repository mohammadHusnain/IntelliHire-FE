from django.apps import AppConfig


class EvaluationConfig(AppConfig):
    name = "apps.Module9_Evaluation"
    label = "evaluation"

    def ready(self):
        from apps.Module4_ApplicationManagement.services import review

        from . import receivers  # noqa: F401
        from .services.decision import record_in_status_change

        # The old status endpoint keeps working for selected, rejected and on_hold, but now always writes a decision row.
        review.decision_recorder = record_in_status_change

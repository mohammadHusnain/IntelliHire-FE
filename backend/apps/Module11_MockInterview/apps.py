from django.apps import AppConfig


class MockInterviewConfig(AppConfig):
    name = "apps.Module11_MockInterview"
    label = "mock_interview"

    def ready(self):
        from apps.Module7_Interviews.services import kinds
        from apps.Module10_Tracking.services import dashboard

        from .rules import MockRules
        from .services import history

        kinds.register(MockRules())
        dashboard.register_recent_mock_provider(history.recent_for_dashboard)

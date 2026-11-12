from django.urls import path

from . import views

# Mounted at /api/applications/
urlpatterns = [
    path("<uuid:application_id>/evaluation/", views.ApplicationEvaluationView.as_view(), name="application-evaluation"),
    path("<uuid:application_id>/evaluation/generate/", views.EvaluationGenerateView.as_view(), name="application-evaluation-generate"),
    path("<uuid:application_id>/evaluation/pdf/", views.EvaluationPdfView.as_view(), name="application-evaluation-pdf"),
    path("<uuid:application_id>/decision/", views.ApplicationDecisionView.as_view(), name="application-decision"),
    path("<uuid:application_id>/decisions/", views.ApplicationDecisionsView.as_view(), name="application-decisions"),
]

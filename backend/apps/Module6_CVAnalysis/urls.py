from django.urls import path

from . import views

urlpatterns = [
    path("<uuid:application_id>/cv-analysis/", views.CVAnalysisView.as_view(), name="application-cv-analysis"),
    path("<uuid:application_id>/cv-analysis/rerun/", views.CVAnalysisRerunView.as_view(), name="application-cv-analysis-rerun"),
]

from django.urls import path

from . import views

urlpatterns = [
    path("<uuid:job_id>/screening-config/", views.ScreeningConfigView.as_view(), name="job-screening-config"),
    path("<uuid:job_id>/cv-screening/", views.ScreeningProgressView.as_view(), name="job-cv-screening"),
    path("<uuid:job_id>/cv-screening/run/", views.RunScreeningView.as_view(), name="job-cv-screening-run"),
    path("<uuid:job_id>/ranking/", views.RankingView.as_view(), name="job-ranking"),
    path("<uuid:job_id>/shortlist/apply-threshold/", views.ApplyThresholdView.as_view(), name="job-apply-threshold"),
]

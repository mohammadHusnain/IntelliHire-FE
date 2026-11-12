from django.urls import path

from . import views

# Mounted at /api/jobs/
urlpatterns = [
    path("<uuid:job_id>/evaluation-weights/", views.EvaluationWeightsView.as_view(), name="job-evaluation-weights"),
    path("<uuid:job_id>/evaluations/", views.JobEvaluationsView.as_view(), name="job-evaluations"),
    path("<uuid:job_id>/evaluations/compare/", views.EvaluationCompareView.as_view(), name="job-evaluations-compare"),
]

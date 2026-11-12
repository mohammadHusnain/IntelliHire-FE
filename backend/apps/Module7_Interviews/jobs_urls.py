from django.urls import path

from . import views

# Mounted at /api/jobs/
urlpatterns = [
    path("<uuid:job_id>/interviews/", views.JobInterviewsView.as_view(), name="job-interviews"),
]

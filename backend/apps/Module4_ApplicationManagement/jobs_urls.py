from django.urls import path

from .views import review

urlpatterns = [
    path("<uuid:job_id>/applications/", review.JobApplicationListView.as_view(), name="job-application-list"),
    path("<uuid:job_id>/applications/export/", review.JobApplicationExportView.as_view(), name="job-application-export"),
]

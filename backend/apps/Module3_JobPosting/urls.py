from django.urls import path

from .views import fields, jobs

urlpatterns = [
    path("", jobs.JobListCreateView.as_view(), name="job-list"),
    path("<uuid:job_id>/", jobs.JobDetailView.as_view(), name="job-detail"),
    path("<uuid:job_id>/publish/", jobs.JobPublishView.as_view(), name="job-publish"),
    path("<uuid:job_id>/close/", jobs.JobCloseView.as_view(), name="job-close"),
    path("<uuid:job_id>/reopen/", jobs.JobReopenView.as_view(), name="job-reopen"),
    path("<uuid:job_id>/duplicate/", jobs.JobDuplicateView.as_view(), name="job-duplicate"),
    path("<uuid:job_id>/form-preview/", jobs.JobFormPreviewView.as_view(), name="job-form-preview"),
    path("<uuid:job_id>/fields/", fields.FieldListCreateView.as_view(), name="field-list"),
    path("<uuid:job_id>/fields/reorder/", fields.FieldReorderView.as_view(), name="field-reorder"),
    path("<uuid:job_id>/fields/<int:field_id>/", fields.FieldDetailView.as_view(), name="field-detail"),
]

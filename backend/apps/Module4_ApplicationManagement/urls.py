from django.urls import path

from .views import review

urlpatterns = [
    path("", review.CompanyApplicationListView.as_view(), name="application-list"),
    path("<uuid:application_id>/", review.ApplicationDetailView.as_view(), name="application-detail"),
    path("<uuid:application_id>/status/", review.ApplicationStatusView.as_view(), name="application-status"),
    path("<uuid:application_id>/resume/", review.ApplicationResumeView.as_view(), name="application-resume"),
    path("<uuid:application_id>/files/<slug:field_key>/", review.ApplicationFileView.as_view(), name="application-file"),
]

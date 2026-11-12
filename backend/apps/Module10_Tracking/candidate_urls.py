from django.urls import path

from . import views

# Mounted at /api/candidate/
urlpatterns = [
    path("applications/", views.CandidateApplicationsView.as_view(), name="candidate-applications"),
    path("applications/<uuid:application_id>/", views.CandidateApplicationView.as_view(), name="candidate-application"),
    path("applications/<uuid:application_id>/invitation/link/", views.CandidateInterviewLinkView.as_view(), name="candidate-interview-link"),
    path("dashboard/", views.CandidateDashboardView.as_view(), name="candidate-dashboard"),
]

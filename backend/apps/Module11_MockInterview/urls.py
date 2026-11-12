from django.urls import path

from . import views

# Mounted at /api/mock-interviews/ (roles and progress come before the id so they are never read as one)
urlpatterns = [
    path("roles/", views.RolesView.as_view(), name="mock-roles"),
    path("progress/", views.MockProgressView.as_view(), name="mock-progress"),
    path("", views.MockListCreateView.as_view(), name="mock-interviews"),
    path("<uuid:session_id>/", views.MockDetailView.as_view(), name="mock-interview"),
    path("<uuid:session_id>/start/", views.MockStartView.as_view(), name="mock-start"),
    path("<uuid:session_id>/answer/", views.MockAnswerView.as_view(), name="mock-answer"),
    path("<uuid:session_id>/end/", views.MockEndView.as_view(), name="mock-end"),
    path("<uuid:session_id>/feedback/retry/", views.MockFeedbackRetryView.as_view(), name="mock-feedback-retry"),
]

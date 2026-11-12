from django.urls import path

from . import views

# Mounted at /api/interviews/
urlpatterns = [
    path("<uuid:session_id>/", views.InterviewDetailView.as_view(), name="interview-detail"),
    path("<uuid:session_id>/resend/", views.InterviewResendView.as_view(), name="interview-resend"),
    path("<uuid:session_id>/extend/", views.InterviewExtendView.as_view(), name="interview-extend"),
    path("<uuid:session_id>/cancel/", views.InterviewCancelView.as_view(), name="interview-cancel"),
    path("<uuid:session_id>/reevaluate/", views.InterviewReevaluateView.as_view(), name="interview-reevaluate"),
]

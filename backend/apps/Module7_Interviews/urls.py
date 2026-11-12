from django.urls import path

from . import views

# Mounted at /api/applications/
urlpatterns = [
    path("<uuid:application_id>/interviews/", views.ApplicationInterviewsView.as_view(), name="application-interviews"),
]

from django.urls import path

from . import views

# Mounted at /api/public/ (request-link comes first so it is never read as a token)
urlpatterns = [
    path("track/request-link/", views.PublicRequestLinkView.as_view(), name="track-request-link"),
    path("track/<str:token>/", views.PublicTrackView.as_view(), name="track"),
    path("track/<str:token>/invitation/link/", views.PublicTrackLinkView.as_view(), name="track-interview-link"),
]

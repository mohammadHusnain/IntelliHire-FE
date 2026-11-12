from django.urls import path

from . import public_views as views

urlpatterns = [
    path("interviews/<str:token>/", views.PublicInterviewView.as_view(), name="public-interview"),
    path("interviews/<str:token>/start/", views.PublicInterviewStartView.as_view(), name="public-interview-start"),
    path("interviews/<str:token>/answer/", views.PublicInterviewAnswerView.as_view(), name="public-interview-answer"),
    path("interviews/<str:token>/finish/", views.PublicInterviewFinishView.as_view(), name="public-interview-finish"),
]

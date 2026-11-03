from django.urls import path

from .views import public

urlpatterns = [
    path("jobs/<str:form_slug>/", public.PublicJobView.as_view(), name="public-job"),
]

from django.urls import path

from .views import public

urlpatterns = [
    path("jobs/<str:form_slug>/apply/", public.ApplyView.as_view(), name="public-apply"),
]

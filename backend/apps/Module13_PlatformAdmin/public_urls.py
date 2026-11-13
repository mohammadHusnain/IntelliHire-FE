from django.urls import path

from . import views

urlpatterns = [path("report-job/", views.PublicReportJobView.as_view(), name="public-report-job")]

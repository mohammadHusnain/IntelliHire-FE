from django.urls import path

from .views import registration

urlpatterns = [
    path("register/company/", registration.CompanyRegisterView.as_view(), name="register-company"),
    path("register/company/resubmit/", registration.CompanyResubmitView.as_view(), name="register-company-resubmit"),
]

from django.urls import path

from . import views

urlpatterns = [
    path("register/company/", views.CompanyRegisterView.as_view(), name="register-company"),
]

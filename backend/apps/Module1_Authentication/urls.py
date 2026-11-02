from django.urls import path

from . import views

app_name = "accounts"

urlpatterns = [
    path("register/candidate/", views.CandidateRegisterView.as_view(), name="register-candidate"),
    path("verify-email/", views.VerifyEmailView.as_view(), name="verify-email"),
    path("resend-verification/", views.ResendVerificationView.as_view(), name="resend-verification"),
    path("login/", views.LoginView.as_view(), name="login"),
    path("token/refresh/", views.TokenRefreshView.as_view(), name="token-refresh"),
    path("logout/", views.LogoutView.as_view(), name="logout"),
    path("password/forgot/", views.ForgotPasswordView.as_view(), name="password-forgot"),
    path("password/reset/", views.ResetPasswordView.as_view(), name="password-reset"),
    path("password/change/", views.ChangePasswordView.as_view(), name="password-change"),
    path("me/", views.MeView.as_view(), name="me"),
    path("profile/", views.ProfileView.as_view(), name="profile"),
    path("profile/resume/", views.ProfileResumeView.as_view(), name="profile-resume"),
    path("profile/education/", views.EducationListCreateView.as_view(), name="education-list"),
    path("profile/education/<int:pk>/", views.EducationDetailView.as_view(), name="education-detail"),
    path("profile/experience/", views.ExperienceListCreateView.as_view(), name="experience-list"),
    path("profile/experience/<int:pk>/", views.ExperienceDetailView.as_view(), name="experience-detail"),
]

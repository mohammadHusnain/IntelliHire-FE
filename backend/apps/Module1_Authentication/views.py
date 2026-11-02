from django.http import FileResponse
from django.utils.decorators import method_decorator
from django.views.decorators.debug import sensitive_post_parameters
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.generics import GenericAPIView, ListCreateAPIView, RetrieveUpdateAPIView
from rest_framework.mixins import DestroyModelMixin, UpdateModelMixin
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from apps.common.errors import ApiError
from apps.common.parsers import LimitedMultiPartParser
from apps.common.permissions import IsCandidate, IsPlatformAdmin

from . import services
from .models import CandidateProfile, Education, Experience
from .serializers import (
    MAX_EDUCATION_ROWS,
    MAX_EXPERIENCE_ROWS,
    CandidateProfileSerializer,
    CandidateRegistrationSerializer,
    ChangePasswordSerializer,
    DetailSerializer,
    EducationSerializer,
    EmailOnlySerializer,
    ExperienceSerializer,
    LoginResponseSerializer,
    LoginSerializer,
    MeUpdateSerializer,
    RefreshTokenSerializer,
    RegistrationResponseSerializer,
    ResetPasswordSerializer,
    ResumeResponseSerializer,
    ResumeUploadSerializer,
    TokenPairSerializer,
    UserSerializer,
    VerifyEmailResponseSerializer,
    VerifyEmailSerializer,
)

SENSITIVE_FIELDS = ("password", "confirm_password", "old_password", "new_password", "refresh", "token")
sensitive = method_decorator(sensitive_post_parameters(*SENSITIVE_FIELDS), name="dispatch")


class PublicAPIView(GenericAPIView):
    """Open endpoint: no authentication (a stale token must not break it), throttled per scope."""

    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]


@sensitive
class CandidateRegisterView(PublicAPIView):
    serializer_class = CandidateRegistrationSerializer
    throttle_scope = "register"

    @extend_schema(responses={201: RegistrationResponseSerializer})
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = services.register_candidate(
            full_name=serializer.validated_data["full_name"],
            email=serializer.validated_data["email"],
            password=serializer.validated_data["password"],
        )
        return Response({"email": user.email, "status": user.status}, status=status.HTTP_201_CREATED)


@sensitive
class VerifyEmailView(PublicAPIView):
    serializer_class = VerifyEmailSerializer

    @extend_schema(responses={200: VerifyEmailResponseSerializer})
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user, changed = services.verify_email(serializer.validated_data["token"])
        message = "Email verified." if changed else "Email already verified."
        return Response({"detail": message, "status": user.status})


class ResendVerificationView(PublicAPIView):
    serializer_class = EmailOnlySerializer
    throttle_scope = "resend_verification"

    @extend_schema(responses={200: DetailSerializer})
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.resend_verification(serializer.validated_data["email"])
        return Response({"detail": "If that email needs verification, a new link has been sent."})


@sensitive
class LoginView(PublicAPIView):
    serializer_class = LoginSerializer
    throttle_scope = "login"

    @extend_schema(responses={200: LoginResponseSerializer})
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user, tokens = services.login(serializer.validated_data["email"], serializer.validated_data["password"])
        return Response({**tokens, "user": UserSerializer(user).data})


@sensitive
class TokenRefreshView(PublicAPIView):
    serializer_class = RefreshTokenSerializer

    @extend_schema(responses={200: TokenPairSerializer})
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(services.refresh_tokens(serializer.validated_data["refresh"]))


@sensitive
class LogoutView(GenericAPIView):
    serializer_class = RefreshTokenSerializer

    @extend_schema(responses={205: OpenApiResponse(description="Refresh token blacklisted.")})
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.logout(request.user, serializer.validated_data["refresh"])
        return Response(status=status.HTTP_205_RESET_CONTENT)


class ForgotPasswordView(PublicAPIView):
    serializer_class = EmailOnlySerializer
    throttle_scope = "password_reset"

    @extend_schema(responses={200: DetailSerializer})
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.forgot_password(serializer.validated_data["email"])
        return Response({"detail": "If that email is registered, a reset link has been sent."})


@sensitive
class ResetPasswordView(PublicAPIView):
    serializer_class = ResetPasswordSerializer
    throttle_scope = "password_reset_confirm"

    @extend_schema(responses={200: DetailSerializer})
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        services.reset_password(data["uid"], data["token"], data["new_password"])
        return Response({"detail": "Password has been reset."})


@sensitive
class ChangePasswordView(GenericAPIView):
    serializer_class = ChangePasswordSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    @extend_schema(responses={200: DetailSerializer})
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        services.change_password(request.user, data["old_password"], data["new_password"])
        return Response({"detail": "Password changed. Please log in again."})


class MeView(GenericAPIView):
    serializer_class = UserSerializer
    http_method_names = ["get", "patch", "head", "options"]

    @extend_schema(responses={200: UserSerializer})
    def get(self, request):
        return Response(UserSerializer(request.user).data)

    @extend_schema(request=MeUpdateSerializer, responses={200: UserSerializer})
    def patch(self, request):
        serializer = MeUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if "full_name" in serializer.validated_data:
            request.user.full_name = serializer.validated_data["full_name"]
            request.user.save(update_fields=["full_name"])
        return Response(UserSerializer(request.user).data)


def _own_profile(user):
    profile, _ = CandidateProfile.objects.prefetch_related("education", "experience").get_or_create(user=user)
    return profile


class ProfileView(RetrieveUpdateAPIView):
    serializer_class = CandidateProfileSerializer
    permission_classes = [IsCandidate]
    http_method_names = ["get", "patch", "head", "options"]

    def get_object(self):
        return _own_profile(self.request.user)


class ProfileResumeView(GenericAPIView):
    permission_classes = [IsCandidate]
    parser_classes = [LimitedMultiPartParser]
    serializer_class = ResumeUploadSerializer
    http_method_names = ["get", "put", "head", "options"]

    @extend_schema(responses={200: OpenApiResponse(description="The CV file as an attachment.")})
    def get(self, request):
        profile = _own_profile(request.user)
        if not profile.resume:
            raise NotFound("No resume uploaded.")
        response = FileResponse(
            profile.resume.open("rb"),
            as_attachment=True,
            filename=profile.resume_original_name or "resume",
        )
        response["Cache-Control"] = "private, no-store"
        return response

    @extend_schema(request=ResumeUploadSerializer, responses={200: ResumeResponseSerializer})
    def put(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.replace_resume(_own_profile(request.user), serializer.validated_data["resume"])
        return Response({"resume": "/api/auth/profile/resume/"})


class _ProfileRowsMixin:
    permission_classes = [IsCandidate]
    pagination_class = None
    filter_backends = []
    model = None
    max_rows = 0

    def get_queryset(self):
        return self.model.objects.filter(profile__user=self.request.user)


class EducationListCreateView(_ProfileRowsMixin, ListCreateAPIView):
    serializer_class = EducationSerializer
    model = Education
    max_rows = MAX_EDUCATION_ROWS

    def perform_create(self, serializer):
        if self.get_queryset().count() >= self.max_rows:
            raise ApiError(f"You can add at most {self.max_rows} entries.", "limit_reached")
        serializer.save(profile=_own_profile(self.request.user))


class ExperienceListCreateView(EducationListCreateView):
    serializer_class = ExperienceSerializer
    model = Experience
    max_rows = MAX_EXPERIENCE_ROWS


class EducationDetailView(_ProfileRowsMixin, UpdateModelMixin, DestroyModelMixin, GenericAPIView):
    serializer_class = EducationSerializer
    model = Education
    http_method_names = ["patch", "delete", "options"]

    def patch(self, request, *args, **kwargs):
        return self.partial_update(request, *args, **kwargs)

    def delete(self, request, *args, **kwargs):
        return self.destroy(request, *args, **kwargs)


class ExperienceDetailView(EducationDetailView):
    serializer_class = ExperienceSerializer
    model = Experience


class _UserStatusView(GenericAPIView):
    permission_classes = [IsPlatformAdmin]
    serializer_class = UserSerializer


class SuspendUserView(_UserStatusView):
    @extend_schema(request=None, responses={200: UserSerializer})
    def post(self, request, user_id):
        return Response(UserSerializer(services.suspend_user(actor=request.user, user_id=user_id)).data)


class ReactivateUserView(_UserStatusView):
    @extend_schema(request=None, responses={200: UserSerializer})
    def post(self, request, user_id):
        return Response(UserSerializer(services.reactivate_user(user_id=user_id)).data)

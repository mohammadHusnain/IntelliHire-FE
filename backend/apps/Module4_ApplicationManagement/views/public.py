import ipaddress

from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.response import Response
from rest_framework.throttling import BaseThrottle

from apps.Module1_Authentication.authentication import StatusAwareJWTAuthentication
from apps.Module1_Authentication.views import PublicAPIView
from apps.common.choices import UserRole
from apps.common.parsers import LimitedMultiPartParser

from ..serializers.applications import ApplySerializer, PublicSubmissionResponseSerializer
from ..services.submission import new_reference, public_job, submit_application

# A field real users never see or fill. It cannot clash with a custom field key (keys never contain "-").
HONEYPOT_FIELD = "hp-website"


def _optional_candidate(request):
    """The logged-in candidate if a valid candidate token came along; never required, never an error."""
    try:
        result = StatusAwareJWTAuthentication().authenticate(request)
    except AuthenticationFailed:
        return None
    if result and result[0].role == UserRole.CANDIDATE:
        return result[0]
    return None


def _client_ip(request):
    ident = BaseThrottle().get_ident(request)
    try:
        return str(ipaddress.ip_address(ident))
    except ValueError:
        return None


class ApplyView(PublicAPIView):
    parser_classes = [LimitedMultiPartParser]
    serializer_class = ApplySerializer
    throttle_scope = "public_apply"

    @extend_schema(
        request={"multipart/form-data": ApplySerializer},
        description=(
            "Submit an application as multipart/form-data, without any account. Send every field of the job's "
            "form (see `GET /api/public/jobs/<form_slug>/`) as a form field named by its `key`; files go as file "
            "parts (the CV as `resume`, custom file fields under their key). **Multiple-choice answers are sent "
            "as repeated keys** (one form field per chosen option). Unknown keys are ignored. Leave the hidden "
            "`hp-website` field empty. The request is refused with 410 once the job stops accepting applications."
        ),
        responses={
            201: PublicSubmissionResponseSerializer,
            400: OpenApiResponse(description="Every invalid field at once: {field_key: [message]}."),
            404: OpenApiResponse(description="Unknown slug or draft."),
            410: OpenApiResponse(description="The position is no longer accepting applications."),
            429: OpenApiResponse(description="Too many submissions from this address."),
            503: OpenApiResponse(description="Temporary storage failure; nothing was saved."),
        },
    )
    def post(self, request, form_slug):
        job = public_job(form_slug)
        if request.data.get(HONEYPOT_FIELD):
            # A bot filled the hidden field: answer exactly like a success, but save and send nothing.
            return Response(
                {
                    "reference": new_reference(),
                    "job_title": job.title,
                    "company": job.company.name,
                    "submitted_at": timezone.now(),
                },
                status=status.HTTP_201_CREATED,
            )
        application = submit_application(
            job=job,
            data=request.data,
            files=request.FILES,
            candidate=_optional_candidate(request),
            ip_address=_client_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
        )
        return Response(
            {
                "reference": application.reference,
                "job_title": job.title,
                "company": job.company.name,
                "submitted_at": application.submitted_at,
            },
            status=status.HTTP_201_CREATED,
        )

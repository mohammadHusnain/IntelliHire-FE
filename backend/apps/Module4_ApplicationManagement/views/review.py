from django.http import FileResponse, StreamingHttpResponse
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework.exceptions import NotFound
from rest_framework.generics import GenericAPIView
from rest_framework import status
from rest_framework.response import Response

from apps.Module3_JobPosting.models import JobPosting
from apps.Module3_JobPosting.services.queries import jobs_of
from apps.common.permissions import IsCompanyUser

from ..filters import CompanyApplicationFilter, JobApplicationFilter
from ..models import Application
from ..permissions import CanChangeStatus
from ..serializers.applications import (
    ApplicationDetailSerializer,
    ApplicationListResponseSerializer,
    ApplicationListSerializer,
    ApplicationNoteSerializer,
    CompanyApplicationListSerializer,
    NoteCreateSerializer,
    StatusChangeSerializer,
)
from ..services import review

SEARCH_HELP = "Part of the full name, email or reference."
ORDERING_HELP = "submitted_at, full_name or cv_score; prefix with - for descending (default: newest first)."


def company_of(request):
    return request.user.company_membership.company


def job_of(company, job_id):
    try:
        return jobs_of(company).get(pk=job_id)
    except JobPosting.DoesNotExist:
        raise NotFound("Job not found.")


def _download(file_field, original_name):
    response = FileResponse(file_field.open("rb"), as_attachment=True, filename=original_name or "file")
    response["Cache-Control"] = "private, no-store"
    return response


class _ApplicationList(GenericAPIView):
    permission_classes = [IsCompanyUser]
    search_fields = ["full_name", "email", "reference"]
    ordering_fields = ["submitted_at", "full_name", "cv_score"]
    ordering = ["-submitted_at", "-id"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Application.objects.none()
        return review.applications_of(company_of(self.request))


_LIST_PARAMETERS = [
    OpenApiParameter("search", str, required=False, description=SEARCH_HELP),
    OpenApiParameter("ordering", str, required=False, description=ORDERING_HELP),
]


class JobApplicationListView(_ApplicationList):
    filterset_class = JobApplicationFilter
    serializer_class = ApplicationListSerializer

    @extend_schema(
        parameters=_LIST_PARAMETERS,
        description="Paginated applications of one job, plus `status_counts` for the job (all statuses and `total`).",
        responses={200: ApplicationListResponseSerializer},
    )
    def get(self, request, job_id):
        job = job_of(company_of(request), job_id)
        page = self.paginate_queryset(self.filter_queryset(self.get_queryset().filter(job=job)))
        response = self.get_paginated_response(ApplicationListSerializer(page, many=True).data)
        response.data["status_counts"] = review.status_counts(job)
        return response


class CompanyApplicationListView(_ApplicationList):
    filterset_class = CompanyApplicationFilter
    serializer_class = CompanyApplicationListSerializer

    @extend_schema(
        parameters=_LIST_PARAMETERS,
        description="Paginated applications across all of the company's jobs; `?job=<id>` narrows to one job.",
        responses={200: CompanyApplicationListSerializer(many=True)},
    )
    def get(self, request):
        page = self.paginate_queryset(self.filter_queryset(self.get_queryset()))
        return self.get_paginated_response(CompanyApplicationListSerializer(page, many=True).data)


class ApplicationDetailView(GenericAPIView):
    permission_classes = [IsCompanyUser]
    serializer_class = ApplicationDetailSerializer
    filter_backends = []

    @extend_schema(responses={200: ApplicationDetailSerializer})
    def get(self, request, application_id):
        application = review.get_application(company_of(request), application_id)
        return Response(ApplicationDetailSerializer(application).data)


class ApplicationStatusView(GenericAPIView):
    permission_classes = [CanChangeStatus]
    serializer_class = StatusChangeSerializer
    filter_backends = []
    http_method_names = ["patch", "options"]

    @extend_schema(request=StatusChangeSerializer, responses={200: ApplicationDetailSerializer})
    def patch(self, request, application_id):
        serializer = StatusChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        company = company_of(request)
        review.change_status(
            company=company,
            application_id=application_id,
            user=request.user,
            new_status=serializer.validated_data["status"],
            note=serializer.validated_data["note"],
        )
        return Response(ApplicationDetailSerializer(review.get_application(company, application_id)).data)


class ApplicationNotesView(GenericAPIView):
    """Free notes on an application: everyone in the company reads them, admin/HR/recruiter write them."""

    serializer_class = NoteCreateSerializer
    filter_backends = []
    pagination_class = None

    def get_permissions(self):
        return [CanChangeStatus() if self.request.method == "POST" else IsCompanyUser()]

    @extend_schema(responses={200: ApplicationNoteSerializer(many=True)})
    def get(self, request, application_id):
        notes = review.list_notes(company_of(request), application_id)
        return Response(ApplicationNoteSerializer(notes, many=True).data)

    @extend_schema(request=NoteCreateSerializer, responses={201: ApplicationNoteSerializer})
    def post(self, request, application_id):
        serializer = NoteCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        note = review.add_note(
            company=company_of(request), application_id=application_id, user=request.user, text=serializer.validated_data["text"]
        )
        return Response(ApplicationNoteSerializer(note).data, status=status.HTTP_201_CREATED)


class ApplicationResumeView(GenericAPIView):
    permission_classes = [IsCompanyUser]
    serializer_class = ApplicationDetailSerializer
    filter_backends = []

    @extend_schema(responses={200: OpenApiResponse(description="The CV as an attachment (original file name).")})
    def get(self, request, application_id):
        application = review.get_application(company_of(request), application_id)
        return _download(application.resume, application.resume_original_name)


class ApplicationFileView(GenericAPIView):
    permission_classes = [IsCompanyUser]
    serializer_class = ApplicationDetailSerializer
    filter_backends = []

    @extend_schema(responses={200: OpenApiResponse(description="A custom file answer as an attachment.")})
    def get(self, request, application_id, field_key):
        application = review.get_application(company_of(request), application_id)
        record = next((item for item in application.files.all() if item.field_key == field_key), None)
        if record is None:
            raise NotFound("File not found.")
        return _download(record.file, record.original_name)


class JobApplicationExportView(GenericAPIView):
    permission_classes = [IsCompanyUser]
    serializer_class = ApplicationListSerializer
    filter_backends = []
    pagination_class = None

    @extend_schema(responses={200: OpenApiResponse(description="CSV of the job's applications (UTF-8 with BOM).")})
    def get(self, request, job_id):
        job = job_of(company_of(request), job_id)
        response = StreamingHttpResponse(review.export_rows(job), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="applications-{job.form_slug or job.pk}.csv"'
        response["Cache-Control"] = "private, no-store"
        return response

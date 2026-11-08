from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response

from apps.common.permissions import IsCompanyUser

from ..filters import JobFilter
from ..models import JobPosting
from ..permissions import CanEditJobs, CanManageJobs
from ..serializers.jobs import (
    FormSchemaSerializer,
    JobDetailSerializer,
    JobListSerializer,
    JobWriteSerializer,
    ReopenSerializer,
)
from ..services import form, lifecycle
from ..services.queries import departments_of, get_job, jobs_of
from .common import company_of, job_response_data


class JobListCreateView(GenericAPIView):
    serializer_class = JobWriteSerializer
    filterset_class = JobFilter
    search_fields = ["title"]
    ordering_fields = ["created_at", "deadline", "applications_count"]
    ordering = ["-created_at", "-id"]

    def get_permissions(self):
        return [IsCompanyUser() if self.request.method == "GET" else CanEditJobs()]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return JobPosting.objects.none()
        return jobs_of(company_of(self.request))

    @extend_schema(
        parameters=[
            OpenApiParameter("search", str, required=False, description="Part of the job title."),
            OpenApiParameter(
                "ordering",
                str,
                required=False,
                description="created_at, deadline or applications_count; prefix with - for descending.",
            ),
        ],
        responses={200: JobListSerializer(many=True)},
    )
    def get(self, request):
        page = self.paginate_queryset(self.filter_queryset(self.get_queryset()))
        return self.get_paginated_response(JobListSerializer(page, many=True).data)

    @extend_schema(request=JobWriteSerializer, responses={201: JobDetailSerializer})
    def post(self, request):
        serializer = JobWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        publish = data.pop("publish", False)
        company = company_of(request)
        job = lifecycle.create_job(company=company, user=request.user, data=data, publish=publish)
        return Response(job_response_data(company, job.pk), status=status.HTTP_201_CREATED)


class JobDetailView(GenericAPIView):
    serializer_class = JobWriteSerializer
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_permissions(self):
        method = self.request.method
        if method == "PATCH":
            return [CanEditJobs()]
        if method == "DELETE":
            return [CanManageJobs()]
        return [IsCompanyUser()]

    @extend_schema(responses={200: JobDetailSerializer})
    def get(self, request, job_id):
        return Response(JobDetailSerializer(get_job(company_of(request), job_id)).data)

    @extend_schema(request=JobWriteSerializer, responses={200: JobDetailSerializer})
    def patch(self, request, job_id):
        company = company_of(request)
        job = get_job(company, job_id)
        serializer = JobWriteSerializer(job, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        data.pop("publish", None)
        lifecycle.update_job(company=company, job_id=job_id, user=request.user, data=data)
        return Response(job_response_data(company, job_id))

    @extend_schema(responses={204: None})
    def delete(self, request, job_id):
        lifecycle.delete_job(company=company_of(request), job_id=job_id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class JobPublishView(GenericAPIView):
    permission_classes = [CanEditJobs]
    serializer_class = JobDetailSerializer

    @extend_schema(request=None, responses={200: JobDetailSerializer})
    def post(self, request, job_id):
        company = company_of(request)
        lifecycle.publish_job(company=company, job_id=job_id, user=request.user)
        return Response(job_response_data(company, job_id))


class JobCloseView(GenericAPIView):
    permission_classes = [CanEditJobs]
    serializer_class = JobDetailSerializer

    @extend_schema(request=None, responses={200: JobDetailSerializer})
    def post(self, request, job_id):
        company = company_of(request)
        lifecycle.close_job(company=company, job_id=job_id, user=request.user)
        return Response(job_response_data(company, job_id))


class JobReopenView(GenericAPIView):
    permission_classes = [CanManageJobs]
    serializer_class = ReopenSerializer

    @extend_schema(request=ReopenSerializer, responses={200: JobDetailSerializer})
    def post(self, request, job_id):
        serializer = ReopenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        company = company_of(request)
        lifecycle.reopen_job(
            company=company, job_id=job_id, user=request.user, deadline=serializer.validated_data["deadline"]
        )
        return Response(job_response_data(company, job_id))


class JobDuplicateView(GenericAPIView):
    permission_classes = [CanEditJobs]
    serializer_class = JobDetailSerializer

    @extend_schema(request=None, responses={201: JobDetailSerializer})
    def post(self, request, job_id):
        company = company_of(request)
        copy = lifecycle.duplicate_job(company=company, job_id=job_id, user=request.user)
        return Response(job_response_data(company, copy.pk), status=status.HTTP_201_CREATED)


class JobFormPreviewView(GenericAPIView):
    permission_classes = [IsCompanyUser]
    serializer_class = FormSchemaSerializer

    @extend_schema(responses={200: FormSchemaSerializer})
    def get(self, request, job_id):
        job = get_job(company_of(request), job_id)
        return Response(form.build_form_schema(job, request.build_absolute_uri))


class JobDepartmentsView(GenericAPIView):
    permission_classes = [IsCompanyUser]
    pagination_class = None
    filter_backends = []
    serializer_class = None

    @extend_schema(
        description="The departments the company's jobs use, once each (case-insensitive), sorted A-Z. For filters and suggestions.",
        responses={200: {"type": "array", "items": {"type": "string"}}},
    )
    def get(self, request):
        return Response(departments_of(company_of(request)))

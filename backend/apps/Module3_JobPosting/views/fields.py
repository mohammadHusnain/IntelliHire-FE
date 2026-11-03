from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response

from apps.common.permissions import IsCompanyUser

from ..permissions import CanEditJobs
from ..serializers.fields import ApplicationFieldSerializer, ApplicationFieldWriteSerializer, ReorderSerializer
from ..services import fields as services
from ..services.queries import get_job
from .common import company_of


class FieldListCreateView(GenericAPIView):
    serializer_class = ApplicationFieldWriteSerializer
    pagination_class = None
    filter_backends = []

    def get_permissions(self):
        return [IsCompanyUser() if self.request.method == "GET" else CanEditJobs()]

    @extend_schema(responses={200: ApplicationFieldSerializer(many=True)})
    def get(self, request, job_id):
        job = get_job(company_of(request), job_id)
        return Response(ApplicationFieldSerializer(job.custom_fields.all(), many=True).data)

    @extend_schema(request=ApplicationFieldWriteSerializer, responses={201: ApplicationFieldSerializer})
    def post(self, request, job_id):
        serializer = ApplicationFieldWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        field = services.add_field(
            company=company_of(request), job_id=job_id, user=request.user, data=dict(serializer.validated_data)
        )
        return Response(ApplicationFieldSerializer(field).data, status=status.HTTP_201_CREATED)


class FieldDetailView(GenericAPIView):
    permission_classes = [CanEditJobs]
    serializer_class = ApplicationFieldWriteSerializer
    http_method_names = ["patch", "delete", "options"]

    @extend_schema(request=ApplicationFieldWriteSerializer, responses={200: ApplicationFieldSerializer})
    def patch(self, request, job_id, field_id):
        company = company_of(request)
        current = services.get_field(company, job_id, field_id)
        serializer = ApplicationFieldWriteSerializer(current, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        field = services.update_field(
            company=company, job_id=job_id, field_id=field_id, user=request.user, data=dict(serializer.validated_data)
        )
        return Response(ApplicationFieldSerializer(field).data)

    @extend_schema(responses={204: None})
    def delete(self, request, job_id, field_id):
        services.delete_field(company=company_of(request), job_id=job_id, field_id=field_id, user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class FieldReorderView(GenericAPIView):
    permission_classes = [CanEditJobs]
    serializer_class = ReorderSerializer
    filter_backends = []

    @extend_schema(
        request=ReorderSerializer,
        description="Send `{\"field_ids\": [...]}` (a bare JSON list is accepted too) with every field ID of the job in the new order.",
        responses={200: ApplicationFieldSerializer(many=True)},
    )
    def post(self, request, job_id):
        data = {"field_ids": request.data} if isinstance(request.data, list) else request.data
        serializer = ReorderSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        ordered = services.reorder_fields(
            company=company_of(request),
            job_id=job_id,
            user=request.user,
            field_ids=serializer.validated_data["field_ids"],
        )
        return Response(ApplicationFieldSerializer(ordered, many=True).data)

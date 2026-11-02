from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.generics import GenericAPIView, ListAPIView, RetrieveAPIView
from rest_framework.response import Response

from apps.common.permissions import IsPlatformAdmin

from ..models import Company
from ..serializers.review import (
    CompanyListQuerySerializer,
    CompanyReviewDetailSerializer,
    CompanyReviewListSerializer,
    ReasonSerializer,
)
from ..services import review as services


class CompanyReviewListView(ListAPIView):
    permission_classes = [IsPlatformAdmin]
    serializer_class = CompanyReviewListSerializer
    filter_backends = []

    @extend_schema(
        parameters=[
            OpenApiParameter("status", enum=[*Company.Status.values, "all"], required=False, description="Default: pending."),
            OpenApiParameter("search", str, required=False, description="Company name or official email."),
        ]
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        query = CompanyListQuerySerializer(data=self.request.query_params)
        query.is_valid(raise_exception=True)
        return services.companies_for_review(**query.validated_data)


class CompanyReviewDetailView(RetrieveAPIView):
    permission_classes = [IsPlatformAdmin]
    serializer_class = CompanyReviewDetailSerializer
    queryset = Company.objects.select_related("created_by", "reviewed_by")
    lookup_field = "pk"
    lookup_url_kwarg = "company_id"


class _CompanyDecisionView(GenericAPIView):
    permission_classes = [IsPlatformAdmin]
    serializer_class = CompanyReviewDetailSerializer

    def respond(self, company):
        company = Company.objects.select_related("created_by", "reviewed_by").get(pk=company.pk)
        return Response(CompanyReviewDetailSerializer(company).data)


class CompanyApproveView(_CompanyDecisionView):
    @extend_schema(request=None, responses={200: CompanyReviewDetailSerializer})
    def post(self, request, company_id):
        return self.respond(services.approve_company(company_id=company_id, reviewer=request.user))


class CompanyReactivateView(_CompanyDecisionView):
    @extend_schema(request=None, responses={200: CompanyReviewDetailSerializer})
    def post(self, request, company_id):
        return self.respond(services.reactivate_company(company_id=company_id))


class _ReasonedDecisionView(_CompanyDecisionView):
    @extend_schema(request=ReasonSerializer, responses={200: CompanyReviewDetailSerializer})
    def post(self, request, company_id):
        serializer = ReasonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return self.respond(self.decide(request, company_id, serializer.validated_data["reason"]))


class CompanyRejectView(_ReasonedDecisionView):
    def decide(self, request, company_id, reason):
        return services.reject_company(company_id=company_id, reviewer=request.user, reason=reason)


class CompanySuspendView(_ReasonedDecisionView):
    def decide(self, request, company_id, reason):
        return services.suspend_company(company_id=company_id, reason=reason)

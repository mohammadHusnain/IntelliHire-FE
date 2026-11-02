from drf_spectacular.utils import extend_schema
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response

from apps.common.permissions import IsCompanyUser

from ..serializers.dashboard import DashboardSerializer
from ..services.dashboard import build_dashboard


class DashboardView(GenericAPIView):
    permission_classes = [IsCompanyUser]
    serializer_class = DashboardSerializer

    @extend_schema(responses={200: DashboardSerializer})
    def get(self, request):
        company = request.user.company_membership.company
        logo = request.build_absolute_uri(company.logo.url) if company.logo else None
        return Response(build_dashboard(company, logo))

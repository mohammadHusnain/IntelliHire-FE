from rest_framework.generics import RetrieveUpdateAPIView

from apps.common.permissions import IsCompanyAdmin, IsCompanyUser

from ..serializers.profile import CompanyProfileSerializer
from ..services import profile as services


class CompanyProfileView(RetrieveUpdateAPIView):
    """Any company member can read the profile; only the company admin can edit it."""

    serializer_class = CompanyProfileSerializer
    http_method_names = ["get", "patch", "head", "options"]

    def get_permissions(self):
        return [IsCompanyAdmin() if self.request.method == "PATCH" else IsCompanyUser()]

    def get_object(self):
        return self.request.user.company_membership.company

    def perform_update(self, serializer):
        serializer.instance = services.update_company_profile(serializer.instance, serializer.validated_data)

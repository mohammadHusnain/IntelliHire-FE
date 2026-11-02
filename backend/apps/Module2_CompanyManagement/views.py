from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.response import Response

from apps.Module1_Authentication.serializers import RegistrationResponseSerializer
from apps.Module1_Authentication.views import PublicAPIView, sensitive

from . import services
from .serializers import CompanyRegistrationSerializer


@sensitive
class CompanyRegisterView(PublicAPIView):
    serializer_class = CompanyRegistrationSerializer
    throttle_scope = "register"

    @extend_schema(responses={201: RegistrationResponseSerializer})
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user = services.register_company_admin(
            company_name=data["company_name"],
            industry=data["industry"],
            official_email=data["official_email"],
            admin_full_name=data["admin_full_name"],
            admin_phone=data["admin_phone"],
            password=data["password"],
        )
        return Response({"email": user.email, "status": user.status}, status=status.HTTP_201_CREATED)

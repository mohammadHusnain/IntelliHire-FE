from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.response import Response

from apps.Module1_Authentication.views import PublicAPIView, sensitive

from ..serializers.invitations import (
    InvitationAcceptResponseSerializer,
    InvitationAcceptSerializer,
    InvitationDetailsSerializer,
)
from ..services import invitations as services


class InvitationDetailsView(PublicAPIView):
    serializer_class = InvitationDetailsSerializer
    throttle_classes = []

    @extend_schema(responses={200: InvitationDetailsSerializer})
    def get(self, request, token):
        invitation = services.invitation_for_token(token)
        logo = invitation.company.logo
        return Response(
            {
                "company": {
                    "name": invitation.company.name,
                    "logo": request.build_absolute_uri(logo.url) if logo else None,
                },
                "role": invitation.role,
                "email": invitation.email,
                "full_name": invitation.full_name,
            }
        )


@sensitive
class InvitationAcceptView(PublicAPIView):
    serializer_class = InvitationAcceptSerializer
    throttle_scope = "register"

    @extend_schema(responses={201: InvitationAcceptResponseSerializer})
    def post(self, request, token):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = services.accept_invitation(
            raw_token=token,
            full_name=serializer.validated_data["full_name"],
            password=serializer.validated_data["password"],
        )
        return Response({"email": user.email, "status": user.status}, status=status.HTTP_201_CREATED)

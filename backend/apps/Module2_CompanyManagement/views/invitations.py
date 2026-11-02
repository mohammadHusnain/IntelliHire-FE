from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response

from apps.common.permissions import IsCompanyAdmin

from ..models import InvitationStatus
from ..serializers.invitations import InvitationCreateSerializer, InvitationSerializer
from ..services import invitations as services


class InvitationListCreateView(GenericAPIView):
    permission_classes = [IsCompanyAdmin]
    serializer_class = InvitationCreateSerializer
    filter_backends = []
    pagination_class = None

    @extend_schema(
        parameters=[OpenApiParameter("status", enum=InvitationStatus.values, required=False)],
        responses={200: InvitationSerializer(many=True)},
    )
    def get(self, request):
        wanted = request.query_params.get("status")
        company = request.user.company_membership.company
        queryset = services.invitations_of(company, wanted if wanted in InvitationStatus.values else None)
        return Response(InvitationSerializer(queryset, many=True).data)

    @extend_schema(request=InvitationCreateSerializer, responses={201: InvitationSerializer})
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invitation = services.create_invitation(
            company=request.user.company_membership.company, inviter=request.user, **serializer.validated_data
        )
        return Response(InvitationSerializer(invitation).data, status=status.HTTP_201_CREATED)


class _InvitationActionView(GenericAPIView):
    permission_classes = [IsCompanyAdmin]
    serializer_class = InvitationSerializer
    service = None

    def _run(self, request, invitation_id):
        invitation = type(self).service(
            company=request.user.company_membership.company, invitation_id=invitation_id
        )
        return Response(InvitationSerializer(invitation).data)


class InvitationResendView(_InvitationActionView):
    service = staticmethod(services.resend_invitation)

    @extend_schema(request=None, responses={200: InvitationSerializer})
    def post(self, request, invitation_id):
        return self._run(request, invitation_id)


class InvitationRevokeView(_InvitationActionView):
    service = staticmethod(services.revoke_invitation)

    @extend_schema(request=None, responses={200: InvitationSerializer})
    def post(self, request, invitation_id):
        return self._run(request, invitation_id)

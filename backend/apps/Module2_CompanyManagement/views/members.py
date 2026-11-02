from drf_spectacular.utils import extend_schema
from rest_framework.generics import GenericAPIView, ListAPIView
from rest_framework.response import Response

from apps.common.permissions import IsCompanyAdmin, IsCompanyUser

from ..serializers.members import MemberSerializer, MemberUpdateSerializer
from ..services import members as services


class MemberListView(ListAPIView):
    permission_classes = [IsCompanyUser]
    serializer_class = MemberSerializer
    pagination_class = None
    filter_backends = []

    def get_queryset(self):
        return services.members_of(self.request.user.company_membership.company)


class MemberDetailView(GenericAPIView):
    permission_classes = [IsCompanyAdmin]
    serializer_class = MemberUpdateSerializer
    http_method_names = ["patch", "options"]

    @extend_schema(request=MemberUpdateSerializer, responses={200: MemberSerializer})
    def patch(self, request, member_id):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        member = services.update_member(
            actor_membership=request.user.company_membership, member_id=member_id, **serializer.validated_data
        )
        return Response(MemberSerializer(member).data)

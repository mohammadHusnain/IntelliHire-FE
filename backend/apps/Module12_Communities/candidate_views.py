"""Candidate endpoints (JWT). Another candidate's membership, an invite-only community you were not invited to and a post you cannot see are all 404."""
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response

from apps.common.pagination import StandardPagination
from apps.common.permissions import IsCandidate
from apps.Module1_Authentication.models import User

from .models import Community, CommunityInvitation, CommunityMembership, CommunityPost, InvitationStatus, MembershipStatus, PostStatus
from .serializers import CommunityMessageSerializer, community_row, post_row
from .services import core, discovery, posts
from .services.eligibility import check_eligibility

OBJECT = OpenApiTypes.OBJECT


class _View(GenericAPIView):
    permission_classes = [IsCandidate]
    filter_backends = []
    pagination_class = StandardPagination
    queryset = Community.objects.none()
    serializer_class = CommunityMessageSerializer

    @property
    def me(self):
        if not hasattr(self, "_me"):
            self._me = User.objects.prefetch_related("candidate_profile__education").get(pk=self.request.user.pk)
        return self._me

    def row(self, community, state):
        verdict = check_eligibility(self.me, community)
        return community_row(community, company={"id": community.company_id, "name": community.company.name}, eligibility=verdict, state=state)


class CommunitiesView(_View):
    @extend_schema(
        operation_id="candidate_communities_list", summary="Communities I can discover", description="Active communities of approved companies that accept requests, plus any I am invited to, each with whether I am eligible (and why not) and my state: none, pending_request, invited or member.",
        parameters=[OpenApiParameter("q", str, required=False), OpenApiParameter("company", str, required=False)], responses={200: OBJECT},
    )  # fmt: skip
    def get(self, request):
        queryset = discovery.discoverable(self.me, request.query_params.get("q", ""), request.query_params.get("company") or None)
        page = self.paginate_queryset(queryset)
        states = discovery.states_for(self.me, [c.pk for c in page])
        return self.get_paginated_response([self.row(c, states[c.pk]) for c in page])


class MineView(_View):
    @extend_schema(summary="My communities", responses={200: OBJECT})
    def get(self, request):
        memberships = CommunityMembership.objects.filter(user=self.me, status=MembershipStatus.ACTIVE).exclude(community__status="removed").filter(community__company__status="approved").select_related("community__company").order_by("-joined_at")
        page = self.paginate_queryset(memberships)
        return self.get_paginated_response([{**self.row(m.community, "member"), "joined_at": m.joined_at} for m in page])


class _One(_View):
    pagination_class = None

    def community(self, community_id):
        found = discovery.reachable(self.me, community_id)
        if found is None:
            raise NotFound("Community not found.")
        return found

    def member_community(self, community_id):
        community = Community.objects.select_related("company").filter(pk=community_id).first()
        if community is None or not core.is_visible(community) or not CommunityMembership.objects.filter(community=community, user=self.me, status=MembershipStatus.ACTIVE).exists():
            raise NotFound("Community not found.")
        return community


class CommunityView(_One):
    @extend_schema(summary="One community (the member list is never shown)", responses={200: OBJECT})
    def get(self, request, community_id):
        community = self.community(community_id)
        return Response(self.row(community, discovery.states_for(self.me, [community.pk])[community.pk]))


class JoinView(_One):
    @extend_schema(
        summary="Ask to join",
        description="Not eligible: 201 would be misleading, so the stored request comes back as 200 with `status: auto_rejected` and the reasons. Eligible: 201 pending, staff are notified. Already a member or waiting: 409. Invite-only without an invitation: 404.",
        request=CommunityMessageSerializer, responses={200: OBJECT, 201: OBJECT},
    )  # fmt: skip
    def post(self, request, community_id):
        community = self.community(community_id)
        data = CommunityMessageSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        join_request, pending = core.join(community, self.me, data.validated_data.get("message", ""))
        body = {"id": join_request.pk, "status": join_request.status, "eligibility": join_request.eligibility, "community_id": community.pk}
        return Response(body, status=status.HTTP_201_CREATED if pending else status.HTTP_200_OK)


class LeaveView(_One):
    @extend_schema(summary="Leave a community", request=None, responses={204: None})
    def post(self, request, community_id):
        community = Community.objects.filter(pk=community_id).first()
        if community is None:
            raise NotFound("Community not found.")
        core.leave(community, self.me)
        return Response(status=status.HTTP_204_NO_CONTENT)


class FeedView(_One):
    pagination_class = StandardPagination

    @extend_schema(summary="Posts of a community I belong to (404 for anyone else)", responses={200: OBJECT})
    def get(self, request, community_id):
        community = self.member_community(community_id)
        queryset = CommunityPost.objects.filter(community=community, status=PostStatus.PUBLISHED)
        page = self.paginate_queryset(queryset)
        return self.get_paginated_response([post_row(p, posts.is_closed(p)) for p in page])


class RespondView(_One):
    @extend_schema(summary="Show interest in a post", request=CommunityMessageSerializer, responses={201: OBJECT})
    def post(self, request, post_id):
        post = CommunityPost.objects.select_related("community__company").filter(pk=post_id, status=PostStatus.PUBLISHED).first()
        if post is None:
            raise NotFound("Post not found.")
        self.member_community(post.community_id)
        data = CommunityMessageSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        response = posts.respond(post, self.me, data.validated_data.get("message", ""))
        return Response({"id": response.pk, "post_id": post.pk, "created_at": response.created_at}, status=status.HTTP_201_CREATED)


def invitation_body(view, invitation):
    community = invitation.community
    return {
        "id": invitation.pk, "message": invitation.message, "created_at": invitation.created_at, "expires_at": invitation.expires_at,
        "community": community_row(community, company={"id": community.company_id, "name": community.company.name}, eligibility=check_eligibility(view.me, community)),
    }  # fmt: skip


class InvitationsView(_View):
    @extend_schema(summary="Pending invitations", responses={200: OBJECT})
    def get(self, request):
        queryset = CommunityInvitation.objects.filter(
            user=self.me, status=InvitationStatus.PENDING, expires_at__gt=timezone.now(), community__status="active", community__company__status="approved"
        ).select_related("community__company").order_by("-created_at")
        page = self.paginate_queryset(queryset)
        return self.get_paginated_response([invitation_body(self, i) for i in page])


class _InvitationAction(_One):
    def invitation(self, invitation_id):
        found = CommunityInvitation.objects.select_related("community__company", "user").filter(pk=invitation_id, user=self.me).first()
        if found is None:
            raise NotFound("Invitation not found.")
        return found


class AcceptView(_InvitationAction):
    @extend_schema(summary="Accept an invitation (410 once it expired)", request=None, responses={200: OBJECT})
    def post(self, request, invitation_id):
        membership = core.accept(self.invitation(invitation_id))
        return Response({"community_id": membership.community_id, "status": membership.status, "source": membership.source, "joined_at": membership.joined_at})


class DeclineView(_InvitationAction):
    @extend_schema(summary="Decline an invitation", request=None, responses={200: OBJECT})
    def post(self, request, invitation_id):
        core.decline(self.invitation(invitation_id))
        return Response({"status": InvitationStatus.DECLINED})

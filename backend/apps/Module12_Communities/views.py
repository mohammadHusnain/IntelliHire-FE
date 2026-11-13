"""Staff endpoints (the owning company only; anyone else's community is 404). Thin: find the object, call a service."""
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response

from apps.common.choices import MemberRole
from apps.common.errors import ApiError
from apps.common.pagination import StandardPagination
from apps.common.permissions import CompanyRole, IsCompanyUser
from apps.Module1_Authentication.models import User

from .models import Community, CommunityInvitation, CommunityJoinRequest, CommunityMembership, CommunityPost, InvitationStatus, MembershipStatus, PostResponse, PostStatus, RequestStatus
from .serializers import CommunityInputSerializer, CommunityInviteSerializer, PostInputSerializer, CommunityReasonSerializer, community_row, post_row
from .services import core, discovery, posts

CanManage = CompanyRole(MemberRole.ADMIN, MemberRole.HR_MANAGER)
OBJECT = OpenApiTypes.OBJECT


def company_of(request):
    return request.user.company_membership.company


def community_of(request, community_id):
    found = Community.objects.select_related("company").filter(pk=community_id, company=company_of(request)).first()
    if found is None:
        raise NotFound("Community not found.")
    return found


def page_of(view, queryset, build):
    page = view.paginate_queryset(queryset)
    return view.get_paginated_response([build(item) for item in page])


class _View(GenericAPIView):
    permission_classes = [IsCompanyUser]
    filter_backends = []
    pagination_class = StandardPagination
    queryset = Community.objects.none()
    serializer_class = CommunityInputSerializer

    def get_permissions(self):
        return [IsCompanyUser() if self.request.method == "GET" else CanManage()]


class CommunityListView(_View):
    @extend_schema(summary="My company's communities", operation_id="company_communities_list", responses={200: OBJECT})
    def get(self, request):
        queryset = Community.objects.filter(company=company_of(request)).exclude(status="removed").order_by("name", "id")
        return page_of(self, queryset, community_row)

    @extend_schema(
        summary="Create a community (admin, HR manager)",
        description="Name unique within the company (case-insensitive), description and mission required. An empty filter means no restriction. The company must be approved.",
        request=CommunityInputSerializer, responses={201: OBJECT},
    )  # fmt: skip
    def post(self, request):
        data = CommunityInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        return Response(community_row(core.create(company_of(request), request.user, data.validated_data)), status=status.HTTP_201_CREATED)


class CommunityDetailView(_View):
    pagination_class = None

    @extend_schema(summary="One community", responses={200: OBJECT})
    def get(self, request, community_id):
        return Response(community_row(community_of(request, community_id)))

    @extend_schema(summary="Edit a community. Existing members stay whatever the new filters say.", request=CommunityInputSerializer, responses={200: OBJECT})
    def patch(self, request, community_id):
        community = community_of(request, community_id)
        data = CommunityInputSerializer(community, data=request.data, partial=True)
        data.is_valid(raise_exception=True)
        return Response(community_row(core.update(community, request.user, data.validated_data)))

    @extend_schema(summary="Remove a community (marked removed, nothing deleted; members are emailed once)", request=CommunityReasonSerializer, responses={204: None})
    def delete(self, request, community_id):
        community = community_of(request, community_id)  # another company's community is 404 before anything is validated
        data = CommunityReasonSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        core.remove(community, request.user, data.validated_data["reason"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class CommunityArchiveView(_View):
    pagination_class = None

    @extend_schema(summary="Archive: hide from discovery and stop new joins; members and posts stay readable", request=None, responses={200: OBJECT})
    def post(self, request, community_id):
        return Response(community_row(core.archive(community_of(request, community_id), request.user)))


class MemberListView(_View):
    @extend_schema(
        summary="Active members", parameters=[OpenApiParameter("q", str, required=False), OpenApiParameter("ordering", str, enum=["joined_at", "-joined_at", "institution", "skill_match"], required=False)],
        responses={200: OBJECT},
    )  # fmt: skip
    def get(self, request, community_id):
        community = community_of(request, community_id)
        queryset = CommunityMembership.objects.filter(community=community, status=MembershipStatus.ACTIVE).select_related("user__candidate_profile").prefetch_related("user__candidate_profile__education")
        q = request.query_params.get("q")
        if q:
            queryset = queryset.filter(user__full_name__icontains=q)
        ordering = request.query_params.get("ordering", "-joined_at")
        wanted = {s.lower() for s in community.filter_skills}

        def build(m):
            summary = discovery.profile_summary(m.user)
            return {**summary, "joined_at": m.joined_at, "source": m.source, "skill_match": len(wanted & {s.lower() for s in (m.user.candidate_profile.skills if hasattr(m.user, "candidate_profile") else [])})}

        if ordering == "skill_match":
            rows = sorted((build(m) for m in queryset[:2000]), key=lambda r: (-r["skill_match"], r["full_name"]))
            page = self.paginate_queryset(rows)
            return self.get_paginated_response(page)
        if ordering == "institution":
            queryset = queryset.order_by("user__candidate_profile__education__institution", "pk")
        else:
            queryset = queryset.order_by("joined_at" if ordering == "joined_at" else "-joined_at", "pk")
        return page_of(self, queryset.distinct(), build)


class MemberDetailView(_View):
    pagination_class = None

    @extend_schema(summary="Remove a member (reason required; they are notified)", request=CommunityReasonSerializer, responses={204: None})
    def delete(self, request, community_id, user_id):
        community = community_of(request, community_id)
        data = CommunityReasonSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        core.remove_member(community, user_id, request.user, data.validated_data["reason"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class CandidateSearchView(_View):
    permission_classes = [CanManage]

    def get_permissions(self):
        return [CanManage()]

    @extend_schema(
        summary="Find candidates to invite",
        description="Only candidates who opted in (discoverable) with a verified email. Name, headline, institution and skills: never email, phone or CV.",
        parameters=[OpenApiParameter(n, str, required=False) for n in ("q", "university", "skill", "grad_year", "eligible_only")], responses={200: OBJECT},
    )  # fmt: skip
    def get(self, request, community_id):
        community = community_of(request, community_id)
        p = request.query_params
        try:
            grad_year = int(p["grad_year"]) if p.get("grad_year") else None
        except ValueError:
            raise ApiError("grad_year must be a year.", "invalid_filter", 400) from None
        rows = discovery.search_candidates(community, p.get("q", ""), p.get("university", ""), p.get("skill", ""), grad_year, p.get("eligible_only", "").lower() == "true")
        page = self.paginate_queryset(rows)
        return self.get_paginated_response(page)


def invitation_row(i):
    return {"id": i.pk, "user_id": i.user_id, "full_name": i.user.full_name, "message": i.message, "status": i.status, "created_at": i.created_at, "expires_at": i.expires_at}


class InvitationListView(_View):
    @extend_schema(summary="Invitations of this community", parameters=[OpenApiParameter("status", str, enum=InvitationStatus.values, required=False)], responses={200: OBJECT})
    def get(self, request, community_id):
        queryset = CommunityInvitation.objects.filter(community=community_of(request, community_id)).select_related("user").order_by("-created_at")
        if request.query_params.get("status"):
            queryset = queryset.filter(status=request.query_params["status"])
        return page_of(self, queryset, invitation_row)

    @extend_schema(
        summary="Invite a candidate (admin, HR manager)",
        description="Allowed even if the candidate fails the filters; the response carries the eligibility preview (a warning). Valid 14 days.",
        request=CommunityInviteSerializer, responses={201: OBJECT},
    )  # fmt: skip
    def post(self, request, community_id):
        community = community_of(request, community_id)
        data = CommunityInviteSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        user = User.objects.select_related("candidate_profile").filter(pk=data.validated_data["user_id"]).first()
        if user is None:
            raise NotFound("Candidate not found.")
        invitation, preview = core.invite(community, request.user, user, data.validated_data.get("message", ""))
        return Response({**invitation_row(invitation), "eligibility": preview}, status=status.HTTP_201_CREATED)


class InvitationDetailView(_View):
    pagination_class = None

    @extend_schema(summary="Withdraw a pending invitation", responses={204: None})
    def delete(self, request, community_id, invitation_id):
        invitation = CommunityInvitation.objects.filter(pk=invitation_id, community=community_of(request, community_id)).first()
        if invitation is None:
            raise NotFound("Invitation not found.")
        core.revoke(invitation)
        return Response(status=status.HTTP_204_NO_CONTENT)


def request_row(r):
    summary = discovery.profile_summary(r.user)
    return {"id": r.pk, "candidate": summary, "message": r.message, "status": r.status, "eligibility": r.eligibility, "created_at": r.created_at, "reviewed_at": r.reviewed_at, "decision_reason": r.decision_reason}


class JoinRequestListView(_View):
    permission_classes = [CanManage]

    def get_permissions(self):
        return [CanManage()]

    @extend_schema(summary="Join requests (default: pending)", parameters=[OpenApiParameter("status", str, enum=RequestStatus.values, required=False)], responses={200: OBJECT})
    def get(self, request, community_id):
        community = community_of(request, community_id)
        queryset = CommunityJoinRequest.objects.filter(community=community, status=request.query_params.get("status", RequestStatus.PENDING)).select_related("user__candidate_profile").prefetch_related("user__candidate_profile__education").order_by("created_at")
        return page_of(self, queryset, request_row)


class _RequestAction(_View):
    pagination_class = None

    def find(self, request, community_id, request_id):
        found = CommunityJoinRequest.objects.select_related("community__company", "user").filter(pk=request_id, community=community_of(request, community_id)).first()
        if found is None:
            raise NotFound("Request not found.")
        return found


class JoinRequestApproveView(_RequestAction):
    @extend_schema(summary="Approve a request: the candidate becomes a member and is told", request=None, responses={200: OBJECT})
    def post(self, request, community_id, request_id):
        join_request = self.find(request, community_id, request_id)
        core.approve(join_request, request.user)
        join_request.refresh_from_db()
        return Response(request_row(join_request))


class JoinRequestRejectView(_RequestAction):
    @extend_schema(summary="Reject a request (a reason is required)", request=CommunityReasonSerializer, responses={200: OBJECT})
    def post(self, request, community_id, request_id):
        join_request = self.find(request, community_id, request_id)
        data = CommunityReasonSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        core.reject(join_request, request.user, data.validated_data["reason"])
        join_request.refresh_from_db()
        return Response(request_row(join_request))


class PostListView(_View):
    @extend_schema(summary="Posts of a community", responses={200: OBJECT})
    def get(self, request, community_id):
        queryset = CommunityPost.objects.filter(community=community_of(request, community_id))
        return page_of(self, queryset, lambda p: {**post_row(p, posts.is_closed(p)), "responses": p.responses.count()})

    @extend_schema(
        summary="Create a post (admin, HR manager)",
        description="Plain text. `notify_members` queues in-app notices and emails for every active member, in batches of 50.",
        request=PostInputSerializer, responses={201: OBJECT},
    )  # fmt: skip
    def post(self, request, community_id):
        community = community_of(request, community_id)
        data = PostInputSerializer(data=request.data, context={"company": company_of(request)})
        data.is_valid(raise_exception=True)
        values = dict(data.validated_data)
        notify = values.pop("notify_members", False)
        return Response(post_row(posts.create(community, request.user, values, notify)), status=status.HTTP_201_CREATED)


class PostDetailView(_View):
    pagination_class = None

    def post_of(self, request, community_id, post_id):
        found = CommunityPost.objects.filter(pk=post_id, community=community_of(request, community_id)).first()
        if found is None:
            raise NotFound("Post not found.")
        return found

    @extend_schema(summary="Edit a post", request=PostInputSerializer, responses={200: OBJECT})
    def patch(self, request, community_id, post_id):
        post = self.post_of(request, community_id, post_id)
        data = PostInputSerializer(post, data=request.data, partial=True, context={"company": company_of(request)})
        data.is_valid(raise_exception=True)
        for key, value in data.validated_data.items():
            if key != "notify_members":
                setattr(post, key, value)
        post.save()
        return Response(post_row(post, posts.is_closed(post)))

    @extend_schema(summary="Archive a post (members stop seeing it; responses are kept)", responses={204: None})
    def delete(self, request, community_id, post_id):
        post = self.post_of(request, community_id, post_id)
        CommunityPost.objects.filter(pk=post.pk).update(status=PostStatus.ARCHIVED)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PostResponsesView(_View):
    @extend_schema(summary="Who responded to a post", responses={200: OBJECT})
    def get(self, request, community_id, post_id):
        post = CommunityPost.objects.filter(pk=post_id, community=community_of(request, community_id)).first()
        if post is None:
            raise NotFound("Post not found.")
        queryset = PostResponse.objects.filter(post=post).select_related("user__candidate_profile").prefetch_related("user__candidate_profile__education").order_by("-created_at")
        return page_of(self, queryset, lambda r: {"candidate": discovery.profile_summary(r.user), "message": r.message, "created_at": r.created_at})


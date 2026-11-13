from django.urls import path

from . import views

# Mounted at /api/company/communities/
urlpatterns = [
    path("", views.CommunityListView.as_view(), name="company-communities"),
    path("<uuid:community_id>/", views.CommunityDetailView.as_view(), name="company-community"),
    path("<uuid:community_id>/archive/", views.CommunityArchiveView.as_view(), name="company-community-archive"),
    path("<uuid:community_id>/members/", views.MemberListView.as_view(), name="company-community-members"),
    path("<uuid:community_id>/members/<uuid:user_id>/", views.MemberDetailView.as_view(), name="company-community-member"),
    path("<uuid:community_id>/candidates/search/", views.CandidateSearchView.as_view(), name="company-community-search"),
    path("<uuid:community_id>/invitations/", views.InvitationListView.as_view(), name="company-community-invitations"),
    path("<uuid:community_id>/invitations/<uuid:invitation_id>/", views.InvitationDetailView.as_view(), name="company-community-invitation"),
    path("<uuid:community_id>/join-requests/", views.JoinRequestListView.as_view(), name="company-community-requests"),
    path("<uuid:community_id>/join-requests/<uuid:request_id>/approve/", views.JoinRequestApproveView.as_view(), name="company-community-approve"),
    path("<uuid:community_id>/join-requests/<uuid:request_id>/reject/", views.JoinRequestRejectView.as_view(), name="company-community-reject"),
    path("<uuid:community_id>/posts/", views.PostListView.as_view(), name="company-community-posts"),
    path("<uuid:community_id>/posts/<uuid:post_id>/", views.PostDetailView.as_view(), name="company-community-post"),
    path("<uuid:community_id>/posts/<uuid:post_id>/responses/", views.PostResponsesView.as_view(), name="company-community-post-responses"),
]

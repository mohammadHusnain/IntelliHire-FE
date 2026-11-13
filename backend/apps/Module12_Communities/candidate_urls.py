from django.urls import path

from . import candidate_views as views

# Mounted at /api/candidate/ (mine comes before the id so it is never read as one)
urlpatterns = [
    path("communities/", views.CommunitiesView.as_view(), name="candidate-communities"),
    path("communities/mine/", views.MineView.as_view(), name="candidate-communities-mine"),
    path("communities/<uuid:community_id>/", views.CommunityView.as_view(), name="candidate-community"),
    path("communities/<uuid:community_id>/join/", views.JoinView.as_view(), name="candidate-community-join"),
    path("communities/<uuid:community_id>/leave/", views.LeaveView.as_view(), name="candidate-community-leave"),
    path("communities/<uuid:community_id>/feed/", views.FeedView.as_view(), name="candidate-community-feed"),
    path("community-posts/<uuid:post_id>/respond/", views.RespondView.as_view(), name="candidate-community-respond"),
    path("community-invitations/", views.InvitationsView.as_view(), name="candidate-community-invitations"),
    path("community-invitations/<uuid:invitation_id>/accept/", views.AcceptView.as_view(), name="candidate-community-accept"),
    path("community-invitations/<uuid:invitation_id>/decline/", views.DeclineView.as_view(), name="candidate-community-decline"),
]

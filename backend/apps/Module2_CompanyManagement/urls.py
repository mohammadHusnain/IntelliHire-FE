from django.urls import path

from .views import dashboard, invitations, members, profile

urlpatterns = [
    path("profile/", profile.CompanyProfileView.as_view(), name="profile"),
    path("dashboard/", dashboard.DashboardView.as_view(), name="dashboard"),
    path("members/", members.MemberListView.as_view(), name="member-list"),
    path("members/<int:member_id>/", members.MemberDetailView.as_view(), name="member-detail"),
    path("invitations/", invitations.InvitationListCreateView.as_view(), name="invitation-list"),
    path("invitations/<uuid:invitation_id>/resend/", invitations.InvitationResendView.as_view(), name="invitation-resend"),
    path("invitations/<uuid:invitation_id>/revoke/", invitations.InvitationRevokeView.as_view(), name="invitation-revoke"),
]

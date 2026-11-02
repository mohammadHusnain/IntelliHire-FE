from django.urls import path

from .views import public_invitations

urlpatterns = [
    path("invitations/<str:token>/", public_invitations.InvitationDetailsView.as_view(), name="invitation-details"),
    path("invitations/<str:token>/accept/", public_invitations.InvitationAcceptView.as_view(), name="invitation-accept"),
]

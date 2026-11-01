from django.urls import path

from . import views

urlpatterns = [
    path("<uuid:user_id>/suspend/", views.SuspendUserView.as_view(), name="user-suspend"),
    path("<uuid:user_id>/reactivate/", views.ReactivateUserView.as_view(), name="user-reactivate"),
]

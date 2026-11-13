from django.urls import path

from . import views

urlpatterns = [
    path("", views.NotificationListView.as_view(), name="notification-list"),
    path("unread-count/", views.UnreadCountView.as_view(), name="notification-unread-count"),
    path("read-all/", views.MarkAllReadView.as_view(), name="notification-read-all"),
    path("preferences/", views.NotificationPreferencesView.as_view(), name="notification-preferences"),
    path("<uuid:notification_id>/read/", views.MarkReadView.as_view(), name="notification-read"),
]

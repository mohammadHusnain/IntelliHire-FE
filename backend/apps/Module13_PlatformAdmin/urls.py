from django.urls import path

from . import views

# Mounted at /api/platform-admin/
urlpatterns = [
    path("dashboard/", views.DashboardView.as_view(), name="admin-dashboard"),
    path("users/<uuid:user_id>/detail/", views.UserDetailView.as_view(), name="admin-user-detail"),
    path("companies/<uuid:company_id>/onboarding/", views.CompanyOnboardingView.as_view(), name="admin-company-onboarding"),
    path("jobs/", views.JobMonitorView.as_view(), name="admin-jobs"),
    path("jobs/<uuid:job_id>/", views.JobDetailView.as_view(), name="admin-job"),
    path("communities/", views.CommunityMonitorView.as_view(), name="admin-communities"),
    path("communities/<uuid:community_id>/", views.CommunityDetailView.as_view(), name="admin-community"),
    path("flags/", views.FlagCreateView.as_view(), name="admin-flags"),
    path("moderation/", views.ModerationQueueView.as_view(), name="admin-moderation"),
    path("moderation/<uuid:flag_id>/review/", views.FlagReviewView.as_view(), name="admin-moderation-review"),
    path("moderation/<uuid:flag_id>/resolve/", views.FlagResolveView.as_view(), name="admin-moderation-resolve"),
    path("activity/", views.ActivityView.as_view(), name="admin-activity"),
    path("activity/export/", views.ActivityExportView.as_view(), name="admin-activity-export"),
    path("activity/<uuid:event_id>/", views.ActivityDetailView.as_view(), name="admin-activity-detail"),
    path("activity/<uuid:event_id>/flag/", views.ActivityFlagView.as_view(), name="admin-activity-flag"),
    path("health/", views.HealthView.as_view(), name="admin-health"),
    path("alerts/", views.AlertListView.as_view(), name="admin-alerts"),
    path("alerts/<uuid:alert_id>/acknowledge/", views.AlertAcknowledgeView.as_view(), name="admin-alert-acknowledge"),
    path("ai-settings/", views.AISettingsView.as_view(), name="admin-ai-settings"),
    path("prompts/", views.PromptListView.as_view(), name="admin-prompts"),
    path("prompts/<str:key>/", views.PromptVersionsView.as_view(), name="admin-prompt"),
    path("prompts/<str:key>/rollback/", views.PromptRollbackView.as_view(), name="admin-prompt-rollback"),
    path("ai-usage/", views.AIUsageView.as_view(), name="admin-ai-usage"),
]

from django.contrib import admin

from .models import (
    ActivityEvent,
    AIRequestLog,
    AISettings,
    Notification,
    OutboundEmail,
    PromptTemplate,
    SystemAlert,
)


class ReadOnlyAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(ActivityEvent)
class ActivityEventAdmin(ReadOnlyAdmin):
    list_display = ("created_at", "event_type", "actor", "company", "summary")
    list_filter = ("event_type",)
    search_fields = ("summary",)


@admin.register(AIRequestLog)
class AIRequestLogAdmin(ReadOnlyAdmin):
    list_display = ("created_at", "feature", "provider", "model", "status", "attempts", "latency_ms")
    list_filter = ("status", "feature", "provider")


@admin.register(OutboundEmail)
class OutboundEmailAdmin(ReadOnlyAdmin):
    # Bodies are left out on purpose: they can hold verification and reset links.
    list_display = ("created_at", "kind", "to_email", "status", "attempts", "last_error")
    list_filter = ("status", "kind")
    exclude = ("body_text", "body_html")


@admin.register(Notification)
class NotificationAdmin(ReadOnlyAdmin):
    list_display = ("created_at", "user", "kind", "title", "read_at")
    list_filter = ("kind",)


@admin.register(SystemAlert)
class SystemAlertAdmin(ReadOnlyAdmin):
    list_display = ("created_at", "kind", "severity", "is_active", "resolved_at")
    list_filter = ("kind", "severity", "is_active")


@admin.register(PromptTemplate)
class PromptTemplateAdmin(ReadOnlyAdmin):
    list_display = ("key", "version", "is_active", "model_role", "created_at")
    list_filter = ("is_active", "key")


@admin.register(AISettings)
class AISettingsAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return not AISettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False

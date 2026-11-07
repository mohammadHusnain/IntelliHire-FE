from django.contrib import admin

from .models import Application, ApplicationFile, ApplicationStatusChange


class ApplicationFileInline(admin.TabularInline):
    model = ApplicationFile
    extra = 0
    readonly_fields = ("field_key", "file", "original_name", "size")
    can_delete = False


class StatusChangeInline(admin.TabularInline):
    model = ApplicationStatusChange
    extra = 0
    readonly_fields = ("from_status", "to_status", "changed_by", "note", "changed_at")
    can_delete = False


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ("reference", "full_name", "email", "job", "status", "submitted_at")
    list_filter = ("status", "education_level")
    search_fields = ("reference", "full_name", "email", "job__title")
    raw_id_fields = ("job", "candidate_user")
    readonly_fields = ("id", "reference", "resume", "ip_address", "user_agent", "submitted_at", "updated_at")
    inlines = [ApplicationFileInline, StatusChangeInline]

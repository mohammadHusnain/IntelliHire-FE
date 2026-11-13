from django.contrib import admin

from .models import BackupRecord, ModerationFlag


@admin.register(ModerationFlag)
class ModerationFlagAdmin(admin.ModelAdmin):
    list_display = ("target_type", "status", "source", "created_at", "resolved_at")
    list_filter = ("status", "source", "target_type")


@admin.register(BackupRecord)
class BackupRecordAdmin(admin.ModelAdmin):
    list_display = ("finished_at", "status", "size_bytes", "location")
    list_filter = ("status",)

from django.contrib import admin

from .models import ApplicationField, JobPosting


class ApplicationFieldInline(admin.TabularInline):
    model = ApplicationField
    extra = 0


@admin.register(JobPosting)
class JobPostingAdmin(admin.ModelAdmin):
    list_display = ("title", "company", "status", "deadline", "created_at")
    list_filter = ("status", "employment_type", "work_mode")
    search_fields = ("title", "company__name", "form_slug")
    raw_id_fields = ("company", "created_by", "updated_by")
    readonly_fields = ("id", "form_slug", "published_at", "closed_at", "created_at", "updated_at")
    inlines = [ApplicationFieldInline]

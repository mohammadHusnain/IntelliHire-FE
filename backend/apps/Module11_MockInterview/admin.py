from django.contrib import admin

from .models import InterviewRole, MockInterviewSession


@admin.register(InterviewRole)
class InterviewRoleAdmin(admin.ModelAdmin):
    list_display = ("title", "category", "is_active", "sort_order")
    list_filter = ("category", "is_active")
    search_fields = ("title", "description")
    prepopulated_fields = {"slug": ("title",)}


@admin.register(MockInterviewSession)
class MockInterviewSessionAdmin(admin.ModelAdmin):
    """Metadata only: the transcript and the CV excerpt live on the interview session and are never shown here."""

    list_display = ("session", "interview_type", "use_cv", "counts_toward_limit", "deleted_at")
    readonly_fields = ("session", "target_role")

from django.contrib import admin

from .models import InterviewQuestionBank, InterviewSession, InterviewTurn


class TurnInline(admin.TabularInline):
    model = InterviewTurn
    extra = 0
    can_delete = False
    fields = ("index", "question_text", "score", "answered_at")
    readonly_fields = fields


@admin.register(InterviewSession)
class InterviewSessionAdmin(admin.ModelAdmin):
    list_display = ("id", "kind", "status", "role_title", "overall_score", "recommendation", "invited_at", "expires_at")
    list_filter = ("kind", "status")
    # Never show the link hash, the transcript's owner contact details or the stored context here.
    exclude = ("token_hash", "context")
    readonly_fields = ("application", "candidate_user", "created_by", "report", "overall_score", "recommendation")
    inlines = [TurnInline]


@admin.register(InterviewQuestionBank)
class InterviewQuestionBankAdmin(admin.ModelAdmin):
    list_display = ("kind", "role_category", "competency", "difficulty", "is_active", "text")
    list_filter = ("kind", "role_category", "competency", "is_active")
    search_fields = ("text",)

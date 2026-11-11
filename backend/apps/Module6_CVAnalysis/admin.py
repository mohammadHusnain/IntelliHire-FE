from django.contrib import admin

from .models import CVAnalysis, CVMatch, JobScreeningConfig


class _ReadOnly(admin.ModelAdmin):
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(CVAnalysis)
class CVAnalysisAdmin(_ReadOnly):
    list_display = ("application", "status", "attempts", "analysed_at", "failure_reason")
    list_filter = ("status",)
    exclude = ("embedding",)


@admin.register(CVMatch)
class CVMatchAdmin(_ReadOnly):
    list_display = ("application", "score", "skills_score", "experience_score", "education_score", "semantic_score", "computed_at")


@admin.register(JobScreeningConfig)
class JobScreeningConfigAdmin(_ReadOnly):
    list_display = ("job", "auto_analyse", "shortlist_threshold", "auto_shortlist", "updated_at")
    exclude = ("job_embedding",)

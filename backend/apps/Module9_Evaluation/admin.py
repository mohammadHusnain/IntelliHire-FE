from django.contrib import admin

from .models import CandidateEvaluation, EvaluationWeights, HRDecision


@admin.register(EvaluationWeights)
class EvaluationWeightsAdmin(admin.ModelAdmin):
    list_display = ("job", "weight_cv", "weight_screening", "weight_technical", "missing_stage_policy", "updated_at")


@admin.register(CandidateEvaluation)
class CandidateEvaluationAdmin(admin.ModelAdmin):
    list_display = ("application", "composite_score", "is_partial", "report_status", "updated_at")
    list_filter = ("is_partial", "report_status")
    readonly_fields = ("application", "job", "weights_used", "report")


@admin.register(HRDecision)
class HRDecisionAdmin(admin.ModelAdmin):
    """Read-only: a recorded decision is permanent (FR-58)."""

    list_display = ("application", "decision", "decided_by", "decided_at", "overrode_ai")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

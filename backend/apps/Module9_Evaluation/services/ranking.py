"""Ranking and comparing evaluated candidates of one job (FR-55, FR-56)."""
from django.db.models import F, OuterRef, Subquery, Window
from django.db.models.functions import RowNumber
from rest_framework.exceptions import NotFound

from apps.common.errors import ApiError

from ..models import CandidateEvaluation, HRDecision

STAGES = ("cv", "screening", "technical", "complete")


def ranked(job, *, min_score=None, max_score=None, status=None, stage=None, partial=None):
    """Evaluated candidates, best first (ties to the earlier submission), with their rank in the filtered set."""
    latest = HRDecision.objects.filter(application=OuterRef("application")).order_by("-decided_at", "-id")
    qs = CandidateEvaluation.objects.filter(job=job)
    if min_score is not None:
        qs = qs.filter(composite_score__gte=min_score)
    if max_score is not None:
        qs = qs.filter(composite_score__lte=max_score)
    if status:
        qs = qs.filter(application__status=status)
    if partial is not None:
        qs = qs.filter(is_partial=partial)
    if stage == "cv":
        qs = qs.filter(technical_score__isnull=True, screening_score__isnull=True, cv_score__isnull=False)
    elif stage == "screening":
        qs = qs.filter(technical_score__isnull=True, screening_score__isnull=False)
    elif stage == "technical":
        qs = qs.filter(technical_score__isnull=False)
    elif stage == "complete":
        qs = qs.filter(cv_score__isnull=False, screening_score__isnull=False, technical_score__isnull=False)
    order = [F("composite_score").desc(), F("application__submitted_at").asc(), F("application_id").asc()]
    return (
        qs.select_related("application")
        .annotate(rank=Window(RowNumber(), order_by=order), current_decision=Subquery(latest.values("decision")[:1]))
        .order_by(*order)
    )


def compare(job, ids):
    """2 to 4 applications of this job, side by side. Anything outside the job (or company) is a 404."""
    unique = list(dict.fromkeys(ids))
    if not 2 <= len(unique) <= 4:
        raise ApiError("Choose between 2 and 4 candidates to compare.", "invalid_count", 400)
    from apps.Module4_ApplicationManagement.models import Application

    applications = {a.pk: a for a in Application.objects.filter(job=job, pk__in=unique).select_related("cv_match", "evaluation")}
    if len(applications) != len(unique):
        raise NotFound("Application not found.")
    return [applications[pk] for pk in unique]

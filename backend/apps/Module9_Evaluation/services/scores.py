"""Reading the three stage scores and keeping one CandidateEvaluation per application up to date (FR-52)."""
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.Module6_CVAnalysis.models import CVMatch
from apps.Module7_Interviews.models import InterviewSession, SessionStatus

from ..models import CandidateEvaluation
from . import composite as composite_rules
from .weights import weights_for


def cv_match_of(application):
    """Read fresh: a cached `application.cv_match` can be older than the score that just changed."""
    return CVMatch.objects.filter(application=application).first()


def latest_evaluated(application, kind):
    """The newest interview of this kind that was evaluated and has a score, or None."""
    return (
        InterviewSession.objects.filter(application=application, kind=kind, status=SessionStatus.EVALUATED, overall_score__isnull=False)
        .order_by("-invited_at", "-id")
        .first()
    )


def stage_scores(application):
    """cv, screening and technical scores (0 to 100) or None for a stage that did not happen."""
    match = cv_match_of(application)
    screening, technical = latest_evaluated(application, "screening"), latest_evaluated(application, "technical")
    return {
        "cv": match.score if match else None,
        "screening": screening.overall_score if screening else None,
        "technical": technical.overall_score if technical else None,
    }


def refresh(application, *, weights=None):
    """Recompute the scores and the composite and save them. Returns (evaluation, changed); (None, False) with no score yet.

    Cheap and synchronous: no model is called here. `changed` is true when a score, the composite or the weights moved,
    which is when a report is worth refreshing.
    """
    weights = weights or weights_for(application.job)
    scores = stage_scores(application)
    composite, partial, missing, used = composite_rules.compute(scores, weights.weights, weights.missing_stage_policy)
    if composite is None:
        return None, False
    values = {
        "cv_score": scores["cv"], "screening_score": scores["screening"], "technical_score": scores["technical"],
        "composite_score": composite, "is_partial": partial, "missing_stages": missing, "weights_used": used, "job": application.job,
    }  # fmt: skip
    with transaction.atomic():
        evaluation, created = CandidateEvaluation.objects.select_for_update().get_or_create(application=application, defaults=values)
        if created:
            return evaluation, True
        changed = any(
            _differs(getattr(evaluation, field), value)
            for field, value in values.items()
            if field not in ("weights_used", "job")
        ) or evaluation.weights_used != used
        if changed:
            for field, value in values.items():
                setattr(evaluation, field, value)
            evaluation.save()
    return evaluation, changed


def _differs(old, new):
    if old is None or new is None:
        return old is not new
    if isinstance(old, Decimal) or isinstance(new, Decimal):
        return Decimal(str(old)) != Decimal(str(new))
    return old != new


def now():
    return timezone.now()

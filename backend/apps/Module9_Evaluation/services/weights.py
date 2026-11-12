"""Per-job evaluation weights: created with defaults on first access; changing them recomputes the job in the background."""
from django.db import transaction

from apps.Module5_Foundation.events import log_event

from ..models import DEFAULT_WEIGHTS, EvaluationWeights


def weights_for(job):
    return EvaluationWeights.objects.get_or_create(job=job, defaults={f"weight_{k}": v for k, v in DEFAULT_WEIGHTS.items()})[0]


def set_weights(job, user, values):
    """Save new weights and/or policy. Returns (weights, changed). A real change queues a recompute of every evaluation."""
    with transaction.atomic():
        current = weights_for(job)
        before = (current.weights, current.missing_stage_policy)
        for key in ("weight_cv", "weight_screening", "weight_technical", "missing_stage_policy"):
            if key in values:
                setattr(current, key, values[key])
        current.updated_by = user
        current.save()
        changed = before != (current.weights, current.missing_stage_policy)
        if changed:
            from .recompute import queue_recompute

            queue_recompute(job.pk)
            log_event(
                "evaluation.weights_changed", actor=user, company=job.company_id, target=job,
                summary="Evaluation weights changed; every candidate is being recomputed",
                metadata={"weights": current.weights, "policy": current.missing_stage_policy},
            )  # fmt: skip
    return current, changed

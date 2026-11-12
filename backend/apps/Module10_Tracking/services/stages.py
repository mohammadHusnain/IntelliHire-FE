"""The four-stage tracker (FR-61), computed in code from what happened. Pure functions over plain values."""
from apps.Module7_Interviews.models import FINISHED_STATUSES, OPEN_STATUSES

from ..labels import DECISION_STATUSES, STAGE_LABELS, STAGES

CV_PENDING_STATUSES = ("submitted", "under_review")
PENDING_INVITE_STATUSES = ("invited", "interrupted")


def compute(status, cv_status, sessions, has_decision):
    """Returns (stages, current): a list of {key, label, state} and the key of the current stage (None once decided).

    A stage is `done` when it happened, `skipped` when it never did but a later one did (HR moved the candidate past it),
    `current` when it is the next one to happen, and `waiting` after that. The candidate's part of an interview is done
    once they have finished it, whether or not it has been scored yet.
    """
    kinds_done = {s.kind for s in sessions if s.status in FINISHED_STATUSES}
    done = {
        "cv": cv_status in ("completed", "manual_review") or status not in CV_PENDING_STATUSES,
        "screening": "screening" in kinds_done,
        "technical": "technical" in kinds_done,
        "decision": bool(has_decision) or status in DECISION_STATUSES,
    }
    states = {}
    for index, key in enumerate(STAGES):
        if done[key]:
            states[key] = "done"
        elif any(done[later] for later in STAGES[index + 1:]):
            states[key] = "skipped"
    current = next((key for key in STAGES if key not in states), None)
    for key in STAGES:
        if key not in states:
            states[key] = "current" if key == current else "waiting"
    return [{"key": key, "label": STAGE_LABELS[key], "state": states[key]} for key in STAGES], current


def pending_invitation(sessions, now, company_active):
    """The newest interview the candidate can still start or resume, or None. Hidden when the company is not active."""
    if not company_active:
        return None
    open_ = [s for s in sessions if s.status in PENDING_INVITE_STATUSES and s.expires_at > now and s.kind in ("screening", "technical")]
    return max(open_, key=lambda s: s.invited_at) if open_ else None


__all__ = ["compute", "pending_invitation", "OPEN_STATUSES"]

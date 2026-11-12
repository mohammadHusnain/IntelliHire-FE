"""Progress across scored sessions (UC-03 step 8): computed in code from the stored scores, never by a model."""
from decimal import Decimal

from django.conf import settings

from . import history

LAST_FOR_DIMENSIONS = 10
OVER_TIME_LIMIT = 50


def _avg(values):
    return sum(Decimal(str(v)) for v in values) / len(values)


def trend(scores):
    """improving, flat or declining: the average of the last 3 scores against the (up to) 3 before them; None below 4 scores."""
    if len(scores) < 4:
        return None
    last, before = scores[-3:], scores[-6:-3]
    gap = _avg(last) - _avg(before)
    threshold = Decimal(settings.MOCK_TREND_THRESHOLD)
    return "improving" if gap > threshold else "declining" if gap < -threshold else "flat"


def compute(user):
    sessions = list(history.mine(user).filter(status="evaluated", overall_score__isnull=False).order_by("completed_at", "invited_at", "id"))
    if not sessions:
        return {"scored_sessions": 0, "scores_over_time": [], "dimension_averages": {}, "best_score": None, "latest_score": None, "trend": None}
    scores = [float(s.overall_score) for s in sessions]
    by_dimension = {}
    for session in sessions[-LAST_FOR_DIMENSIONS:]:
        for name, value in (session.report or {}).get("rubric_averages", {}).items():
            by_dimension.setdefault(name, []).append(value)
    return {
        "scored_sessions": len(sessions),
        "scores_over_time": [
            {"id": str(s.pk), "date": s.completed_at or s.invited_at, "score": float(s.overall_score)} for s in sessions[-OVER_TIME_LIMIT:]
        ],
        "dimension_averages": {name: round(float(_avg(values)), 2) for name, values in by_dimension.items()},
        "best_score": max(scores), "latest_score": scores[-1], "trend": trend(scores),
    }  # fmt: skip

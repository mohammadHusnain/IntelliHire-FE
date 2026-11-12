"""Score arithmetic and the recommendation guard. Plain code: a hook's text never changes any number here."""
from decimal import ROUND_HALF_UP, Decimal

from ..models import Recommendation
from ..rubrics import RUBRICS

CENTS = Decimal("0.01")
HOLD_BAND = 15  # points below the minimum that still count as "hold"


def _dec(value):
    return Decimal(str(value))


def overall_score(answer_scores):
    """Average of the answer scores (0 to 10) times 10, rounded half up to two places; None when nothing is scored."""
    scores = [_dec(s) for s in answer_scores if s is not None]
    if not scores:
        return None
    return min(Decimal(100), (sum(scores) / len(scores) * 10).quantize(CENTS, rounding=ROUND_HALF_UP))


def rubric_averages(turns, kind):
    """Average 0 to 10 score per rubric criterion over the answers that were scored on it."""
    result = {}
    for name in RUBRICS[kind]:
        values = [_dec(t.evaluation["criteria"][name]) for t in turns if name in (t.evaluation or {}).get("criteria", {})]
        if values:
            result[name] = float((sum(values) / len(values)).quantize(CENTS, rounding=ROUND_HALF_UP))
    return result


def recommendation_for(score, minimum, band=HOLD_BAND):
    """advance at or above the minimum, hold within `band` points below it, otherwise not recommended.

    With the default minimum of 60: 75 advances, 60 advances, 45 holds, 44.99 and 40 do not.
    """
    if score is None:
        return None
    score = _dec(score)
    if score >= minimum:
        return Recommendation.ADVANCE
    if score >= minimum - band:
        return Recommendation.HOLD
    return Recommendation.NOT_RECOMMENDED

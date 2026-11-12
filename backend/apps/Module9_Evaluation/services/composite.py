"""The composite score and the recommendation band: plain code (FR-52, UT-06). No model is involved."""
from decimal import ROUND_HALF_UP, Decimal

from ..models import MissingStagePolicy, Recommendation

STAGES = ("cv", "screening", "technical")
CENTS = Decimal("0.01")
BANDS = ((80, Recommendation.STRONG_YES), (65, Recommendation.YES), (50, Recommendation.MAYBE))
ORDER = [Recommendation.NO, Recommendation.MAYBE, Recommendation.YES, Recommendation.STRONG_YES]


def _dec(value):
    return None if value is None else Decimal(str(value))


def compute(scores, weights, policy):
    """Combine the stage scores. Returns (composite, is_partial, missing_stages, weights_used); composite is None with no score.

    With all three scores and weights 30/30/40: 80, 70 and 85 give 79.00. `renormalise` drops a missing stage and
    rescales the others to 100; `zero` counts it as 0. Either way the result is marked partial and names what is missing.
    """
    scores = {stage: _dec(scores.get(stage)) for stage in STAGES}
    present = [stage for stage in STAGES if scores[stage] is not None]
    missing = [stage for stage in STAGES if scores[stage] is None]
    if not present:
        return None, True, missing, {"configured": dict(weights), "effective": {}, "policy": policy, "missing": missing}
    if policy == MissingStagePolicy.ZERO:
        effective = {stage: Decimal(weights[stage]) for stage in STAGES}
        values = {stage: scores[stage] or Decimal(0) for stage in STAGES}
    else:
        total = sum(Decimal(weights[stage]) for stage in present)
        # A job that put all its weight on stages that did not happen falls back to an even split of what did.
        effective = {stage: (Decimal(weights[stage]) / total * 100) if total else Decimal(100) / len(present) for stage in present}
        values = {stage: scores[stage] for stage in present}
    composite = sum(values[stage] * effective[stage] / 100 for stage in effective)
    composite = min(Decimal(100), max(Decimal(0), composite.quantize(CENTS, rounding=ROUND_HALF_UP)))
    used = {
        "configured": dict(weights), "effective": {stage: float(round(effective[stage], 2)) for stage in effective},
        "policy": policy, "missing": missing,
    }  # fmt: skip
    return composite, bool(missing), missing, used


def band_for(composite):
    """strong_yes from 80, yes from 65, maybe from 50, otherwise no."""
    composite = _dec(composite) or Decimal(0)
    for minimum, band in BANDS:
        if composite >= minimum:
            return band
    return Recommendation.NO


def guard(llm_value, composite):
    """The recommendation that is stored. The model may be more cautious than the score by one band, never more
    optimistic and never further off; in every other case the score's own band is used (its words are kept)."""
    band = band_for(composite)
    try:
        gap = ORDER.index(band) - ORDER.index(llm_value)
    except ValueError:
        return band
    return Recommendation(llm_value) if gap in (0, 1) else band

"""The composite score and the recommendation band: plain code (FR-52, UT-06, TC-35)."""
from decimal import Decimal

import pytest

from ..models import MissingStagePolicy as Policy
from ..services import composite

DEFAULTS = {"cv": 30, "screening": 30, "technical": 40}


def compute(cv=None, screening=None, technical=None, weights=DEFAULTS, policy=Policy.RENORMALISE):
    return composite.compute({"cv": cv, "screening": screening, "technical": technical}, weights, policy)


def test_ut06_all_three_stages_80_70_85_give_79():
    score, partial, missing, used = compute(80, 70, 85)
    assert score == Decimal("79.00") and partial is False and missing == []
    assert used["effective"] == {"cv": 30.0, "screening": 30.0, "technical": 40.0}


def test_a_missing_technical_stage_is_rescaled_to_cv_50_and_screening_50_by_default():
    score, partial, missing, used = compute(80, 70, None)
    assert score == Decimal("75.00") and partial is True and missing == ["technical"]
    assert used["effective"] == {"cv": 50.0, "screening": 50.0} and used["policy"] == "renormalise"


def test_with_the_zero_policy_a_missing_stage_counts_as_zero():
    score, partial, missing, used = compute(80, 70, None, policy=Policy.ZERO)
    assert score == Decimal("45.00") and partial and missing == ["technical"]
    assert used["effective"] == {"cv": 30.0, "screening": 30.0, "technical": 40.0}


@pytest.mark.parametrize(
    "scores, expected, missing",
    [((90, None, None), "90.00", ["screening", "technical"]), ((None, 60, None), "60.00", ["cv", "technical"]), ((None, None, 75), "75.00", ["cv", "screening"])],
)
def test_a_single_stage_is_its_own_composite_under_renormalise(scores, expected, missing):
    score, partial, miss, _ = compute(*scores)
    assert score == Decimal(expected) and partial and miss == missing


def test_no_scores_means_no_composite():
    score, partial, missing, _ = compute()
    assert score is None and partial is True and missing == ["cv", "screening", "technical"]


def test_all_weight_on_stages_that_did_not_happen_falls_back_to_an_even_split():
    score, _, _, used = compute(80, 60, None, weights={"cv": 0, "screening": 0, "technical": 100})
    assert score == Decimal("70.00") and used["effective"] == {"cv": 50.0, "screening": 50.0}


def test_rounding_is_half_up_to_two_places_and_stays_within_0_to_100():
    assert compute(33.335, 33.335, 33.335)[0] == Decimal("33.34")
    assert compute(100, 100, 100)[0] == Decimal("100.00") and compute(0, 0, 0)[0] == Decimal("0.00")


def test_custom_weights_are_applied():
    assert compute(100, 0, 0, weights={"cv": 100, "screening": 0, "technical": 0})[0] == Decimal("100.00")
    assert compute(60, 80, 100, weights={"cv": 20, "screening": 30, "technical": 50})[0] == Decimal("86.00")


@pytest.mark.parametrize("value, band", [(100, "strong_yes"), (80, "strong_yes"), (79.99, "yes"), (65, "yes"), (64.99, "maybe"), (50, "maybe"), (49.99, "no"), (0, "no")])
def test_the_recommendation_bands(value, band):
    assert composite.band_for(value) == band


@pytest.mark.parametrize(
    "llm, score, expected",
    [
        ("yes", 70, "yes"),  # agrees
        ("maybe", 70, "maybe"),  # one band more cautious: allowed
        ("strong_yes", 70, "yes"),  # more optimistic than the score allows: the score's band
        ("no", 70, "yes"),  # two bands off: the score's band
        ("strong_yes", 90, "strong_yes"),
        ("yes", 90, "yes"),  # one band more cautious
        ("maybe", 90, "strong_yes"),  # two bands off
        ("maybe", 40, "no"),  # optimistic against a "no" score
        ("no", 55, "no"),  # one band more cautious than "maybe": allowed
        ("nonsense", 70, "yes"),
    ],
)
def test_the_guard_never_lets_the_model_be_more_optimistic_or_far_off(llm, score, expected):
    assert composite.guard(llm, score) == expected

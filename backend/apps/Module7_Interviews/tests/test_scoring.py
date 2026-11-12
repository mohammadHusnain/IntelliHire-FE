"""Score arithmetic and the recommendation guard: plain code, no hooks involved (TC-30)."""
from decimal import Decimal

import pytest

from ..models import InterviewTurn
from ..services import scoring


def turn(criteria):
    return InterviewTurn(evaluation={"criteria": criteria})


def test_overall_is_the_average_of_the_answer_scores_times_ten():
    assert scoring.overall_score([8, 7, 9]) == Decimal("80.00")
    assert scoring.overall_score([Decimal("7.5"), Decimal("6.25")]) == Decimal("68.75")


def test_overall_rounds_half_up_and_ignores_unscored_answers():
    assert scoring.overall_score([7.005]) == Decimal("70.05")
    assert scoring.overall_score([1, 0, 0]) == Decimal("3.33")
    assert scoring.overall_score([10, None, 10]) == Decimal("100.00")


def test_no_scores_means_no_overall():
    assert scoring.overall_score([]) is None
    assert scoring.overall_score([None, None]) is None


def test_rubric_averages_use_only_the_answers_scored_on_that_criterion():
    turns = [turn({"role_alignment": 8, "communication_clarity": 6}), turn({"role_alignment": 6}), turn({})]
    assert scoring.rubric_averages(turns, "screening") == {"role_alignment": 7.0, "communication_clarity": 6.0}


@pytest.mark.parametrize(
    "score, expected",
    [(75, "advance"), (60, "advance"), (59.99, "hold"), (45, "hold"), (44.99, "not_recommended"), (40, "not_recommended"), (0, "not_recommended"), (100, "advance")],
)
def test_the_guard_with_the_default_minimum_of_60(score, expected):
    assert scoring.recommendation_for(score, 60) == expected


def test_the_guard_follows_the_configured_minimum():
    assert scoring.recommendation_for(70, 80) == "hold"
    assert scoring.recommendation_for(64, 80) == "not_recommended"
    assert scoring.recommendation_for(None, 60) is None

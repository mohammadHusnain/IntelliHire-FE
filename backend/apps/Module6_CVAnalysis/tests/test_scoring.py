import datetime
from decimal import Decimal
from types import SimpleNamespace

import pytest

from ..services import scoring

TODAY = datetime.date(2026, 6, 15)


def job(**kw):
    fields = {"title": "Backend Developer", "required_skills": ["Python", "Django", "React"], "min_experience_years": 2,
              "education_level": "bachelor", "description": "Build APIs.", "responsibilities": "Design endpoints."}  # fmt: skip
    fields.update(kw)
    return SimpleNamespace(**fields)


WEIGHTS = {"skills": 50, "experience": 25, "education": 15, "semantic": 10}


class TestSkills:
    def test_two_of_three_required_skills_is_66_7(self):  # UT-05
        score, matched, missing = scoring.skills_part(["Python", "Django"], ["Python", "Django", "React"])
        assert round(score, 1) == 66.7 and matched == ["Python", "Django"] and missing == ["React"]

    def test_case_spacing_and_punctuation_do_not_matter(self):
        score, _, missing = scoring.skills_part(["  PYTHON ", "django.", "(React)"], ["python", "Django", "react"])
        assert score == 100 and missing == []

    @pytest.mark.parametrize("cv,required", [("JS", "JavaScript"), ("ReactJS", "React"), ("react.js", "React"), ("Postgres", "PostgreSQL"), ("node", "Node.js"), ("K8s", "Kubernetes"), ("C Sharp", "C#"), ("golang", "Go"), ("ML", "Machine Learning")])
    def test_known_aliases_match_in_both_directions(self, cv, required):
        assert scoring.skills_part([cv], [required])[0] == 100
        assert scoring.skills_part([required], [cv])[0] == 100

    def test_different_skills_that_look_alike_do_not_match(self):
        assert scoring.skills_part(["Java", "C"], ["JavaScript", "C++", "C#"])[0] == 0

    def test_a_job_without_required_skills_scores_full_marks(self):
        assert scoring.skills_part(["Python"], []) == (100.0, [], [])
        assert scoring.skills_part([], None)[0] == 100.0

    def test_duplicates_and_blanks_in_the_job_list_count_once(self):
        score, matched, missing = scoring.skills_part(["python"], ["Python", "python", " ", "Go"])
        assert score == 50 and matched == ["Python"] and missing == ["Go"]

    def test_an_empty_cv_matches_nothing(self):
        assert scoring.skills_part(None, ["Python"]) == (0.0, [], ["Python"])

    def test_non_text_values_are_tolerated(self):
        assert scoring.skills_part([None, 3, "Python"], ["Python", "3"])[0] == 100


class TestExperience:
    def years(self, entries, fallback=None):
        return scoring.experience_years(entries, fallback, today=TODAY)

    def test_a_single_dated_job(self):
        assert self.years([{"start": "2020-01", "end": "2021-12"}]) == 2.0

    def test_overlapping_jobs_are_counted_once(self):
        assert self.years([{"start": "2020-01", "end": "2021-12"}, {"start": "2021-01", "end": "2022-12"}]) == 3.0

    def test_separate_jobs_add_up_and_gaps_do_not_count(self):
        assert self.years([{"start": "2018-01", "end": "2018-12"}, {"start": "2020-01", "end": "2020-12"}]) == 2.0

    def test_a_current_job_runs_to_this_month(self):
        assert self.years([{"start": "2025-07", "end": None, "is_current": True}]) == 1.0
        assert self.years([{"start": "2025-07", "end": "Present"}]) == 1.0

    def test_year_only_dates_cover_the_whole_year(self):
        assert self.years([{"start": "2020", "end": "2021"}]) == 2.0

    def test_future_dates_are_cut_at_today(self):
        assert self.years([{"start": "2026-01", "end": "2030-12"}]) == 0.5

    def test_an_end_before_the_start_is_ignored(self):
        assert self.years([{"start": "2022-01", "end": "2020-01"}]) == 0.0

    @pytest.mark.parametrize("entries", [[], None, [{"start": None}], [{"start": "last year"}], ["junk", 5], [{"start": "1800-01", "end": "1801-01"}]])
    def test_without_usable_dates_the_stated_total_is_used(self, entries):
        assert self.years(entries, fallback=3.5) == 3.5
        assert self.years(entries) == 0.0

    @pytest.mark.parametrize("fallback,expected", [(-4, 0.0), (99, 50.0), ("abc", 0.0), (None, 0.0)])
    def test_the_stated_total_is_kept_within_sensible_bounds(self, fallback, expected):
        assert self.years([], fallback) == expected

    def test_dated_entries_win_over_an_inflated_stated_total(self):
        assert self.years([{"start": "2024-01", "end": "2024-12"}], fallback=20) == 1.0

    @pytest.mark.parametrize("years,minimum,expected", [(0, 0, 100), (5, None, 100), (1, 2, 50), (2, 2, 100), (9, 2, 100), (0, 3, 0), (-1, 3, 0)])
    def test_experience_score(self, years, minimum, expected):
        assert scoring.experience_part(years, minimum) == expected


class TestEducation:
    def test_the_highest_completed_level_counts(self):
        entries = [{"level": "bachelor", "completed": True}, {"level": "master", "completed": True}, {"level": "intermediate", "completed": True}]
        assert scoring.highest_level(entries) == "master"

    def test_a_degree_in_progress_counts_one_level_below(self):
        assert scoring.highest_level([{"level": "master", "completed": False}]) == "bachelor"
        assert scoring.highest_level([{"level": "bachelor", "completed": False}]) == "intermediate"
        assert scoring.highest_level([{"level": "none", "completed": False}]) == "none"

    def test_a_missing_completed_flag_is_treated_as_completed(self):
        assert scoring.highest_level([{"level": "phd"}]) == "phd"

    @pytest.mark.parametrize("entries", [None, [], [{"level": "wizard"}], ["junk"], [{}]])
    def test_nothing_usable_means_none(self, entries):
        assert scoring.highest_level(entries) == "none"

    @pytest.mark.parametrize(
        "cv,required,expected",
        [("bachelor", "bachelor", 100), ("phd", "bachelor", 100), ("intermediate", "bachelor", 50), ("none", "bachelor", 0),
         ("none", "none", 100), ("bachelor", "master", 50), ("intermediate", "master", 0), ("none", "intermediate", 50), ("master", "phd", 50)],
    )  # fmt: skip
    def test_education_score(self, cv, required, expected):
        assert scoring.education_part(cv, required) == expected


class TestSemantic:
    def test_rescaling_and_clipping(self, settings):
        settings.CV_SEMANTIC_LOW, settings.CV_SEMANTIC_HIGH = 0.2, 0.8
        assert scoring.semantic_part([1, 0], [1, 0]) == 100
        assert scoring.semantic_part([1, 0], [0, 1]) == 0
        assert scoring.semantic_part([1, 1], [1, 0]) == pytest.approx((0.7071 - 0.2) / 0.6 * 100, abs=0.1)

    @pytest.mark.parametrize("a,b", [(None, [1]), ([1], None), ([], [1])])
    def test_a_missing_vector_scores_zero(self, a, b):
        assert scoring.semantic_part(a, b) == 0


class TestTotal:
    def test_the_total_is_the_weighted_sum_of_its_parts(self):  # TC-24
        parsed = {"technical_skills": ["Python", "Django"], "experience": [{"start": "2025-01", "end": "2025-12"}], "education": [{"level": "bachelor", "completed": True}]}
        result = scoring.compute(parsed, job(), WEIGHTS, [1, 0], [1, 0], today=TODAY)
        assert (result["skills_score"], result["experience_score"], result["education_score"], result["semantic_score"]) == (Decimal("66.67"), Decimal("50.00"), Decimal("100.00"), Decimal("100.00"))
        expected = (Decimal("66.6667") * 50 + 50 * 25 + 100 * 15 + 100 * 10) / 100
        assert result["score"] == expected.quantize(Decimal("0.01"))
        assert 0 <= result["score"] <= 100 and result["weights_used"] == WEIGHTS and result["experience_years"] == Decimal("1.0")

    def test_an_empty_cv_scores_zero_for_a_demanding_job(self):
        assert scoring.compute({}, job(), WEIGHTS, None, [1, 0], today=TODAY)["score"] == 0

    def test_a_perfect_cv_scores_100(self):
        parsed = {"technical_skills": ["python", "django", "react"], "total_experience_years": 6, "education": [{"level": "master", "completed": True}]}
        assert scoring.compute(parsed, job(), WEIGHTS, [1, 0], [1, 0], today=TODAY)["score"] == 100

    def test_other_weights_change_the_total(self):
        parsed = {"technical_skills": ["Python"], "total_experience_years": 6, "education": [{"level": "bachelor", "completed": True}]}
        only_skills = scoring.compute(parsed, job(), {"skills": 100, "experience": 0, "education": 0, "semantic": 0}, [1, 0], [1, 0], today=TODAY)
        assert only_skills["score"] == Decimal("33.33")


class TestSignatureAndTexts:
    def test_the_signature_follows_everything_a_score_depends_on(self):
        base = scoring.job_signature(job(), WEIGHTS)
        assert base == scoring.job_signature(job(), dict(WEIGHTS))  # the same job always gives the same fingerprint
        assert base != scoring.job_signature(job(required_skills=["Python"]), WEIGHTS)
        assert base != scoring.job_signature(job(min_experience_years=5), WEIGHTS)
        assert base != scoring.job_signature(job(education_level="master"), WEIGHTS)
        assert base != scoring.job_signature(job(description="Something else."), WEIGHTS)
        assert base != scoring.job_signature(job(), {**WEIGHTS, "skills": 40, "semantic": 20})

    def test_the_cv_text_for_comparison_leaves_out_institutions_and_employers(self):
        parsed = {
            "technical_skills": ["Python"],
            "education": [{"degree": "BS Computer Science", "institution": "Prestige University"}],
            "experience": [{"company": "Famous Corp", "role": "Engineer", "summary": "Built APIs."}],
            "projects": [{"name": "Tracker", "summary": "A web app."}],
        }
        text = scoring.cv_scoring_text(parsed)
        assert "Python" in text and "Engineer Built APIs." in text and "Tracker" in text and "BS Computer Science" in text
        assert "Prestige University" not in text and "Famous Corp" not in text

    def test_an_empty_parse_gives_empty_text(self):
        assert scoring.cv_scoring_text({}) == ""

"""History (FR-14) and progress (UC-03 step 8): newest first, only the caller's, computed in code, an empty state not an error."""
from datetime import timedelta
from decimal import Decimal

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from apps.Module7_Interviews.models import InterviewSession

from ..models import InterviewRole, MockInterviewSession
from ..services import progress
from .conftest import create

pytestmark = pytest.mark.django_db
URL = "/api/mock-interviews/"


@pytest.fixture
def scored_session(candidate):
    """A finished, scored mock session for `candidate` (created directly, like the engine leaves it)."""
    counter = iter(range(1, 1000))

    def make(score, days_ago=0, report=None, user=None, status="evaluated"):
        n = next(counter)
        when = timezone.now() - timedelta(days=days_ago)
        session = InterviewSession.objects.create(
            kind="mock", application=None, candidate_user=user or candidate, token_hash=f"{n:064d}", status=status, role_title="General practice",
            question_target=8, expires_at=when + timedelta(days=7), overall_score=score, completed_at=when,
            report=report if report is not None else {"summary": "ok", "rubric_averages": {"communication": score / 10, "confidence": score / 10 - 1}},
        )
        InterviewSession.objects.filter(pk=session.pk).update(invited_at=when)
        MockInterviewSession.objects.create(session=session, interview_type="general")
        return session

    return make


class TestHistory:
    def test_newest_first_with_the_documented_fields_and_pages(self, me, scored_session):
        old, new = scored_session(60, days_ago=3), scored_session(80, days_ago=1)
        body = me.get(URL).json()
        assert [r["id"] for r in body["results"]] == [str(new.pk), str(old.pk)]
        row = body["results"][0]
        assert set(row) == {"id", "date", "role_title", "interview_type", "overall_score", "status", "feedback_status", "answered_count", "question_count"}
        assert (row["overall_score"], row["feedback_status"], row["role_title"]) == (80.0, "partial", "General practice")  # 0 answered of 8: shown as partial
        assert len(me.get(URL, {"page_size": 1}).json()["results"]) == 1

    def test_a_status_filter_and_an_invalid_one(self, me, scored_session):
        scored_session(70)
        scored_session(0, status="cancelled")
        assert me.get(URL, {"status": "cancelled"}).json()["count"] == 1
        assert me.get(URL, {"status": "nope"}).json()["code"] == "invalid_filter"

    def test_only_my_sessions(self, me, scored_session, auth_client, user_factory):
        other = user_factory()
        scored_session(70, user=other)
        assert me.get(URL).json()["count"] == 0 and auth_client(other).get(URL).json()["count"] == 1

    def test_no_sessions_is_an_empty_list(self, me):
        body = me.get(URL).json()
        assert body["count"] == 0 and body["results"] == []

    def test_the_detail_of_a_session_in_progress_has_no_report_yet(self, me):
        body = create(me).json()
        detail = me.get(f"{URL}{body['id']}/").json()
        assert detail["status"] == "invited" and detail["report"] is None and detail["transcript"] == [] and detail["feedback_status"] == "none"

    def test_the_list_costs_the_same_queries_however_many_sessions(self, me, scored_session):
        def count():
            with CaptureQueriesContext(connection) as queries:
                assert me.get(URL).status_code == 200
            return len(queries)

        for n in range(2):
            scored_session(60 + n)
        few = count()
        for n in range(10):
            scored_session(50 + n)
        assert count() == few


class TestProgress:
    def test_no_scored_sessions_is_an_empty_state_not_an_error(self, me):
        body = me.get(URL + "progress/").json()
        assert body == {"scored_sessions": 0, "scores_over_time": [], "dimension_averages": {}, "best_score": None, "latest_score": None, "trend": None}

    def test_best_latest_over_time_and_dimension_averages(self, me, scored_session):
        for days, score in ((5, 60), (4, 90), (3, 70), (1, 80)):
            scored_session(score, days_ago=days)
        scored_session(0, status="cancelled")  # ignored: not scored
        body = me.get(URL + "progress/").json()
        assert body["scored_sessions"] == 4 and body["best_score"] == 90.0 and body["latest_score"] == 80.0
        assert [p["score"] for p in body["scores_over_time"]] == [60.0, 90.0, 70.0, 80.0]
        assert body["dimension_averages"] == {"communication": 7.5, "confidence": 6.5}

    def test_dimension_averages_use_only_the_last_ten_sessions(self, me, scored_session):
        for index in range(12):
            scored_session(50, days_ago=20 - index, report={"rubric_averages": {"communication": 1.0 if index < 2 else 9.0}})
        assert me.get(URL + "progress/").json()["dimension_averages"] == {"communication": 9.0}

    @pytest.mark.parametrize(
        "scores, expected",
        [
            ([50, 50, 50], None), ([50, 60, 70, 80], "improving"), ([80, 70, 60, 50], "declining"), ([60, 60, 60, 61], "flat"),
            ([50, 50, 50, 70, 70, 70], "improving"), ([70, 70, 70, 50, 50, 50], "declining"), ([60, 60, 60, 61, 61, 62], "flat"),
        ],
    )  # fmt: skip
    def test_the_trend_compares_the_last_three_with_the_three_before(self, scores, expected):
        assert progress.trend(scores) == expected

    def test_a_small_move_is_flat_and_the_threshold_is_two_points(self):
        assert progress.trend([60, 60, 60, 62, 62, 62]) == "flat" and progress.trend([60, 60, 60, 62.5, 62.5, 62.5]) == "improving"

    def test_progress_over_the_api_reports_the_trend(self, me, scored_session):
        for days, score in ((6, 50), (5, 55), (4, 52), (3, 70), (2, 75), (1, 80)):
            scored_session(score, days_ago=days)
        assert me.get(URL + "progress/").json()["trend"] == "improving"

    def test_only_my_sessions_count(self, me, scored_session, user_factory):
        scored_session(99, user=user_factory())
        assert me.get(URL + "progress/").json()["scored_sessions"] == 0

    def test_the_average_helper_is_exact(self):
        assert progress._avg([1, 2]) == Decimal("1.5")


class TestDashboardCard:
    def test_the_candidate_dashboard_shows_the_last_three_mock_sessions(self, me, scored_session):
        for days in (4, 3, 2, 1):
            scored_session(50 + days, days_ago=days)
        recent = me.get("/api/candidate/dashboard/").json()["recent_mock_sessions"]
        assert [m["overall_score"] for m in recent] == [51.0, 52.0, 53.0] and set(recent[0]) == {"id", "date", "role_title", "status", "overall_score"}

    def test_the_role_catalog_is_untouched_by_a_session(self, me, role):
        create(me, interview_type="role_specific", role_id=str(role.pk))
        assert InterviewRole.objects.filter(pk=role.pk).exists()

"""The four-stage tracker (FR-61): pure rules, no database."""
from datetime import timedelta
from types import SimpleNamespace

import pytest
from django.utils import timezone

from ..services import stages


def session(kind, status, hours=48):
    now = timezone.now()
    return SimpleNamespace(kind=kind, status=status, expires_at=now + timedelta(hours=hours), invited_at=now)


def states(status, cv=None, sessions=(), decision=False):
    result, current = stages.compute(status, cv, list(sessions), decision)
    return {s["key"]: s["state"] for s in result}, current


def test_a_fresh_application_is_at_cv_review():
    assert states("submitted") == ({"cv": "current", "screening": "waiting", "technical": "waiting", "decision": "waiting"}, "cv")


def test_a_finished_cv_analysis_moves_on_even_while_the_status_is_still_under_review():
    assert states("under_review", cv="completed")[1] == "screening"
    assert states("under_review", cv="manual_review")[1] == "screening"
    assert states("under_review", cv="failed")[1] == "cv"


def test_shortlisted_waits_for_the_screening_interview():
    result, current = states("shortlisted")
    assert result["cv"] == "done" and current == "screening"


def test_an_open_screening_session_is_the_current_stage():
    assert states("interview", sessions=[session("screening", "in_progress")])[1] == "screening"


def test_a_finished_interview_is_done_whether_or_not_it_has_been_scored():
    for status in ("completed", "incomplete", "evaluating", "evaluated", "evaluation_failed"):
        result, current = states("interview", sessions=[session("screening", status)])
        assert result["screening"] == "done" and current == "technical"


def test_a_cancelled_or_expired_interview_is_not_done():
    for status in ("cancelled", "expired", "invited"):
        assert states("interview", sessions=[session("screening", status)])[1] == "screening"


def test_both_interviews_done_leaves_only_the_decision():
    result, current = states("interview", sessions=[session("screening", "evaluated"), session("technical", "completed")])
    assert (result["technical"], current) == ("done", "decision")


def test_a_decision_closes_everything_and_skips_what_never_happened():
    result, current = states("rejected", cv="completed", decision=True)
    assert result == {"cv": "done", "screening": "skipped", "technical": "skipped", "decision": "done"} and current is None


def test_a_decision_status_without_a_row_still_counts():
    assert states("selected")[0]["decision"] == "done"


def test_a_stage_hr_moved_past_is_skipped():
    result, current = states("interview", sessions=[session("technical", "completed")])
    assert result["screening"] == "skipped" and current == "decision"


@pytest.mark.parametrize("status", ["invited", "interrupted"])
def test_a_waiting_invitation_is_found_until_it_expires(status):
    live = session("screening", status)
    assert stages.pending_invitation([live], timezone.now(), True) is live
    assert stages.pending_invitation([session("screening", status, hours=-1)], timezone.now(), True) is None


@pytest.mark.parametrize("status", ["in_progress", "completed", "cancelled", "expired", "evaluated"])
def test_only_invited_or_interrupted_counts_as_waiting(status):
    assert stages.pending_invitation([session("technical", status)], timezone.now(), True) is None


def test_the_invitation_is_hidden_when_the_company_is_not_active_and_the_newest_wins():
    old, new = session("screening", "invited"), session("technical", "invited")
    new.invited_at = old.invited_at + timedelta(days=1)
    assert stages.pending_invitation([old, new], timezone.now(), False) is None
    assert stages.pending_invitation([old, new], timezone.now(), True) is new
    assert stages.pending_invitation([session("mock", "invited")], timezone.now(), True) is None

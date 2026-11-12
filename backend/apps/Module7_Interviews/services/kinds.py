"""Per-kind rules the engine asks about. Screening's live here; Module 8 registers the technical interview's.

A kind that has no rules registered cannot be invited (mock interviews belong to Module 11). The engine never
branches on a kind name: it asks the rules, so a new kind is one registered class and nothing else changes.
"""
from rest_framework import serializers

from apps.common.errors import ApiError

from ..rubrics import FOCUS_AREAS
from . import scoring


class KindRules:
    """Defaults shared by every kind. Override only what differs."""

    kind = ""
    invitable = False
    allow_voice = True
    outage_uses_bank = True  # when the question hook is down, keep going with bank questions
    report_needs_text = False  # when no report hook is connected, still store the computed numbers

    def check_invite(self, application, user, override, note):
        """Raise ApiError when the application may not be invited. Returns True when an override was used."""
        return False

    def extend_context(self, context, application):
        return context

    def warnings(self, application):
        return []

    def hint(self, session, turns):
        areas = FOCUS_AREAS.get(session.kind)
        hint = {"avoid_topics": []}
        if areas:
            hint["focus_area"] = areas[len(turns) % len(areas)]
        return hint

    def recommend(self, score, minimum):
        return None

    def on_policy_blocked(self, session):
        """Called when the question hook refused the content and the bank is used instead."""

    def extend_report(self, session, turns, report):
        return report


class ScreeningRules(KindRules):
    kind = "screening"
    invitable = True

    def check_invite(self, application, user, override, note):
        from apps.Module4_ApplicationManagement.models import ApplicationStatus

        if application.status in (ApplicationStatus.SHORTLISTED, ApplicationStatus.INTERVIEW):
            return False
        if not override:
            raise ApiError(
                "Shortlist the candidate first, or invite from this status with override and a note.", "prerequisite_missing", 409
            )
        if not (note or "").strip():
            raise serializers.ValidationError({"note": ["A note is required when inviting from this status."]})
        return True

    def recommend(self, score, minimum):
        return scoring.recommendation_for(score, minimum)


_RULES = {"screening": ScreeningRules()}
_DEFAULT = KindRules()


def register(rules):
    """Install the rules for a kind (called from an app's `ready`)."""
    _RULES[rules.kind] = rules


def rules_for(kind):
    return _RULES.get(kind, _DEFAULT)


def invitable_kinds():
    return tuple(kind for kind, rules in _RULES.items() if rules.invitable)

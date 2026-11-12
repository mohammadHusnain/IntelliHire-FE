"""The technical interview's rules (FR-48 to FR-51), plugged into the Module 7 engine. Plain code, no LLM.

What differs from screening: who may be invited, typed answers only, adaptive follow-ups, difficulty by seniority, what
happens when the question service is down, and the report shape. Everything else (links, answers, evaluation, sweeps)
is the shared engine.
"""
from rest_framework import serializers

from apps.common.choices import MemberRole
from apps.common.errors import ApiError
from apps.common.permissions import get_membership
from apps.Module7_Interviews.models import SessionStatus
from apps.Module7_Interviews.services.kinds import KindRules

FOLLOW_UP_BELOW = 4  # an answer scored under this earns one follow-up (code decides, not the hook)
MAX_FOLLOW_UPS = 2
DIFFICULTY = {"junior": "easy", "mid": "medium", "senior": "hard"}
OVERRIDE_ROLES = (MemberRole.ADMIN, MemberRole.HR_MANAGER)


class TechnicalRules(KindRules):
    kind = "technical"
    invitable = True
    allow_voice = False  # FR-48: typed only (candidates may paste code)
    outage_uses_bank = False  # a down question service is a 503 and, after a while, an interrupted session
    report_needs_text = True  # no report hook yet means an empty report ("Report not available yet")

    # --- Invite ---------------------------------------------------------------------------------------------
    def check_invite(self, application, user, override, note):
        """The latest screening must be evaluated as `advance`. An admin or HR manager may override with a note."""
        latest = application.interviews.filter(kind="screening").order_by("-invited_at").first()
        if latest and latest.status == SessionStatus.EVALUATED and latest.recommendation == "advance":
            return False
        if not override:
            raise ApiError(
                "The screening interview must be evaluated as advance first. An admin or HR manager can invite with an override and a note.",
                "screening_not_passed", 409,
            )  # fmt: skip
        membership = get_membership(user) if user is not None else None
        if membership is None or membership.role not in OVERRIDE_ROLES:
            raise ApiError("Only an admin or HR manager can override the screening result.", "override_not_allowed", 403)
        if not (note or "").strip():
            raise serializers.ValidationError({"note": ["A note is required for an override."]})
        return True

    def extend_context(self, context, application):
        """The seniority band is already in the snapshot; add what the hook needs to plan its questions."""
        return {
            **context,
            "competencies_to_cover": list(context.get("required_skills") or []),
            "cv_note": "" if context.get("cv_summary") else "CV not analysed",
        }

    def warnings(self, application):
        if application.job.required_skills:
            return []
        return ["This job has no required skills, so questions will come from the general technical bank until the AI is connected."]

    # --- Questions ------------------------------------------------------------------------------------------
    def hint(self, session, turns):
        """What the question hook is told: the level, what is left to cover and, when the rule fires, `follow_up_of`."""
        context = session.context
        band = context.get("seniority_band", "mid")
        covered = {str(t.question_meta.get("topic", "")).lower() for t in turns if not t.question_meta.get("is_follow_up")}
        remaining = [s for s in context.get("competencies_to_cover", []) if str(s).lower() not in covered]
        hint = {"avoid_topics": [], "seniority_band": band, "difficulty": DIFFICULTY.get(band, "medium"), "competencies_to_cover": remaining}
        follow_ups = sum(1 for t in turns if t.question_meta.get("is_follow_up"))
        last = turns[-1] if turns else None
        if (
            last is not None and last.answered_at is not None and last.score is not None  # never fires while nothing scores
            and last.score < FOLLOW_UP_BELOW and follow_ups < MAX_FOLLOW_UPS
            and not last.question_meta.get("is_follow_up")
            and not any(t.question_meta.get("follow_up_of") == last.index for t in turns)
        ):  # fmt: skip
            hint["follow_up_of"] = last.index
        elif remaining:
            hint["focus_topic"] = remaining[0]
        return hint

    # --- Report ---------------------------------------------------------------------------------------------
    def extend_report(self, session, turns, report):
        """The report shape of FR-51. Every number comes from the code that scored the turns, never from the hook."""
        comments = {item["index"]: item["comment"] for item in report.pop("per_question", [])}
        report["questions"] = [
            {"index": t.index, "question": t.question_text, "score": float(t.score) if t.score is not None else None, "comment": comments.get(t.index, "")}
            for t in turns
        ]  # fmt: skip
        report.setdefault("technical_relevance", "")
        return report

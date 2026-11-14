"""The technical interview's rules (FR-48 to FR-51), plugged into the Module 7 engine. Plain code, no LLM.

What differs from screening: who may be invited, how long the call runs, what the interviewer is told to probe, and the
report shape. Everything else (links, the live call, evaluation, sweeps) is the shared engine.

Like screening, this round is a live spoken call (Module 7 `live/`): the model runs the conversation itself and the
transcript becomes the turns afterwards. The question hook, the bank, the follow-up rule and the per-answer difficulty
this module used to carry are gone with the typed path; what the interviewer should probe is now said in the prompt.
"""
from rest_framework import serializers

from apps.common.choices import MemberRole
from apps.common.errors import ApiError
from apps.common.permissions import get_membership
from apps.Module7_Interviews.models import SessionStatus
from apps.Module7_Interviews.services.kinds import KindRules

OVERRIDE_ROLES = (MemberRole.ADMIN, MemberRole.HR_MANAGER)


class TechnicalRules(KindRules):
    kind = "technical"
    invitable = True
    # FR-48 asked for typed answers so a candidate could paste code. The round is a spoken call now, so
    # voice is how it is answered; there is no typed path left to restrict.
    allow_voice = True
    live = True
    live_seconds = 360  # 6 minutes, inside the 5 to 7 the brief asks for
    outage_uses_bank = False  # a down question service is a 503 and, after a while, an interrupted session
    report_needs_text = True  # no report hook yet means an empty report ("Report not available yet")
    prompt_framing = (
        "This is the technical round, and it is deeper than a screening call. Probe the required skills one at a "
        "time with concrete, practical questions: how they would build or debug something, what they would trade "
        "off, and why. When an answer is thin or hand-waving, ask one follow-up on that same point before moving "
        "on. Match the difficulty to the seniority given above. Spoken answers only, so never ask the candidate "
        "to write or paste code: ask them to talk you through it instead."
    )

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

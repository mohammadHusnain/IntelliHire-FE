"""The mock interview's rules for the Module 7 engine: not invitable by HR, voice allowed, bank questions when the AI cannot help."""
from apps.Module5_Foundation.events import log_event
from apps.Module7_Interviews.services.kinds import KindRules


class MockRules(KindRules):
    kind = "mock"
    invitable = False  # a candidate creates their own practice sessions; HR can never invite to one
    allow_voice = True
    outage_uses_bank = True  # keep practising with bank questions when the question service is down
    report_needs_text = True  # no feedback hook yet: the candidate sees "Feedback is not available yet"

    def on_policy_blocked(self, session):
        """UC-02 EX-01: the provider refused the content, the bank is used, and the failure is recorded (ids and codes only)."""
        log_event(
            "ai.provider_failure", actor=session.candidate_user, target=session, summary="A mock interview question was refused by the provider",
            metadata={"kind": "mock", "hook": "next_question", "reason": "policy_blocked"},
        )  # fmt: skip

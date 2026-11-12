"""Recording HR's decision (FR-57, FR-58, TC-38): one append-only row, the status change, then the candidate is told.

The decision row and the status change are one transaction. Everything that leaves the system (email, notification)
happens after commit. Two people deciding at nearly the same time both get a row, in order; the last status write stands.
"""
from django.db import transaction
from rest_framework.exceptions import NotFound

from apps.common.errors import ApiError
from apps.Module4_ApplicationManagement.models import Application, ApplicationStatus
from apps.Module4_ApplicationManagement.services.review import apply_status
from apps.Module5_Foundation.events import log_event
from apps.Module5_Foundation.notifications import notify

from ..models import Decision, HRDecision, Recommendation, ReportStatus
from .emails import send_decision_email

NOTE_MAX = 1000
MESSAGES = {
    Decision.SELECTED: "You have been selected",
    Decision.REJECTED: "You were not selected",
    Decision.ON_HOLD: "Your application is on hold",
}


def overrode(decision, recommendation):
    """UC-10 A2: HR contradicted the AI (selected after "no", rejected after "strong_yes" or "yes")."""
    return (decision == Decision.SELECTED and recommendation == Recommendation.NO) or (
        decision == Decision.REJECTED and recommendation in (Recommendation.STRONG_YES, Recommendation.YES)
    )


def current(application):
    return application.decisions.order_by("-decided_at", "-id").first()


def _ai_recommendation(application):
    evaluation = getattr(application, "evaluation", None)
    if evaluation is None or evaluation.report_status != ReportStatus.READY:
        return ""  # HR may decide after a failed or missing report: the AI recommendation is stored as empty
    return evaluation.report.get("recommendation", "")


def record_locked(application, *, user, decision, note="", notify_candidate=True, company=None):
    """Write the decision and the status change. The caller holds the application's row lock."""
    latest = current(application)
    if latest is not None and latest.decision == decision and application.status == decision:
        raise ApiError("This is already the current decision.", "same_decision", 409)
    recommendation = _ai_recommendation(application)
    row = HRDecision.objects.create(
        application=application, job_id=application.job_id, decision=decision, decided_by=user, note=(note or "").strip(),
        ai_recommendation=recommendation, overrode_ai=overrode(decision, recommendation),
        notified_candidate=bool(notify_candidate and application.email),
    )  # fmt: skip
    if application.status != decision:
        apply_status(application, user=user, new_status=decision, note=(note or "").strip(), company=company)
    log_event(
        "decision.recorded", actor=user, company=application.job.company_id, target=application,
        summary=f"HR decision recorded: {decision}",
        metadata={"decision": decision, "overrode_ai": row.overrode_ai, "reference": application.reference},
    )  # fmt: skip
    if row.notified_candidate:
        transaction.on_commit(lambda: _tell_candidate(application, decision))
    return row


def _tell_candidate(application, decision):
    send_decision_email(application, decision)
    if application.candidate_user_id:
        notify(application.candidate_user, "application_decision", f"Update on your application: {application.job.title}", MESSAGES[decision])


def record_in_status_change(application, *, user, new_status, note, company):
    """The old status endpoint for selected, rejected and on_hold: always writes a decision row, never emails the candidate."""
    record_locked(application, user=user, decision=new_status, note=note, notify_candidate=False, company=company)


def record(*, company, application_id, user, decision, note="", notify_candidate=True):
    with transaction.atomic():
        try:
            application = (
                Application.objects.select_related("job__company", "candidate_user")
                .select_for_update(of=("self",))
                .filter(job__company=company)
                .get(pk=application_id)
            )
        except Application.DoesNotExist:
            raise NotFound("Application not found.") from None
        row = record_locked(application, user=user, decision=decision, note=note, notify_candidate=notify_candidate, company=company)
    return row, application


def openings_filled(job):
    """A hint for HR only: selecting never closes the job by itself."""
    selected = Application.objects.filter(job=job, status=ApplicationStatus.SELECTED).count()
    return {"openings": job.openings, "selected": selected, "filled": selected >= job.openings}

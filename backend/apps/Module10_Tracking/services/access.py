"""Who may see which application, and the one place the candidate-facing view is built (P2-6: no scores, no notes, no HR names)."""
from django.db.models import Exists, OuterRef, Prefetch, Q
from django.utils import timezone

from apps.common.choices import CompanyStatus
from apps.Module4_ApplicationManagement.models import Application
from apps.Module4_ApplicationManagement.services import tracking_token
from apps.Module7_Interviews.models import InterviewSession
from apps.Module9_Evaluation.models import HRDecision

from ..labels import DECISION_STATUSES, STATUS_LABELS
from . import stages

_LIGHT = InterviewSession.objects.only("id", "application_id", "kind", "status", "expires_at", "invited_at")


def _base():
    return (
        Application.objects.select_related("job__company", "cv_analysis")
        .prefetch_related(Prefetch("interviews", queryset=_LIGHT))
        .annotate(has_decision=Exists(HRDecision.objects.filter(application=OuterRef("pk"))))
    )


def of_candidate(user):
    """Applications tied to this account: linked to it, or made with its verified email. Another email never appears."""
    condition = Q(candidate_user=user)
    if user.email_verified:
        condition |= Q(email=user.email)
    return _base().filter(condition)


def by_tracking_token(raw_token):
    """The application behind a private tracking link, or None (an unknown token and a wrong one look the same)."""
    return _base().filter(tracking_token_hash=tracking_token.hash_token(raw_token)).first()


def _cv_status(application):
    analysis = getattr(application, "cv_analysis", None)  # reverse one-to-one: absent means no analysis row
    return analysis.status if analysis else None


def summary(application, now=None):
    """The fields every candidate-facing application row carries."""
    now = now or timezone.now()
    sessions = list(application.interviews.all())
    state, current = stages.compute(application.status, _cv_status(application), sessions, application.has_decision)
    invite = stages.pending_invitation(sessions, now, application.job.company.status == CompanyStatus.APPROVED)
    return {
        "id": application.pk, "reference": application.reference, "job_title": application.job.title,
        "company_name": application.job.company.name, "applied_at": application.submitted_at, "status": application.status,
        "status_label": STATUS_LABELS[application.status], "stages": state, "current_stage": current,
        "pending_invitation": invite,
    }  # fmt: skip


def detail(application, now=None):
    """The single-application view: summary, the decision (only once HR recorded one) and a timeline of labels and dates."""
    data = summary(application, now)
    invite = data.pop("pending_invitation")
    data["pending_invitation"] = {"kind": invite.kind, "expires_at": invite.expires_at, "can_get_link": True} if invite else None
    decision = application.decisions.order_by("-decided_at", "-id").first()
    if decision is None and application.status in DECISION_STATUSES:
        data["decision"] = {"decision": application.status, "label": STATUS_LABELS[application.status], "decided_at": application.updated_at}
    else:
        data["decision"] = (
            {"decision": decision.decision, "label": STATUS_LABELS[decision.decision], "decided_at": decision.decided_at} if decision else None
        )
    timeline, last = [], None
    for change in application.status_history.order_by("changed_at", "id"):
        if change.to_status != last:
            timeline.append({"status": change.to_status, "label": STATUS_LABELS[change.to_status], "at": change.changed_at})
            last = change.to_status
    data["timeline"] = timeline
    return data

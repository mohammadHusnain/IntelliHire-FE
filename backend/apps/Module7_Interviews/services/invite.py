"""Inviting a candidate: checks, the context snapshot, the private link and the move to `interview`."""
from django.conf import settings
from django.db import IntegrityError, transaction
from rest_framework import serializers

from apps.common.choices import CompanyStatus
from apps.common.errors import ApiError, violated_constraint
from apps.Module4_ApplicationManagement.models import Application, ApplicationStatus, StatusChangeSource
from apps.Module4_ApplicationManagement.services.review import set_status_if
from apps.Module5_Foundation.events import log_event

from ..models import OPEN_STATUSES, InterviewSession, SessionKind
from . import kinds, links, notices
from .context import build_context
from .engine import new_expiry, target_for

MAX_EXPIRY_DAYS = 14
OPEN_CONSTRAINT = "interview_one_open_per_application_kind"


def _open_exists():
    return ApiError("This candidate already has an open interview of this kind. Resend or cancel it first.", "open_session_exists", 409)


def invite(application, *, kind=SessionKind.SCREENING, user=None, expires_in_days=None, override=False, note=""):
    """Create the session and send the link. Returns the session. `user` is the HR user, or None for an automatic invitation."""
    rules = kinds.rules_for(kind)
    if not rules.invitable:
        raise ApiError("This kind of interview cannot be sent yet.", "kind_not_available", 400)
    days = expires_in_days or settings.INTERVIEW_LINK_VALID_DAYS
    if not 1 <= days <= MAX_EXPIRY_DAYS:
        raise serializers.ValidationError({"expires_in_days": [f"Choose between 1 and {MAX_EXPIRY_DAYS} days."]})
    note = (note or "").strip()
    raw = links.new_token()
    with transaction.atomic():
        # Locking the application serialises invitations for it; the partial unique index is the backstop.
        app = Application.objects.select_related("job__company", "cv_analysis").select_for_update(of=("self",)).get(pk=application.pk)
        if app.job.company.status != CompanyStatus.APPROVED:
            raise ApiError("This company is not active.", "company_not_active", 409)
        overridden = rules.check_invite(app, user, override, note)
        if InterviewSession.objects.filter(application=app, kind=kind, status__in=OPEN_STATUSES).exists():
            raise _open_exists()
        try:
            with transaction.atomic():
                session = InterviewSession.objects.create(
                    kind=kind, application=app, candidate_user=app.candidate_user, token_hash=links.hash_token(raw),
                    role_title=app.job.title, context=rules.extend_context(build_context(app), app), question_target=target_for(kind),
                    expires_at=new_expiry(days), created_by=user,
                )  # fmt: skip
        except IntegrityError as exc:
            if violated_constraint(exc) == OPEN_CONSTRAINT:
                raise _open_exists() from None
            raise
        if app.status != ApplicationStatus.INTERVIEW:
            set_status_if(
                app.pk, expected=app.status, new_status=ApplicationStatus.INTERVIEW,
                note=note or "Interview invitation sent", user=user,
                source=StatusChangeSource.HR if user else StatusChangeSource.SYSTEM,
            )  # fmt: skip
        log_event(
            "interview.invited", actor=user, company=app.job.company_id, target=session,
            summary=f"{session.get_kind_display()} interview invitation sent",
            metadata={"kind": kind, "application_id": str(app.pk), "override": bool(overridden), "automatic": user is None},
        )  # fmt: skip
        session.application = app
        session.invite_warnings = rules.warnings(app)
        notices.send_invitation(session, raw)
    return session

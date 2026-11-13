import logging
import re

from django.contrib.auth.models import AnonymousUser
from django.db import transaction

from .models import ActivityEvent
from .sanitize import clean_text, sanitize_json

logger = logging.getLogger(__name__)

EVENT_TYPE_PATTERN = re.compile(r"^[a-z_]+(\.[a-z_]+)+$")
METADATA_MAX_BYTES = 2048

EVENT_TYPES = frozenset(
    {
        "user.registered", "user.suspended", "user.reactivated",
        "company.registered", "company.approved", "company.rejected", "company.suspended", "company.reactivated",
        "job.published", "job.closed",
        "application.submitted", "application.status_changed",
        "cv.analysed", "interview.invited", "interview.completed", "interview.evaluated",
        "interview.expired", "interview.reminded", "mock_interview.deleted",
        "community.archived", "community.member_added", "community.member_removed", "community.request_approved", "community.request_rejected", "community.invited", "community.post_created", "interview.resent", "interview.extended", "interview.cancelled", "interview.reevaluated",
        "evaluation.generated", "evaluation.weights_changed", "decision.recorded",
        "community.created", "community.removed",
        "report.created", "moderation.resolved",
        "ai.settings_changed", "ai.provider_failure",
    }
)  # fmt: skip


def _target(target, target_type, target_id):
    if target is not None:
        return target._meta.model_name, getattr(target, "pk", None)
    return target_type or "", target_id


def log_events_bulk(event_type, rows, *, actor=None):
    """Record many events of one type with a single insert. `rows` are dicts: company, target_type, target_id, summary,
    metadata. Same promise as `log_event`: a failure is logged and never raised."""
    if not EVENT_TYPE_PATTERN.match(event_type or ""):
        raise ValueError(f"Bad event type: {event_type!r}")
    if not rows:
        return 0
    try:
        with transaction.atomic():
            events = ActivityEvent.objects.bulk_create(
                [
                    ActivityEvent(
                        event_type=event_type,
                        actor=actor if getattr(actor, "pk", None) else None,
                        company_id=getattr(row.get("company"), "pk", row.get("company")),
                        target_type=clean_text(row.get("target_type", ""), 50),
                        target_id=row.get("target_id"),
                        summary=clean_text(row["summary"], 300),
                        metadata=sanitize_json(row.get("metadata"), max_bytes=METADATA_MAX_BYTES),
                    )
                    for row in rows
                ],
                batch_size=500,
            )
        return len(events)
    except Exception:
        logger.exception("Could not record %d activity events of type %s", len(rows), event_type)
        return 0


def log_event(event_type, *, summary, actor=None, company=None, target=None, target_type="", target_id=None, metadata=None):
    """Record one audit event; returns it, or None if the record could not be written.

    A malformed event type is a programming error and raises. Anything else (the database, a bad value) is logged
    and swallowed: an audit problem must never undo or block the action it describes. The insert runs in a savepoint
    so a failure cannot poison the caller's transaction.
    """
    if not EVENT_TYPE_PATTERN.match(event_type or ""):
        raise ValueError(f"Bad event type: {event_type!r}")
    if isinstance(actor, AnonymousUser) or not getattr(actor, "pk", None):
        actor = None
    t_type, t_id = _target(target, target_type, target_id)
    try:
        with transaction.atomic():
            return ActivityEvent.objects.create(
                event_type=event_type,
                actor=actor,
                company_id=getattr(company, "pk", company),
                target_type=clean_text(t_type, 50),
                target_id=t_id,
                summary=clean_text(summary, 300),
                metadata=sanitize_json(metadata, max_bytes=METADATA_MAX_BYTES),
            )
    except Exception:
        logger.exception("Could not record activity event %s", event_type)
        return None

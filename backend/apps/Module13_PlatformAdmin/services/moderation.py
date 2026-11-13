"""The moderation queue (FR-76): flag something, review it, resolve it. Actions reuse the existing service for each object."""
import hashlib

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound

from apps.common.errors import ApiError
from apps.Module5_Foundation.events import log_event

from ..models import FlagAction, FlagSource, FlagStatus, FlagTarget, ModerationFlag

DEDUPE_HOURS = 24
ACTION_FOR_TARGET = {
    FlagTarget.USER: FlagAction.SUSPEND_USER,
    FlagTarget.COMPANY: FlagAction.SUSPEND_COMPANY,
    FlagTarget.JOB: FlagAction.CLOSE_JOB,
    FlagTarget.COMMUNITY: FlagAction.REMOVE_COMMUNITY,
    FlagTarget.POST: FlagAction.REMOVE_POST,
}
REPORTABLE = (FlagTarget.JOB, FlagTarget.COMMUNITY, FlagTarget.POST)


def fingerprint(value):
    return hashlib.sha256(str(value or "").encode()).hexdigest()


def _target(target_type, target_id):
    """The object a flag points at, or None when it is gone. Never raises on an unknown id."""
    from apps.Module1_Authentication.models import User
    from apps.Module12_Communities.models import Community, CommunityPost
    from apps.Module2_CompanyManagement.models import Company
    from apps.Module3_JobPosting.models import JobPosting

    models = {FlagTarget.USER: User, FlagTarget.COMPANY: Company, FlagTarget.JOB: JobPosting, FlagTarget.COMMUNITY: Community, FlagTarget.POST: CommunityPost}
    model = models.get(target_type)
    try:
        return model.objects.filter(pk=target_id).first() if model else None
    except (ValueError, TypeError):
        return None


def describe(flag):
    """A short, safe label for the queue: what the flag points at, and whether it still exists."""
    target = _target(flag.target_type, flag.target_id)
    if target is None:
        return {"exists": False, "label": ""}
    labels = {
        FlagTarget.USER: lambda t: t.full_name, FlagTarget.COMPANY: lambda t: t.name, FlagTarget.JOB: lambda t: t.title,
        FlagTarget.COMMUNITY: lambda t: t.name, FlagTarget.POST: lambda t: t.title,
    }  # fmt: skip
    return {"exists": True, "label": labels[flag.target_type](target)}


def raise_flag(*, target_type, target_id, reason, source, reported_by=None, reporter_fingerprint=""):
    """Create a flag, or return the open one this reporter already raised for this target in the last 24 hours."""
    if target_type not in FlagTarget.values:
        raise ApiError("Unknown target type.", "invalid_target", 400)
    if _target(target_type, target_id) is None:
        raise NotFound("Target not found.")
    if source == FlagSource.REPORTED:
        since = timezone.now() - timezone.timedelta(hours=DEDUPE_HOURS)
        earlier = ModerationFlag.objects.filter(target_type=target_type, target_id=target_id, source=source, created_at__gte=since)
        earlier = earlier.filter(reported_by=reported_by) if reported_by else earlier.filter(reporter_fingerprint=reporter_fingerprint)
        existing = earlier.first()
        if existing:
            return existing, False
    flag = ModerationFlag.objects.create(
        target_type=target_type, target_id=target_id, reason=reason[:1000], source=source, reported_by=reported_by, reporter_fingerprint=reporter_fingerprint
    )
    log_event(
        "report.created", actor=reported_by, target_type=target_type, target_id=target_id, summary=f"{target_type} flagged for review",
        metadata={"source": source, "flag_id": str(flag.pk)},
    )  # fmt: skip
    return flag, True


def review(flag):
    won = ModerationFlag.objects.filter(pk=flag.pk, status=FlagStatus.OPEN).update(status=FlagStatus.REVIEWING)
    if not won:
        raise ApiError("This flag is not open.", "not_open", 409)
    flag.refresh_from_db()
    return flag


def _perform(flag, admin, note):
    """Run the action with the existing service for that object. Returns the stored action code."""
    from apps.Module1_Authentication.services import suspend_user
    from apps.Module12_Communities.models import CommunityPost, PostStatus
    from apps.Module12_Communities.services.core import remove as remove_community
    from apps.Module2_CompanyManagement.services.review import suspend_company
    from apps.Module3_JobPosting.services.lifecycle import close_job

    target = _target(flag.target_type, flag.target_id)
    if target is None:
        raise ApiError("The flagged object no longer exists, so it can only be dismissed.", "target_gone", 409)
    if flag.target_type == FlagTarget.USER:
        suspend_user(actor=admin, user_id=target.pk)
    elif flag.target_type == FlagTarget.COMPANY:
        suspend_company(company_id=target.pk, reason=note[:500], actor=admin)
    elif flag.target_type == FlagTarget.JOB:
        close_job(company=target.company, job_id=target.pk, user=admin)
    elif flag.target_type == FlagTarget.COMMUNITY:
        remove_community(target, admin, note)
    else:
        CommunityPost.objects.filter(pk=target.pk).update(status=PostStatus.ARCHIVED)
    return ACTION_FOR_TARGET[flag.target_type]


def resolve(flag, admin, note, act=False):
    """Dismiss the flag, or take the one action that fits its target. A note is always required."""
    note = (note or "").strip()
    if not note:
        from rest_framework import serializers

        raise serializers.ValidationError({"note": ["Say what you decided."]})
    if flag.status in (FlagStatus.DISMISSED, FlagStatus.ACTIONED):
        raise ApiError("This flag was already resolved.", "already_resolved", 409)
    with transaction.atomic():
        action = _perform(flag, admin, note) if act else FlagAction.NONE
        won = ModerationFlag.objects.filter(pk=flag.pk).exclude(status__in=[FlagStatus.DISMISSED, FlagStatus.ACTIONED]).update(
            status=FlagStatus.ACTIONED if act else FlagStatus.DISMISSED, resolution_note=note[:1000], action_taken=action, resolved_by=admin, resolved_at=timezone.now()
        )
        if not won:
            raise ApiError("This flag was already resolved.", "already_resolved", 409)
        log_event(
            "moderation.resolved", actor=admin, target_type=flag.target_type, target_id=flag.target_id, summary=f"Flag resolved: {action}",
            metadata={"flag_id": str(flag.pk), "action": action},
        )  # fmt: skip
    flag.refresh_from_db()
    return flag

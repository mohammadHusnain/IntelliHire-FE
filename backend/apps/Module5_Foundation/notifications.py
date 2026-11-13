import re

from django.db import transaction

from .models import Notification, NotificationPreference
from .sanitize import clean_text, sanitize_json

KIND_PATTERN = re.compile(r"^[a-z][a-z_]{0,49}$")
TITLE_MAX = 200
BODY_MAX = 1000
PAYLOAD_MAX_BYTES = 4096
BATCH_SIZE = 500


def _validated(kind, title, body, link, payload):
    if not KIND_PATTERN.match(kind or ""):
        raise ValueError(f"Bad notification kind: {kind!r}")
    title = clean_text(title, TITLE_MAX)
    if not title:
        raise ValueError("A notification needs a title.")
    link = (link or "").strip()
    if link and (not link.startswith("/") or link.startswith("//") or "\\" in link or any(c.isspace() or ord(c) < 32 for c in link) or len(link) > 300):
        raise ValueError("A notification link must be a path inside the frontend, such as /candidate/applications/1.")
    return {
        "kind": kind,
        "title": title,
        "body": clean_text(body, BODY_MAX, multiline=True),
        "link": link,
        "payload": sanitize_json(payload, max_bytes=PAYLOAD_MAX_BYTES),
    }


def notify(user, kind, title, body="", link="", payload=None):
    """Create one notification for `user`. Runs in the caller's transaction."""
    return Notification.objects.create(user=user, **_validated(kind, title, body, link, payload))


def notify_many(users, kind, title, body="", link="", payload=None):
    """One notification per distinct user, written in batches; returns how many were created."""
    fields = _validated(kind, title, body, link, payload)
    seen, rows = set(), []
    for user in users:
        pk = getattr(user, "pk", user)
        if pk is None or pk in seen:
            continue
        seen.add(pk)
        rows.append(Notification(user_id=pk, **fields))
    with transaction.atomic():
        Notification.objects.bulk_create(rows, batch_size=BATCH_SIZE)
    return len(rows)


def preference_enabled_user_ids(user_ids, field, default=True):
    """Return user ids whose stored preference enables `field`, honoring the model default for missing rows."""
    ids = {getattr(user, "pk", user) for user in user_ids if getattr(user, "pk", user) is not None}
    if not ids:
        return set()
    explicit = NotificationPreference.objects.filter(user_id__in=ids)
    if default:
        disabled = explicit.filter(**{field: False}).values_list("user_id", flat=True)
        return ids - set(disabled)
    return set(explicit.filter(**{field: True}).values_list("user_id", flat=True))


def notify_platform_admins(kind, title, body="", link="", payload=None):
    from apps.common.choices import UserRole, UserStatus
    from apps.Module1_Authentication.models import User

    user_ids = User.objects.filter(role=UserRole.PLATFORM_ADMIN, status=UserStatus.ACTIVE).values_list("pk", flat=True)
    return notify_many(user_ids, kind, title, body, link=link, payload=payload)

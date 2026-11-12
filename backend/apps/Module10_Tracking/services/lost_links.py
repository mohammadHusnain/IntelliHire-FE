"""The "lost link" request: the same answer for every address, so nobody can probe which emails applied."""
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.Module4_ApplicationManagement.models import Application
from apps.Module4_ApplicationManagement.services import tracking_token
from apps.Module5_Foundation.models import OutboundEmail

from .. import emails

MAX_APPLICATIONS = 25
NEUTRAL = "If we found applications for this email, we have sent you the links to follow them."


def request_links(email):
    """Issue fresh tracking links for every application made with this email and mail them in one message.

    Silent when there are none, and when this address already got its quota of such emails this hour (so the form cannot be
    used to flood someone's inbox). The caller answers identically either way.
    """
    email = (email or "").strip().lower()
    if not email:
        return 0
    applications = list(Application.objects.filter(email=email).select_related("job__company").order_by("-submitted_at")[:MAX_APPLICATIONS])
    if not applications:
        return 0
    recent = OutboundEmail.objects.filter(to_email=email, kind="tracking_links", created_at__gte=timezone.now() - timedelta(hours=1)).count()
    if recent >= settings.TRACKING_LINKS_PER_EMAIL_PER_HOUR:
        return 0
    entries = []
    with transaction.atomic():
        for application in applications:
            raw = tracking_token.new_token()
            Application.objects.filter(pk=application.pk).update(tracking_token_hash=tracking_token.hash_token(raw))
            entries.append((application, raw))
        emails.send_tracking_links(email, entries)
    return len(entries)

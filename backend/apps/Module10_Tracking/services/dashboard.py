"""The candidate dashboard: counts by label, waiting invitations, recent mock sessions, unread notifications, profile completeness."""
from django.utils import timezone

from apps.Module5_Foundation.models import Notification

from ..labels import STATUS_LABELS
from . import access

# Module 11 registers a function here that returns the user's latest mock sessions; with none registered the list is empty.
RECENT_MOCK_PROVIDERS = []


def register_recent_mock_provider(provider):
    if provider not in RECENT_MOCK_PROVIDERS:
        RECENT_MOCK_PROVIDERS.append(provider)


def profile_completeness(user):
    """Percent of ten profile items filled in, and which ones are missing."""
    profile = getattr(user, "candidate_profile", None)
    if profile is None:
        return {"percent": 0, "missing": ["profile"]}
    items = {
        "headline": bool(profile.headline), "phone": bool(profile.phone), "location": bool(profile.location), "bio": bool(profile.bio),
        "target_role": bool(profile.target_role), "experience_level": bool(profile.experience_level), "skills": bool(profile.skills),
        "cv": bool(profile.resume), "links": any((profile.linkedin_url, profile.github_url, profile.portfolio_url)),
        "education_or_experience": profile.education.exists() or profile.experience.exists(),
    }  # fmt: skip
    return {"percent": round(100 * sum(items.values()) / len(items)), "missing": [name for name, ok in items.items() if not ok]}


def build(user):
    now = timezone.now()
    counts = {label: 0 for label in STATUS_LABELS.values()}
    waiting = []
    for application in access.of_candidate(user):
        data = access.summary(application, now)
        counts[data["status_label"]] += 1
        invite = data["pending_invitation"]
        if invite:
            waiting.append(
                {
                    "application_id": data["id"], "reference": data["reference"], "job_title": data["job_title"],
                    "company_name": data["company_name"], "kind": invite.kind, "expires_at": invite.expires_at,
                }  # fmt: skip
            )
    recent = []
    for provider in RECENT_MOCK_PROVIDERS:
        recent += provider(user)
    return {
        "counts": counts, "total": sum(counts.values()), "pending_invitations": sorted(waiting, key=lambda w: w["expires_at"]),
        "recent_mock_sessions": recent[:3], "unread_notifications": Notification.objects.filter(user=user, read_at__isnull=True).count(),
        "profile": profile_completeness(user),
    }  # fmt: skip

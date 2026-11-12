"""Attaching applications to an account once its email is verified (P2-7)."""
from apps.common.choices import UserRole
from apps.Module4_ApplicationManagement.models import Application
from apps.Module7_Interviews.models import InterviewSession


def link_applications(user):
    """Every application made with this (verified) email and not yet tied to an account now belongs to it. Returns how many."""
    if user.role != UserRole.CANDIDATE or not user.email_verified:
        return 0
    ids = list(Application.objects.filter(email=user.email, candidate_user__isnull=True).values_list("pk", flat=True))
    if not ids:
        return 0
    Application.objects.filter(pk__in=ids, candidate_user__isnull=True).update(candidate_user=user)
    InterviewSession.objects.filter(application_id__in=ids, candidate_user__isnull=True).update(candidate_user=user)
    return len(ids)

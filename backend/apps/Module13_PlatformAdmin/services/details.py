"""Read-only detail views: a user, a company's onboarding, a job, a community, and the activity log (FR-71 to FR-76)."""
import csv
import io

from django.db.models import Count, Q
from django.utils import timezone

from apps.common.choices import UserRole
from apps.Module12_Communities.models import Community, CommunityMembership, CommunityPost
from apps.Module2_CompanyManagement.models import CompanyMember
from apps.Module3_JobPosting.models import JobPosting
from apps.Module4_ApplicationManagement.models import Application
from apps.Module5_Foundation.models import ActivityEvent

from ..models import FlagStatus, ModerationFlag

ACTIVITY_LIMIT = 20
EXPORT_LIMIT = 5000
RECENT_POSTS = 5


def open_flags_for(target_type, target_id):
    rows = ModerationFlag.objects.filter(target_type=target_type, target_id=target_id, status__in=[FlagStatus.OPEN, FlagStatus.REVIEWING])
    return [{"id": f.pk, "reason": f.reason, "source": f.source, "status": f.status, "created_at": f.created_at} for f in rows]


def user_detail(user):
    membership = getattr(user, "company_membership", None)
    counts = {}
    if user.role == UserRole.CANDIDATE:
        counts["applications"] = Application.objects.filter(Q(candidate_user=user) | Q(email=user.email)).count()
        counts["communities"] = CommunityMembership.objects.filter(user=user, status="active").count()
    else:
        counts["jobs_created"] = JobPosting.objects.filter(created_by=user).count()
    events = ActivityEvent.objects.filter(Q(actor=user) | Q(target_type="user", target_id=user.pk)).order_by("-created_at")[:ACTIVITY_LIMIT]
    return {
        "id": user.pk, "full_name": user.full_name, "email": user.email, "role": user.role, "status": user.status,
        "email_verified": user.email_verified, "date_joined": user.date_joined, "last_login": user.last_login,
        "company": {"id": membership.company_id, "name": membership.company.name, "role": membership.role, "is_active": membership.is_active} if membership else None,
        "counts": counts,
        "recent_activity": [{"id": e.pk, "event_type": e.event_type, "summary": e.summary, "created_at": e.created_at} for e in events],
        "open_flags": open_flags_for("user", user.pk),
    }  # fmt: skip


def company_onboarding(company):
    from apps.Module2_CompanyManagement.services.profile import profile_completion

    members = CompanyMember.objects.filter(company=company).select_related("user")
    jobs = JobPosting.objects.filter(company=company)
    return {
        "profile_completion": profile_completion(company),
        "members_by_role": {row["role"]: row["total"] for row in members.filter(is_active=True).values("role").annotate(total=Count("pk"))},
        "jobs_by_status": {row["status"]: row["total"] for row in jobs.values("status").annotate(total=Count("pk"))},
        "applications_total": Application.objects.filter(job__company=company).count(),
        "communities": Community.objects.filter(company=company).exclude(status="removed").count(),
        "staff": [
            {"id": m.user_id, "full_name": m.user.full_name, "email": m.user.email, "role": m.role, "status": m.user.status, "is_active": m.is_active, "joined_at": m.joined_at}
            for m in members.order_by("role", "user__full_name")
        ],
        "open_flags": open_flags_for("company", company.pk),
    }  # fmt: skip


def job_row(job):
    return {
        "id": job.pk, "title": job.title, "company": {"id": job.company_id, "name": job.company.name}, "status": job.status,
        "department": job.department, "applications": getattr(job, "applications_total", None), "deadline": job.deadline,
        "published_at": job.published_at, "created_at": job.created_at,
    }  # fmt: skip


def job_detail(job):
    return {
        **job_row(job), "description": job.description, "required_skills": job.required_skills, "employment_type": job.employment_type,
        "work_mode": job.work_mode, "location": job.location, "openings": job.openings, "created_by": job.created_by.full_name if job.created_by else "",
        "applications_by_status": {row["status"]: row["total"] for row in Application.objects.filter(job=job).values("status").annotate(total=Count("pk"))},
        "open_flags": open_flags_for("job", job.pk),
    }  # fmt: skip


def jobs_queryset(company=None, status=None, q="", created_from=None, created_to=None):
    queryset = JobPosting.objects.select_related("company").annotate(applications_total=Count("applications"))
    if company:
        queryset = queryset.filter(company_id=company)
    if status:
        queryset = queryset.filter(status=status)
    if q:
        queryset = queryset.filter(Q(title__icontains=q) | Q(company__name__icontains=q) | Q(department__icontains=q))
    if created_from:
        queryset = queryset.filter(created_at__date__gte=created_from)
    if created_to:
        queryset = queryset.filter(created_at__date__lte=created_to)
    return queryset.order_by("-created_at", "-pk")


def community_row(community):
    return {
        "id": community.pk, "name": community.name, "company": {"id": community.company_id, "name": community.company.name},
        "status": community.status, "join_mode": community.join_mode, "member_count": community.member_count, "created_at": community.created_at,
    }  # fmt: skip


def community_detail(community):
    posts = CommunityPost.objects.filter(community=community).order_by("-created_at")[:RECENT_POSTS]
    return {
        **community_row(community), "description": community.description, "mission": community.mission,
        "members_active": CommunityMembership.objects.filter(community=community, status="active").count(),
        "posts_total": CommunityPost.objects.filter(community=community).count(),
        "recent_posts": [{"id": p.pk, "kind": p.kind, "title": p.title, "status": p.status, "created_at": p.created_at} for p in posts],
        "open_flags": open_flags_for("community", community.pk),
    }  # fmt: skip


def communities_queryset(company=None, status=None, q=""):
    queryset = Community.objects.select_related("company")
    if company:
        queryset = queryset.filter(company_id=company)
    if status:
        queryset = queryset.filter(status=status)
    if q:
        queryset = queryset.filter(Q(name__icontains=q) | Q(company__name__icontains=q))
    return queryset.order_by("-created_at", "-pk")


def activity_queryset(event_type=None, actor=None, company=None, start=None, end=None):
    queryset = ActivityEvent.objects.select_related("actor")
    if event_type:
        queryset = queryset.filter(event_type=event_type)
    if actor:
        queryset = queryset.filter(actor_id=actor)
    if company:
        queryset = queryset.filter(company_id=company)
    if start:
        queryset = queryset.filter(created_at__date__gte=start)
    if end:
        queryset = queryset.filter(created_at__date__lte=end)
    return queryset.order_by("-created_at", "-pk")


def activity_row(event, metadata=False):
    row = {
        "id": event.pk, "event_type": event.event_type, "summary": event.summary, "created_at": event.created_at,
        "actor": {"id": event.actor_id, "full_name": event.actor.full_name} if event.actor_id else None,
        "company_id": event.company_id, "target_type": event.target_type, "target_id": event.target_id,
    }  # fmt: skip
    if metadata:
        row["metadata"] = event.metadata
    return row


_RISKY = ("=", "+", "-", "@", "\t", "\r")


def _cell(value):
    text = "" if value is None else str(value)
    return "'" + text if text[:1] in _RISKY else text


def activity_csv(queryset):
    """The log as CSV: UTF-8 with a BOM, spreadsheet-safe, capped so a huge table is never loaded at once."""
    buffer = io.StringIO()
    buffer.write("﻿")
    writer = csv.writer(buffer)
    writer.writerow(["When", "Event", "Summary", "Actor", "Company", "Target type", "Target id"])
    for event in queryset.values_list("created_at", "event_type", "summary", "actor__full_name", "company_id", "target_type", "target_id")[:EXPORT_LIMIT]:
        when = event[0].strftime("%Y-%m-%d %H:%M:%S UTC") if event[0] else ""
        writer.writerow([when, *[_cell(v) for v in event[1:]]])
    return buffer.getvalue()


def stamp():
    return timezone.now().strftime("%Y%m%d-%H%M")


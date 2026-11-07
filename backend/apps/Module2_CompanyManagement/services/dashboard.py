from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone

from apps.common.choices import CompanyStatus

from ..models import CompanyMember, InvitationStatus, StaffInvitation
from .profile import profile_completion

CLOSING_SOON_DAYS = 7
CLOSING_SOON_LIMIT = 20  # a bound for the first screen; the Doc names no limit
NEW_APPLICANTS_DAYS = 7
RECENT_LIMIT = 5


def _team_block(company):
    active = CompanyMember.objects.filter(company=company).aggregate(n=Count("pk", filter=Q(is_active=True)))["n"]
    pending = StaffInvitation.objects.filter(
        company=company, status=InvitationStatus.PENDING, expires_at__gt=timezone.now()
    ).count()
    return {"active_members": active, "pending_invitations": pending}


def _hiring_blocks(company):
    """Jobs and applications of the company, from aggregate queries only (NFR-01).

    Modules 3 and 4 depend on this app, so they are imported here, inside the function, as the Doc
    prescribes ("imports them inside its own function").
    """
    from apps.Module3_JobPosting.models import JobPosting, JobStatus
    from apps.Module4_ApplicationManagement.models import Application, ApplicationStatus

    now = timezone.now()
    job_counts = JobPosting.objects.filter(company=company).aggregate(
        open=Count("pk", filter=Q(status=JobStatus.OPEN)),
        draft=Count("pk", filter=Q(status=JobStatus.DRAFT)),
        closed=Count("pk", filter=Q(status=JobStatus.CLOSED)),
    )

    applications = Application.objects.filter(job__company=company)
    pipeline = {status: 0 for status in ApplicationStatus.values}
    for row in applications.values("status").annotate(total=Count("pk")):
        pipeline[row["status"]] = row["total"]
    new_recently = applications.filter(submitted_at__gte=now - timedelta(days=NEW_APPLICANTS_DAYS)).count()

    closing_soon = (
        JobPosting.objects.filter(
            company=company,
            status=JobStatus.OPEN,
            deadline__gt=now,
            deadline__lte=now + timedelta(days=CLOSING_SOON_DAYS),
        )
        .annotate(application_count=Count("applications", distinct=True))
        .order_by("deadline", "pk")[:CLOSING_SOON_LIMIT]
    )
    recent = applications.select_related("job").order_by("-submitted_at", "-pk")[:RECENT_LIMIT]

    return {
        "jobs": job_counts,
        "applicants": {"total": sum(pipeline.values()), "new_last_7_days": new_recently},
        "pipeline": pipeline,
        "closing_soon": [
            {"id": job.pk, "title": job.title, "deadline": job.deadline, "application_count": job.application_count}
            for job in closing_soon
        ],
        "recent_applications": [
            {
                "candidate_name": application.full_name,
                "job_title": application.job.title,
                "submitted_at": application.submitted_at,
                "status": application.status,
            }
            for application in recent
        ],
    }


def build_dashboard(company, logo_url):
    return {
        "company": {
            "name": company.name,
            "logo": logo_url,
            "status": CompanyStatus(company.status).value,
            "profile_completion": profile_completion(company),
        },
        **_hiring_blocks(company),
        "team": _team_block(company),
    }

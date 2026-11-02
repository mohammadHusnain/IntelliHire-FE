from django.db.models import Count, Q
from django.utils import timezone

from apps.common.choices import CompanyStatus

from ..models import CompanyMember, InvitationStatus, StaffInvitation
from .profile import profile_completion

APPLICATION_STATUSES = (
    "submitted",
    "under_review",
    "shortlisted",
    "interview",
    "selected",
    "rejected",
    "on_hold",
)


def _team_block(company):
    active = CompanyMember.objects.filter(company=company).aggregate(n=Count("pk", filter=Q(is_active=True)))["n"]
    pending = StaffInvitation.objects.filter(
        company=company, status=InvitationStatus.PENDING, expires_at__gt=timezone.now()
    ).count()
    return {"active_members": active, "pending_invitations": pending}


def _hiring_blocks():
    """Jobs and applications do not exist until Modules 3 and 4; the Doc asks for zeros until then."""
    return {
        "jobs": {"open": 0, "draft": 0, "closed": 0},
        "applicants": {"total": 0, "new_last_7_days": 0},
        "pipeline": {status: 0 for status in APPLICATION_STATUSES},
        "closing_soon": [],
        "recent_applications": [],
    }


def build_dashboard(company, logo_url):
    return {
        "company": {
            "name": company.name,
            "logo": logo_url,
            "status": CompanyStatus(company.status).value,
            "profile_completion": profile_completion(company),
        },
        **_hiring_blocks(),
        "team": _team_block(company),
    }

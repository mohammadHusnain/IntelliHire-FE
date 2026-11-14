"""Who hears about what: HR notifications and the candidate's invitation. Ids and codes only in payloads and events."""
from apps.common.choices import MemberRole, UserStatus
from apps.common.mail import send_email_on_commit
from apps.Module2_CompanyManagement.models import CompanyMember
from apps.Module5_Foundation.notifications import notify, notify_many

from .links import interview_url

NOTIFY_ROLES = (MemberRole.ADMIN, MemberRole.HR_MANAGER, MemberRole.RECRUITER)
AI_DISCLAIMER = (
    "This interview is assisted by AI. Any score or summary is a recommendation for the recruiting team: "
    "people make every hiring decision."
)


def estimated_minutes(session):
    """How long the candidate should set aside.

    A live call has an exact length, so say that. The typed flow can only be estimated from how many
    questions are planned.
    """
    from .kinds import rules_for

    rules = rules_for(session.kind)
    if getattr(rules, "live", False):
        from ..live.prompts import live_seconds

        return max(1, round(live_seconds(rules) / 60))
    return max(5, round(session.question_target * 2.5))


def hr_user_ids(company_id):
    return list(
        CompanyMember.objects.filter(
            company_id=company_id, is_active=True, role__in=NOTIFY_ROLES, user__status=UserStatus.ACTIVE
        ).values_list("user_id", flat=True)
    )


def application_link(session):
    return f"/company/candidates/{session.application_id}"


def notify_hr(session, kind, title, body=""):
    """Tell the company's recruiters about one interview, linking to the candidate's page. Mock interviews have no company."""
    if not session.application_id:
        return 0
    return notify_many(
        hr_user_ids(session.application.job.company_id), kind, title, body, link=application_link(session),
        payload={"session_id": str(session.pk), "application_id": str(session.application_id), "kind": session.kind},
    )  # fmt: skip


def send_invitation(session, raw_token):
    """The only place the raw token is used: the link in the candidate's email (marked sensitive, wiped after sending)."""
    application = session.application
    company = application.job.company.name
    deadline = session.expires_at.strftime("%d %B %Y, %H:%M UTC")
    send_email_on_commit(
        to=application.email,
        subject=f"Your {session.get_kind_display().lower()} interview for {session.role_title} at {company}",
        body=(
            f"Hello {application.full_name},\n\n"
            f"{company} would like to invite you to a {session.get_kind_display().lower()} interview for {session.role_title}.\n\n"
            f"Start here: {interview_url(raw_token)}\n"
            f"Please start before: {deadline}\n\n"
            f"What to expect: about {estimated_minutes(session)} minutes and {session.question_target} questions. You type your "
            "answers, you can pause and come back with the same link, and no account is needed. "
            f"{AI_DISCLAIMER}\n\n"
            "This link is private. Please do not share it.\n"
        ),
        kind="interview_invitation",
        sensitive=True,
        related=session,
    )
    if session.candidate_user_id:
        notify(
            session.candidate_user, "interview_invited", f"Interview invitation: {session.role_title}",
            f"{company} invited you to an interview. Open the link in your email to start.",
        )  # fmt: skip

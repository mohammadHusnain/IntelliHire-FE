from django.conf import settings

from apps.common.choices import MemberRole
from apps.common.mail import send_email_on_commit

ROLE_LABELS = {
    MemberRole.ADMIN: "Admin",
    MemberRole.HR_MANAGER: "HR manager",
    MemberRole.RECRUITER: "Recruiter",
    MemberRole.VIEWER: "Viewer",
}


def _link(path):
    return f"{settings.FRONTEND_URL}{path}"


def send_registration_received_email(user, company):
    send_email_on_commit(
        to=user.email,
        subject="IntelliHire registration received",
        body=(
            f"Hello {user.full_name},\n\n"
            f"We received the registration for {company.name}. After you verify your email, "
            "our team will review it and notify you of the decision. You will be able to log in "
            "once the company is approved.\n"
        ),
    )


def _to_each_platform_admin(subject, body):
    from apps.Module1_Authentication.models import User

    admins = User.objects.filter(role="platform_admin", status="active").values_list("email", flat=True)
    for email in admins:
        send_email_on_commit(to=email, subject=subject, body=body)


def send_new_company_to_platform_admins(company):
    _to_each_platform_admin(
        f"New company awaiting review: {company.name}",
        f"{company.name} ({company.industry}) registered and is waiting for review.\n\n"
        f"Review it in the admin panel: {_link('/admin/companies')}\n",
    )


def send_company_resubmitted_to_platform_admins(company):
    _to_each_platform_admin(
        f"Company resubmitted for review: {company.name}",
        f"{company.name} corrected its registration and is waiting for review again.\n\n"
        f"Review it in the admin panel: {_link('/admin/companies')}\n",
    )


def send_company_approved_email(user, company):
    send_email_on_commit(
        to=user.email,
        subject=f"{company.name} has been approved on IntelliHire",
        body=(
            f"Hello {user.full_name},\n\n"
            f"{company.name} has been approved. You can now log in, complete your company "
            f"profile and invite your team:\n{_link('/login')}\n"
        ),
    )


def send_company_rejected_email(user, company):
    send_email_on_commit(
        to=user.email,
        subject=f"Your IntelliHire registration for {company.name} was not approved",
        body=(
            f"Hello {user.full_name},\n\n"
            f"The registration for {company.name} was not approved.\n\n"
            f"Reason: {company.rejection_reason}\n\n"
            f"You can correct your details and submit them again:\n{_link('/resubmit-company')}\n"
        ),
    )


def send_invitation_email(invitation, raw_token):
    from urllib.parse import urlencode

    link = _link("/accept-invite?" + urlencode({"token": raw_token}))
    send_email_on_commit(
        to=invitation.email,
        subject=f"You are invited to join {invitation.company.name} on IntelliHire",
        body=(
            f"Hello {invitation.full_name},\n\n"
            f"{invitation.company.name} invited you to join its IntelliHire team as "
            f"{ROLE_LABELS[invitation.role]}.\n\nAccept the invitation and set your password:\n{link}\n\n"
            f"The link expires on {invitation.expires_at:%d %B %Y} (UTC) and works once.\n"
        ),
    )

"""Emails the candidate gets about their applications. Links are credentials, so these emails are marked sensitive."""
from apps.common.mail import send_email_on_commit
from apps.Module4_ApplicationManagement.emails import tracking_url
from apps.Module7_Interviews.services.links import interview_url


def send_tracking_links(email, entries):
    """One email listing a fresh tracking link for every application made with this address. `entries`: (application, raw token)."""
    lines = "\n".join(
        f"- {application.job.title} at {application.job.company.name} (reference {application.reference}): {tracking_url(raw)}"
        for application, raw in entries
    )
    send_email_on_commit(
        to=email,
        subject="Your application tracking links",
        body=(
            "Hello,\n\nYou asked for the links to follow your applications. Here they are:\n\n"
            f"{lines}\n\nThese links are private and replace any earlier ones. If you did not ask for this, you can ignore this email.\n"
        ),
        kind="tracking_links",
        sensitive=True,
    )


def send_interview_reminder(session, raw_token):
    """48 hours before an unstarted interview expires: the deadline and a link that replaces the earlier one."""
    application = session.application
    deadline = session.expires_at.strftime("%d %B %Y, %H:%M UTC")
    send_email_on_commit(
        to=application.email,
        subject=f"Reminder: your {session.get_kind_display().lower()} interview for {session.role_title}",
        body=(
            f"Hello {application.full_name},\n\n"
            f"Your {session.get_kind_display().lower()} interview for {session.role_title} at {application.job.company.name} has not been started yet.\n"
            f"Please start before: {deadline}\n\nStart here: {interview_url(raw_token)}\n\n"
            "This link replaces the one in the earlier email. It is private, please do not share it.\n"
        ),
        kind="interview_reminder",
        sensitive=True,
        related=session,
    )

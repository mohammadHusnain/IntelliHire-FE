from django.conf import settings

from apps.common.mail import send_email_on_commit


def tracking_url(raw_token):
    return f"{settings.FRONTEND_URL.rstrip('/')}/track/{raw_token}"


def send_application_received(application, raw_tracking_token=""):
    """Confirmation to the applicant (FR-32, TC-21): job title, company, submission time and reference."""
    job = application.job
    submitted = application.submitted_at.strftime("%d %B %Y, %H:%M UTC")
    send_email_on_commit(
        to=application.email,
        subject=f"Application received: {job.title} at {job.company.name}",
        body=(
            f"Hello {application.full_name},\n\n"
            f"We received your application for {job.title} at {job.company.name}.\n\n"
            f"Reference: {application.reference}\n"
            f"Submitted: {submitted}\n\n"
            "Keep the reference number if you need to contact the company about your application.\n"
            + (
                f"\nFollow your application any time, no account needed: {tracking_url(raw_tracking_token)}\n"
                "This link is private. Please do not share it.\n"
                if raw_tracking_token
                else ""
            )
        ),
        kind="application_received",
        sensitive=bool(raw_tracking_token),
        related=application,
    )

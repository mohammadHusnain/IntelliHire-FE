from apps.common.mail import send_email_on_commit


def send_application_received(application):
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
        ),
    )

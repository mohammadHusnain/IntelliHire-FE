"""The candidate's decision email. Plain, respectful wording, never a score, a note or the name of an HR user.
Module 10 may refine the wording (P2-6); this keeps the rules it will inherit: no scores, neutral rejections."""
from apps.common.mail import send_email_on_commit

from ..models import Decision


def send_decision_email(application, decision):
    job, company = application.job, application.job.company.name
    lines = {
        Decision.SELECTED: (
            f"We are pleased to let you know that you have been selected for the {job.title} position at {company}. "
            "The recruiting team will contact you about the next steps."
        ),
        Decision.REJECTED: (
            f"Thank you for the time and care you put into your application for {job.title} at {company}. "
            "After careful consideration we have decided not to move forward with your application. "
            "We appreciate your interest and wish you every success."
        ),
        Decision.ON_HOLD: (
            f"Your application for {job.title} at {company} is on hold for now. "
            "We will be in touch as soon as there is an update."
        ),
    }
    subjects = {Decision.SELECTED: "Decision", Decision.REJECTED: "Decision", Decision.ON_HOLD: "Update"}
    send_email_on_commit(
        to=application.email,
        subject=f"{subjects[decision]} on your application: {job.title} at {company}",
        body=f"Hello {application.full_name},\n\n{lines[decision]}\n\nApplication reference: {application.reference}\n",
        kind="application_decision",
        related=application,
    )

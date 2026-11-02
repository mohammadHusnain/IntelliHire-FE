from apps.common.mail import send_email_on_commit


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

def send_email_on_commit(*, to, subject, body, html_body=None, kind="general", sensitive=False, related=None):
    """Queue an email for each recipient and send it after the surrounding transaction commits.

    A thin wrapper over the durable outbox (Module 5): the message is stored first, so a broker or SMTP outage
    delays it instead of losing it, and a rollback sends nothing. Delivery failures are logged and never raised.
    Mark emails that carry a credential link `sensitive=True` so their body is wiped after sending.
    """
    from apps.Module5_Foundation.outbox import send_email

    return send_email(to=to, subject=subject, body=body, html_body=html_body, kind=kind, sensitive=sensitive, related=related)

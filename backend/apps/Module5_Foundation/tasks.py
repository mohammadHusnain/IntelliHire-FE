import logging

from celery import shared_task

from . import alerts, outbox
from .locks import single_run

logger = logging.getLogger(__name__)


@shared_task(name="foundation.send_email")
def send_email_task(email_id):
    """Send one queued email. The claim inside `deliver` makes a redelivered task harmless."""
    try:
        return outbox.deliver(email_id)
    except Exception:
        logger.exception("Unexpected failure while sending an email")
        return "error"


@shared_task(name="foundation.retry_failed_emails")
def retry_failed_emails():
    with single_run("foundation.retry_failed_emails") as acquired:
        if acquired:
            return outbox.sweep()


@shared_task(name="foundation.purge_email_bodies")
def purge_email_bodies():
    with single_run("foundation.purge_email_bodies") as acquired:
        if acquired:
            return outbox.purge()


@shared_task(name="foundation.check_alerts")
def check_alerts():
    with single_run("foundation.check_alerts") as acquired:
        if acquired:
            alerts.check_alerts(evaluate_worker=False)


@shared_task(name="foundation.worker_heartbeat")
def worker_heartbeat():
    alerts.record_heartbeat()


@shared_task(name="foundation.close_expired_jobs")
def close_expired_jobs():
    from apps.Module3_JobPosting.services.lifecycle import close_expired_jobs as close

    with single_run("foundation.close_expired_jobs") as acquired:
        if acquired:
            return close()

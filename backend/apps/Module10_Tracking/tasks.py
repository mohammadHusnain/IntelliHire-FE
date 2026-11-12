from celery import shared_task

from apps.Module5_Foundation.locks import single_run

from .services import reminders


@shared_task(name="tracking.sweep")
def sweep():
    """Every 15 minutes: send the reminders that are due."""
    with single_run("tracking.sweep") as acquired:
        if acquired:
            return reminders.send_due()

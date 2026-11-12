from celery import shared_task

from apps.Module5_Foundation.locks import single_run

from .services import evaluation, lifecycle


@shared_task(name="interviews.evaluate_session")
def evaluate_session(session_id, rescore=False):
    return evaluation.evaluate(session_id, rescore)


@shared_task(name="interviews.sweep")
def sweep():
    """Every 5 minutes: idle sessions become interrupted, overdue links expire, stuck or due evaluations are re-queued."""
    with single_run("interviews.sweep") as acquired:
        if acquired:
            return {
                "interrupted": lifecycle.interrupt_idle(),
                "expired": lifecycle.expire_due(),
                "evaluations": evaluation.sweep(),
            }

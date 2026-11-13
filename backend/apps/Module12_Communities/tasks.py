from celery import shared_task

from apps.Module5_Foundation.locks import single_run

from .services import core, posts


@shared_task(name="communities.notify_batch")
def notify_batch(post_id):
    """Notify the next 50 members of a post, then schedule the next batch a few seconds later."""
    if posts.notify_next_batch(post_id):
        posts.queue_batch(post_id, delay=posts.BATCH_DELAY_SECONDS)


@shared_task(name="communities.sweep")
def sweep():
    """Every 15 minutes: expire old invitations and resume posts whose notification did not finish."""
    with single_run("communities.sweep") as acquired:
        if acquired:
            return {"expired": core.expire_due(), "resumed": posts.resume_unfinished()}

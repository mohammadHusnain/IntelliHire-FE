"""Posts, the member feed, responses and the batched notification of members (FR-70, TC-43)."""
import logging

from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.common.choices import UserStatus
from apps.common.errors import ApiError
from apps.common.mail import send_email_on_commit
from apps.Module5_Foundation.events import log_event
from apps.Module5_Foundation.notifications import notify_many

from ..models import CommunityMembership, CommunityPost, MembershipStatus, NotifyState, PostResponse, PostStatus
from . import core

logger = logging.getLogger(__name__)
BATCH_SIZE = 50
BATCH_DELAY_SECONDS = 5


def create(community, author, data, notify_members=False):
    if community.status == "removed":
        raise ApiError("This community was removed.", "community_removed", 409)
    post = CommunityPost.objects.create(
        community=community, author=author, notify_state=NotifyState.PENDING if notify_members else NotifyState.NONE, **data
    )
    log_event("community.post_created", actor=author, company=community.company_id, target=post, summary="Community post created", metadata={"kind": post.kind})
    if notify_members:
        queue_batch(post.pk)
    return post


def queue_batch(post_id, delay=0):
    """Hand the next batch to the worker after commit. A dead broker only delays it: the sweep resumes unfinished posts."""

    def send():
        from ..tasks import notify_batch

        try:
            notify_batch.apply_async(args=[str(post_id)], countdown=delay)
        except Exception:
            logger.warning("Could not queue a community post notification batch; the sweep will resume it", exc_info=True)

    transaction.on_commit(send)


def notify_next_batch(post_id):
    """Notify up to BATCH_SIZE more members (in-app and email), skipping suspended accounts, then move the cursor.

    Returns True when more members remain. The cursor lives on the post, so a crash repeats at most one batch's emails
    to nobody twice: the cursor only advances after the batch was handed to the outbox, in the same transaction.
    """
    with transaction.atomic():
        post = CommunityPost.objects.select_for_update().select_related("community__company").filter(pk=post_id, notify_state=NotifyState.PENDING).first()
        if post is None:
            return False
        community = post.community
        if post.status != PostStatus.PUBLISHED or not core.is_visible(community):
            CommunityPost.objects.filter(pk=post.pk).update(notify_state=NotifyState.DONE)
            return False
        batch = list(
            CommunityMembership.objects.filter(community=community, status=MembershipStatus.ACTIVE, pk__gt=post.notify_cursor).select_related("user").order_by("pk")[:BATCH_SIZE]
        )
        active = [m.user for m in batch if m.user.status == UserStatus.ACTIVE]
        notify_many([u.pk for u in active], "community_post", f"New in {community.name}: {post.title}", post.body[:200], link=core.candidate_link(community), payload={"community_id": str(community.pk), "post_id": str(post.pk)})
        for user in active:
            send_email_on_commit(
                to=user.email, subject=f"New in {community.name}: {post.title}",
                body=f"Hello {user.full_name},\n\n{community.company.name} posted in {community.name}:\n\n{post.title}\n{post.body[:500]}\n\nOpen your communities to read more or respond.\n", kind="community_post",
            )
        more = len(batch) == BATCH_SIZE
        CommunityPost.objects.filter(pk=post.pk).update(notify_cursor=batch[-1].pk if batch else post.notify_cursor, notify_state=NotifyState.PENDING if more else NotifyState.DONE)
    return more


def resume_unfinished():
    """Sweep: queue the next batch of every post whose notification did not finish."""
    ids = list(CommunityPost.objects.filter(notify_state=NotifyState.PENDING).values_list("pk", flat=True)[:100])
    for post_id in ids:
        queue_batch(post_id)
    return len(ids)


def is_closed(post):
    return bool(post.closes_at and post.closes_at <= timezone.now())


def respond(post, user, message=""):
    if is_closed(post):
        raise ApiError("This post is closed.", "post_closed", 409)
    try:
        with transaction.atomic():
            return PostResponse.objects.create(post=post, user=user, message=message[:500])
    except IntegrityError:
        raise ApiError("You already responded to this post.", "already_responded", 409) from None

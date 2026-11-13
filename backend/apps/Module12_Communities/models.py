import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower

from apps.common.constraints import enum_check


class JoinMode(models.TextChoices):
    REQUEST = "request", "Request to join"
    INVITE_ONLY = "invite_only", "Invite only"


class CommunityStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    ARCHIVED = "archived", "Archived"
    REMOVED = "removed", "Removed"


class SkillMode(models.TextChoices):
    ALL = "all", "All of the skills"
    ANY = "any", "Any of the skills"


class Community(models.Model):
    """A company's private talent pool (FR-64)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT, related_name="communities")
    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=170, unique=True)
    description = models.TextField()
    mission = models.CharField(max_length=500)
    join_mode = models.CharField(max_length=12, choices=JoinMode.choices, default=JoinMode.REQUEST)
    # An empty filter means "no restriction" for that field (FR-65).
    filter_universities = models.JSONField(default=list, blank=True)
    filter_degrees = models.JSONField(default=list, blank=True)
    filter_grad_year_from = models.PositiveSmallIntegerField(null=True, blank=True)
    filter_grad_year_to = models.PositiveSmallIntegerField(null=True, blank=True)
    filter_skills = models.JSONField(default=list, blank=True)
    filter_skill_mode = models.CharField(max_length=3, choices=SkillMode.choices, default=SkillMode.ANY)
    status = models.CharField(max_length=10, choices=CommunityStatus.choices, default=CommunityStatus.ACTIVE)
    removed_reason = models.CharField(max_length=500, blank=True)
    member_count = models.PositiveIntegerField(default=0)  # cached; changed in the same transaction as every membership change
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "communities"
        indexes = [models.Index(fields=["status", "join_mode"], name="community_discovery_idx")]
        constraints = [
            models.UniqueConstraint(Lower("name"), "company", name="community_name_unique_per_company"),
            enum_check("join_mode", JoinMode, "community_join_mode_valid"),
            enum_check("status", CommunityStatus, "community_status_valid"),
            enum_check("filter_skill_mode", SkillMode, "community_skill_mode_valid"),
            models.CheckConstraint(
                condition=Q(filter_grad_year_from__isnull=True) | Q(filter_grad_year_to__isnull=True) | Q(filter_grad_year_from__lte=models.F("filter_grad_year_to")),
                name="community_grad_years_in_order",
            ),
        ]

    def __str__(self):
        return self.name


class MembershipStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    REMOVED = "removed", "Removed"
    LEFT = "left", "Left"


class MembershipSource(models.TextChoices):
    INVITATION = "invitation", "Invitation"
    REQUEST = "request", "Request"


class CommunityMembership(models.Model):
    community = models.ForeignKey(Community, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="community_memberships")
    status = models.CharField(max_length=10, choices=MembershipStatus.choices, default=MembershipStatus.ACTIVE)
    source = models.CharField(max_length=12, choices=MembershipSource.choices)
    joined_at = models.DateTimeField(auto_now_add=True)
    removed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    removed_at = models.DateTimeField(null=True, blank=True)
    removed_reason = models.CharField(max_length=500, blank=True)

    class Meta:
        indexes = [models.Index(fields=["community", "status"], name="cmember_comm_status_idx")]
        constraints = [
            models.UniqueConstraint(fields=["community", "user"], name="membership_one_per_user"),
            enum_check("status", MembershipStatus, "membership_status_valid"),
            enum_check("source", MembershipSource, "membership_source_valid"),
        ]


class InvitationStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    ACCEPTED = "accepted", "Accepted"
    DECLINED = "declined", "Declined"
    EXPIRED = "expired", "Expired"
    REVOKED = "revoked", "Revoked"


class CommunityInvitation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    community = models.ForeignKey(Community, on_delete=models.CASCADE, related_name="invitations")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="community_invitations")
    invited_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    message = models.CharField(max_length=500, blank=True)
    status = models.CharField(max_length=10, choices=InvitationStatus.choices, default=InvitationStatus.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["status", "expires_at"], name="cinvite_status_expiry_idx")]
        constraints = [
            models.UniqueConstraint(fields=["community", "user"], condition=Q(status="pending"), name="cinvitation_one_pending"),
            enum_check("status", InvitationStatus, "cinvitation_status_valid"),
        ]


class RequestStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"
    AUTO_REJECTED = "auto_rejected", "Did not meet the requirements"


class CommunityJoinRequest(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    community = models.ForeignKey(Community, on_delete=models.CASCADE, related_name="join_requests")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="community_join_requests")
    message = models.CharField(max_length=500, blank=True)
    status = models.CharField(max_length=14, choices=RequestStatus.choices, default=RequestStatus.PENDING)
    eligibility = models.JSONField(default=dict, blank=True)  # snapshot of the filter check, with reasons
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    reviewed_at = models.DateTimeField(null=True, blank=True)
    decision_reason = models.CharField(max_length=500, blank=True)

    class Meta:
        indexes = [models.Index(fields=["community", "status"], name="cjoinreq_comm_status_idx")]
        constraints = [
            models.UniqueConstraint(fields=["community", "user"], condition=Q(status="pending"), name="cjoinrequest_one_pending"),
            enum_check("status", RequestStatus, "cjoinrequest_status_valid"),
        ]


class PostKind(models.TextChoices):
    INTERNSHIP = "internship", "Internship"
    JOB = "job", "Job"
    EVENT = "event", "Event"
    ANNOUNCEMENT = "announcement", "Announcement"


class PostStatus(models.TextChoices):
    PUBLISHED = "published", "Published"
    ARCHIVED = "archived", "Archived"


class NotifyState(models.TextChoices):
    NONE = "none", "Not requested"
    PENDING = "pending", "In progress"
    DONE = "done", "Done"


class CommunityPost(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    community = models.ForeignKey(Community, on_delete=models.CASCADE, related_name="posts")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    kind = models.CharField(max_length=14, choices=PostKind.choices)
    title = models.CharField(max_length=200)
    body = models.TextField()
    job = models.ForeignKey("jobs.JobPosting", on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    apply_url = models.URLField(max_length=500, blank=True)
    closes_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=PostStatus.choices, default=PostStatus.PUBLISHED)
    created_at = models.DateTimeField(auto_now_add=True)
    # Notifying members is background work that survives a restart: the row says how far it got.
    notify_state = models.CharField(max_length=8, choices=NotifyState.choices, default=NotifyState.NONE)
    notify_cursor = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["community", "status", "-created_at"], name="cpost_feed_idx"), models.Index(fields=["notify_state"], name="cpost_notify_idx")]
        constraints = [enum_check("kind", PostKind, "cpost_kind_valid"), enum_check("status", PostStatus, "cpost_status_valid"), enum_check("notify_state", NotifyState, "cpost_notify_valid")]


class PostResponse(models.Model):
    post = models.ForeignKey(CommunityPost, on_delete=models.CASCADE, related_name="responses")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    message = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["post", "user"], name="postresponse_one_per_user")]

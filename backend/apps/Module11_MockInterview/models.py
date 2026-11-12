import uuid

from django.db import models

from apps.common.constraints import enum_check


class InterviewType(models.TextChoices):
    GENERAL = "general", "General"
    ROLE_SPECIFIC = "role_specific", "Role specific"


class InterviewRole(models.Model):
    """The catalog behind FR-09: roles a candidate can practise for."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.SlugField(max_length=80, unique=True)
    title = models.CharField(max_length=120)
    category = models.CharField(max_length=60)
    description = models.CharField(max_length=300, blank=True)
    focus_skills = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "title"]
        indexes = [models.Index(fields=["is_active", "category"], name="mockrole_active_category_idx")]

    def __str__(self):
        return self.title


class MockInterviewSession(models.Model):
    """A mock interview is an InterviewSession (kind `mock`, no application) plus what only practice needs."""

    session = models.OneToOneField("interviews.InterviewSession", on_delete=models.CASCADE, related_name="mock")
    interview_type = models.CharField(max_length=15, choices=InterviewType.choices)
    # The title is snapshotted on the session, so a role removed from the catalog later changes nothing.
    target_role = models.ForeignKey(InterviewRole, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    use_cv = models.BooleanField(default=False)
    # False for a session ended before 3 answers: it does not use up the day's allowance.
    counts_toward_limit = models.BooleanField(default=True)
    # A deleted session keeps only this empty shell (no questions, answers, report or CV excerpt) so deleting
    # cannot be used to reset the daily limit. It is invisible everywhere else.
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [enum_check("interview_type", InterviewType, "mocksession_type_valid")]

    def __str__(self):
        return f"Mock interview {self.session_id}"

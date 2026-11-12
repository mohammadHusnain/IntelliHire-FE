"""Creating, ending, retrying and deleting mock interviews. Running one is the Module 7 engine, unchanged (FR-08 to FR-14)."""
from datetime import timedelta

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers

from apps.common.errors import ApiError, violated_constraint
from apps.Module1_Authentication.models import User
from apps.Module5_Foundation.ai.config import get_config
from apps.Module5_Foundation.events import log_event
from apps.Module5_Foundation.redact import redact_pii
from apps.Module7_Interviews.models import OPEN_STATUSES, InterviewSession, InterviewTurn, SessionStatus
from apps.Module7_Interviews.services import engine, links
from apps.Module7_Interviews.services.evaluation import queue_evaluation

from ..models import InterviewType, MockInterviewSession
from . import history

OPEN_MOCK_CONSTRAINT = "interview_one_open_mock_per_user"
GENERAL_TITLE = "General practice"


class OpenSessionExists(Exception):
    def __init__(self, session_id):
        self.session_id = session_id


class DailyLimitReached(Exception):
    def __init__(self, resets_at):
        self.resets_at = resets_at


def day_start(now=None):
    now = now or timezone.now()
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def default_question_count():
    return min(settings.MOCK_MAX_QUESTIONS, max(settings.MOCK_MIN_QUESTIONS, get_config().mock_questions))


def _used_today(user, now):
    return MockInterviewSession.objects.filter(
        session__candidate_user=user, session__kind="mock", session__invited_at__gte=day_start(now), counts_toward_limit=True
    ).count()


def _context(user, role, interview_type, use_cv):
    profile = getattr(user, "candidate_profile", None)
    excerpt = ""
    if use_cv:
        text = (profile.resume_text if profile else "") or ""
        if not text.strip():
            raise ApiError("Upload your CV first, or choose a practice without it.", "cv_missing", 400)
        excerpt = redact_pii(text[: settings.MOCK_CV_EXCERPT_CHARS], [user.full_name])
    skills = list(role.focus_skills) if role else []
    return {
        "job_title": role.title if role else GENERAL_TITLE, "role_category": role.category if role else "", "interview_type": interview_type,
        "focus_skills": skills, "required_skills": skills, "cv_excerpt": excerpt,
    }  # fmt: skip


def create(user, *, interview_type, role=None, use_cv=False, question_count=None):
    """Start a practice session. Raises OpenSessionExists (409), DailyLimitReached (429) or an ApiError (400 CV missing)."""
    if interview_type == InterviewType.ROLE_SPECIFIC and role is None:
        raise serializers.ValidationError({"role_id": ["Choose a role for a role-specific interview."]})
    count = default_question_count() if question_count is None else question_count
    if not settings.MOCK_MIN_QUESTIONS <= count <= settings.MOCK_MAX_QUESTIONS:
        raise serializers.ValidationError({"question_count": [f"Choose between {settings.MOCK_MIN_QUESTIONS} and {settings.MOCK_MAX_QUESTIONS} questions."]})
    now = timezone.now()
    try:
        with transaction.atomic():
            User.objects.select_for_update().get(pk=user.pk)  # one create at a time per candidate: the limit is counted under this lock
            open_ = InterviewSession.objects.filter(kind="mock", candidate_user=user, status__in=OPEN_STATUSES, mock__deleted_at__isnull=True).first()
            if open_:
                raise OpenSessionExists(open_.pk)
            if _used_today(user, now) >= settings.MOCK_SESSIONS_PER_DAY:
                raise DailyLimitReached(day_start(now) + timedelta(days=1))
            context = _context(user, role if interview_type == InterviewType.ROLE_SPECIFIC else None, interview_type, use_cv)
            session = InterviewSession.objects.create(
                kind="mock", application=None, candidate_user=user, created_by=user, token_hash=links.hash_token(links.new_token()),
                role_title=context["job_title"], context=context, question_target=count,
                expires_at=now + timedelta(days=settings.INTERVIEW_LINK_VALID_DAYS),
            )  # the hash is random and never revealed: a mock session has no public link
            MockInterviewSession.objects.create(
                session=session, interview_type=interview_type, target_role=role if interview_type == InterviewType.ROLE_SPECIFIC else None, use_cv=use_cv
            )
    except IntegrityError as exc:
        if violated_constraint(exc) == OPEN_MOCK_CONSTRAINT:
            raise OpenSessionExists(None) from None
        raise
    return history.mine(user).get(pk=session.pk)


def end(session):
    """The candidate ends the session. At least 3 answers: it is finished with partial feedback. Fewer: it is cancelled
    and does not count towards the daily limit (UC-02 A2)."""
    if session.status in (SessionStatus.CANCELLED, SessionStatus.EXPIRED):
        raise ApiError("This session is already closed.", "session_closed", 409)
    if session.status in OPEN_STATUSES and engine.answered_count(session) < settings.INTERVIEW_MIN_ANSWERS_TO_FINISH:
        with transaction.atomic():
            won = InterviewSession.objects.filter(pk=session.pk, status__in=OPEN_STATUSES).update(status=SessionStatus.CANCELLED)
            if won:
                MockInterviewSession.objects.filter(session=session).update(counts_toward_limit=False)
    else:
        engine.finish_early(session)
    return history.mine(session.candidate_user).get(pk=session.pk)


def retry_feedback(session):
    """Run the feedback again after a failure (UC-03 EX-01)."""
    with transaction.atomic():
        locked = InterviewSession.objects.select_for_update().get(pk=session.pk)
        if locked.status != SessionStatus.EVALUATION_FAILED:
            raise ApiError("Feedback has not failed for this session.", "not_failed", 409)
        finished_early = engine.answered_count(locked) < locked.question_target
        locked.status = SessionStatus.INCOMPLETE if finished_early else SessionStatus.COMPLETED
        locked.evaluation_attempts, locked.next_evaluation_at = 0, timezone.now()
        locked.save(update_fields=["status", "evaluation_attempts", "next_evaluation_at"])
        queue_evaluation(locked.pk)


def delete(session, user):
    """Delete the transcript and everything derived from it (privacy). The session keeps an empty shell that only counts
    towards the day's allowance; nothing of what was said survives, and the event keeps no content."""
    with transaction.atomic():
        InterviewTurn.objects.filter(session=session).delete()
        InterviewSession.objects.filter(pk=session.pk).update(
            context={}, report={}, overall_score=None, recommendation=None,
            status=SessionStatus.CANCELLED if session.status in OPEN_STATUSES else session.status,
        )  # fmt: skip
        MockInterviewSession.objects.filter(session=session).update(deleted_at=timezone.now())
        log_event("mock_interview.deleted", actor=user, target_type="interviewsession", target_id=session.pk, summary="A mock interview was deleted")

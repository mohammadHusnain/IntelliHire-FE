"""Reads one CV into fields, scores it against its job and moves the application forward.

Durable like the email outbox: the `queued` row is the source of truth, a claim (`queued` to `processing`) makes
a second worker skip, and the sweep re-queues anything that got stuck. AI calls happen outside any transaction.
"""
import datetime
import logging
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.db import transaction
from django.db.models import Count, F
from django.utils import timezone

from apps.common.choices import CompanyStatus, MemberRole, UserStatus
from apps.Module1_Authentication.resume import extract_resume_text
from apps.Module2_CompanyManagement.models import CompanyMember
from apps.Module4_ApplicationManagement.models import ApplicationStatus
from apps.Module4_ApplicationManagement.services.review import set_status_if
from apps.Module5_Foundation.ai import llm
from apps.Module5_Foundation.ai.config import get_config
from apps.Module5_Foundation.ai.errors import AIError, AIInvalidOutput, AIPolicyBlocked, AIUnavailable
from apps.Module5_Foundation.ai.prompts import wrap_untrusted
from apps.Module5_Foundation.events import log_event
from apps.Module5_Foundation.notifications import notify_many
from apps.Module5_Foundation.redact import redact_pii
from apps.Module5_Foundation.sanitize import clean_text

from ..models import AnalysisStatus, CVAnalysis, CVMatch, JobScreeningConfig
from ..signals import screening_completed
from . import scoring
from .config import config_for, job_vector

logger = logging.getLogger(__name__)

PENDING = (AnalysisStatus.QUEUED, AnalysisStatus.PROCESSING)
SWEEP_LIMIT = 100
REASON_UNREADABLE = "Scanned or unreadable CV"
REASON_NO_FILE = "The CV file could not be read"
REASON_POLICY = "The CV could not be processed automatically"
REASON_AI_DOWN = "The AI service was unavailable"
REASON_AI_SETUP = "The AI service is not set up correctly"
REASON_UNEXPECTED = "Unexpected error during analysis"
REASON_PAUSED = "Waiting: the company is not active"
REASON_CAPPED = "Waiting: the daily analysis limit was reached"
NOTIFY_ROLES = (MemberRole.ADMIN, MemberRole.HR_MANAGER, MemberRole.RECRUITER)


# --- Queueing ---------------------------------------------------------------------------------------------------
def enqueue(application_ids):
    """Hand analyses to the worker. A dead broker only delays them: the sweep picks queued rows up later."""
    from ..tasks import analyse_cv

    for application_id in application_ids:
        try:
            analyse_cv.delay(str(application_id))
        except Exception:
            logger.warning("Could not queue a CV analysis; the sweep will retry it", exc_info=True)


def queue_analysis(application):
    """Create (or reset) the application's analysis as queued and start it after the transaction commits.

    Returns False when an analysis is being processed right now and so cannot be restarted.
    """
    now = timezone.now()
    fresh = {
        "status": AnalysisStatus.QUEUED, "attempts": 0, "next_attempt_at": now, "claimed_at": None, "failure_reason": "",
    }  # fmt: skip
    with transaction.atomic():
        created = CVAnalysis.objects.get_or_create(application=application, defaults=fresh)[1]
        if not created:
            changed = CVAnalysis.objects.filter(application=application).exclude(status=AnalysisStatus.PROCESSING).update(**fresh)
            if not changed:
                return False
        JobScreeningConfig.objects.filter(job_id=application.job_id).update(completion_notified_at=None)
    application_id = application.pk
    transaction.on_commit(lambda: enqueue([application_id]))
    return True


# --- Small state changes ----------------------------------------------------------------------------------------
def _finish(analysis, **fields):
    """Write the outcome only if this run still owns the row (a reset in between wins)."""
    return CVAnalysis.objects.filter(pk=analysis.pk, status=AnalysisStatus.PROCESSING).update(claimed_at=None, **fields)


def _requeue(analysis, *, at, reason, count_attempt=True):
    fields = {"status": AnalysisStatus.QUEUED, "next_attempt_at": at, "failure_reason": reason}
    if not count_attempt:
        fields["attempts"] = F("attempts") - 1
    _finish(analysis, **fields)


def _retry_or_fail(analysis, reason):
    if analysis.attempts >= settings.CV_ANALYSIS_MAX_ATTEMPTS:
        return _fail(analysis, reason)
    _requeue(analysis, at=timezone.now() + timedelta(minutes=settings.CV_ANALYSIS_RETRY_MINUTES), reason=reason)
    return "retry"


def _fail(analysis, reason):
    _finish(analysis, status=AnalysisStatus.FAILED, failure_reason=reason, analysed_at=timezone.now())
    _event(analysis.application, "failed")
    check_completion(analysis.application.job)
    return "failed"


def _manual_review(analysis, reason, text_chars=0):
    application = analysis.application
    if _finish(analysis, status=AnalysisStatus.MANUAL_REVIEW, failure_reason=reason, analysed_at=timezone.now(), text_chars=text_chars):
        set_status_if(
            application.pk, expected=ApplicationStatus.SUBMITTED, new_status=ApplicationStatus.UNDER_REVIEW,
            note="Automatic: the CV needs a manual review",
        )  # fmt: skip
        _event(application, "manual_review")
        check_completion(application.job)
    return "manual_review"


def _event(application, outcome, score=None):
    metadata = {"outcome": outcome, "reference": application.reference}
    if score is not None:
        metadata["score"] = float(score)
    log_event(
        "cv.analysed", company=application.job.company_id, target=application,
        summary=f"CV analysis finished: {outcome}", metadata=metadata,
    )  # fmt: skip


# --- Reading the CV ---------------------------------------------------------------------------------------------
def _read_text(application):
    with application.resume.open("rb") as handle:
        return extract_resume_text(handle, Path(application.resume.name).suffix.lower())


def _strings(values, limit, length):
    seen, out = set(), []
    for value in values if isinstance(values, list) else []:
        text = clean_text(value, length)
        key = text.lower()
        if text and key not in seen and not text.startswith("["):
            seen.add(key)
            out.append(text)
        if len(out) >= limit:
            break
    return out


def _entries(values, limit, text_fields, keep):
    out = []
    for value in values if isinstance(values, list) else []:
        if not isinstance(value, dict):
            continue
        entry = {key: value.get(key) for key in keep if key in value}
        for key in text_fields:
            if key in value:
                entry[key] = clean_text(value.get(key), 600)
        out.append(entry)
        if len(out) >= limit:
            break
    return out


def clean_parsed(raw):
    """The model's answer, tidied: plain strings, no duplicates, sensible sizes. Shape was already validated."""
    return {
        "technical_skills": _strings(raw.get("technical_skills"), 200, 100),
        "soft_skills": _strings(raw.get("soft_skills"), 60, 100),
        "education": _entries(raw.get("education"), 15, ("degree", "institution"), ("year", "level", "completed")),
        "experience": _entries(raw.get("experience"), 30, ("company", "role", "summary"), ("start", "end", "is_current")),
        "projects": _entries(raw.get("projects"), 30, ("name", "summary"), ()),
        "achievements": _strings(raw.get("achievements"), 30, 600),
        "total_experience_years": raw.get("total_experience_years") or 0,
    }


def _flags(parsed, application):
    flags = []
    declared = scoring.LEVEL_INDEX.get(application.education_level, 0)
    if parsed.get("education") and scoring.LEVEL_INDEX[scoring.highest_level(parsed["education"])] < declared:
        flags.append("education_mismatch")
    if len(parsed.get("technical_skills") or []) > settings.CV_SKILL_LIST_SUSPICIOUS:
        flags.append("long_skill_list")
    return flags


# --- The run ----------------------------------------------------------------------------------------------------
def _over_daily_limit(company_id):
    limit = settings.CV_ANALYSIS_DAILY_LIMIT
    if not limit:
        return False
    today = timezone.now().date()
    done = CVAnalysis.objects.filter(
        application__job__company_id=company_id, status=AnalysisStatus.COMPLETED, analysed_at__date=today
    ).count()
    return done >= limit


def _next_midnight():
    tomorrow = timezone.now().date() + timedelta(days=1)
    return datetime.datetime.combine(tomorrow, datetime.time(0, 5), tzinfo=datetime.timezone.utc)


def analyse(application_id):
    """Analyse one queued CV. Safe to call twice at once: only the caller that claims the row works."""
    claimed = CVAnalysis.objects.filter(application_id=application_id, status=AnalysisStatus.QUEUED).update(
        status=AnalysisStatus.PROCESSING, claimed_at=timezone.now(), attempts=F("attempts") + 1
    )
    if not claimed:
        return "skipped"
    analysis = CVAnalysis.objects.select_related("application__job__company").get(application_id=application_id)
    try:
        return _run(analysis)
    except Exception:
        logger.exception("Unexpected failure while analysing a CV")
        return _fail(analysis, REASON_UNEXPECTED)


def _run(analysis):
    application = analysis.application
    job = application.job
    if job.company.status != CompanyStatus.APPROVED:
        _requeue(analysis, at=timezone.now() + timedelta(hours=1), reason=REASON_PAUSED, count_attempt=False)
        return "paused"
    if _over_daily_limit(job.company_id):
        _requeue(analysis, at=_next_midnight(), reason=REASON_CAPPED, count_attempt=False)
        return "capped"

    try:
        text = _read_text(application)
    except (OSError, ValueError):
        return _manual_review(analysis, REASON_NO_FILE)
    if len(text) < settings.CV_MIN_TEXT_CHARS:
        return _manual_review(analysis, REASON_UNREADABLE, text_chars=len(text))

    config = config_for(job)
    redacted = redact_pii(text, [application.full_name])
    try:
        raw = llm.generate_json("cv_extract", {"cv_text": wrap_untrusted("cv", redacted)}, related=application)
        parsed = clean_parsed(raw)
        (cv_vector,) = llm.embed([scoring.cv_scoring_text(parsed)], related=application)
        values = scoring.compute(parsed, job, config.weights, cv_vector, job_vector(job, config))
    except AIPolicyBlocked:
        return _manual_review(analysis, REASON_POLICY, text_chars=len(text))
    except (AIUnavailable, AIInvalidOutput):
        return _retry_or_fail(analysis, REASON_AI_DOWN)
    except AIError:
        return _fail(analysis, REASON_AI_SETUP)

    with transaction.atomic():
        saved = _finish(
            analysis, status=AnalysisStatus.COMPLETED, parsed=parsed, flags=_flags(parsed, application), text_chars=len(text),
            embedding=cv_vector, embedding_model=get_config().embed_model, parser_version=settings.CV_PARSER_VERSION,
            failure_reason="", analysed_at=timezone.now(),
        )  # fmt: skip
        if not saved:
            return "superseded"
        CVMatch.objects.update_or_create(application=application, defaults={**values, "explanation": "", "computed_at": timezone.now()})
    _explain(application, values)
    _after_scoring(application, config, values["score"])
    _event(application, "completed", values["score"])
    check_completion(job)
    return "completed"


def _explain(application, values):
    """Two or three sentences for HR, written from the numbers. Optional: the match stands without it."""
    facts = {
        "overall_score": float(values["score"]),
        "skills_score": float(values["skills_score"]),
        "experience_score": float(values["experience_score"]),
        "education_score": float(values["education_score"]),
        "semantic_score": float(values["semantic_score"]),
        "matched_skills": values["matched_skills"],
        "missing_skills": values["missing_skills"],
        "experience_years": float(values["experience_years"]),
        "required_experience_years": application.job.min_experience_years or 0,
        "required_education_level": application.job.education_level,
    }
    try:
        answer = llm.generate_json("cv_explain", {"facts": facts}, related=application)
    except AIError:
        return
    CVMatch.objects.filter(application=application).update(explanation=clean_text(answer["explanation"], 700, multiline=True))


def _after_scoring(application, config, score):
    """The only automatic moves: submitted to under_review, and to shortlisted when HR switched that on."""
    set_status_if(
        application.pk, expected=ApplicationStatus.SUBMITTED, new_status=ApplicationStatus.UNDER_REVIEW,
        note=f"Automatic: CV match {score:.0f}%",
    )  # fmt: skip
    if config.auto_shortlist and score >= config.shortlist_threshold:
        set_status_if(
            application.pk, expected=ApplicationStatus.UNDER_REVIEW, new_status=ApplicationStatus.SHORTLISTED,
            note=f"Automatic: CV match {score:.0f}% meets the {config.shortlist_threshold}% threshold",
        )  # fmt: skip


# --- Re-scoring (no re-reading of the CV) -----------------------------------------------------------------------
def rescore(application_id):
    """Recompute the match of an already analysed CV against the job as it is now. Returns whether it was scored."""
    analysis = (
        CVAnalysis.objects.select_related("application__job__company")
        .filter(application_id=application_id, status=AnalysisStatus.COMPLETED)
        .first()
    )
    if analysis is None:
        return False
    application, job = analysis.application, analysis.application.job
    config = config_for(job)
    cv_vector = analysis.embedding
    if analysis.embedding_model != get_config().embed_model:
        (cv_vector,) = llm.embed([scoring.cv_scoring_text(analysis.parsed)], related=application)
        CVAnalysis.objects.filter(pk=analysis.pk).update(embedding=cv_vector, embedding_model=get_config().embed_model)
    values = scoring.compute(analysis.parsed, job, config.weights, cv_vector, job_vector(job, config))
    CVMatch.objects.update_or_create(application=application, defaults={**values, "explanation": "", "computed_at": timezone.now()})
    _after_scoring(application, config, values["score"])
    return True


def rescore_job(job_id):
    """Re-score every analysed CV of a job; stops quietly if the AI service (embeddings) is unavailable."""
    done = 0
    ids = CVAnalysis.objects.filter(application__job_id=job_id, status=AnalysisStatus.COMPLETED).values_list("application_id", flat=True)
    for application_id in list(ids):
        try:
            done += bool(rescore(application_id))
        except AIError:
            logger.warning("Re-scoring stopped: the AI service is unavailable")
            break
    return done


# --- Completion notice ------------------------------------------------------------------------------------------
def summary_of(job):
    counts = {status: 0 for status in AnalysisStatus.values}
    rows = CVAnalysis.objects.filter(application__job=job).values("status").annotate(total=Count("pk"))
    counts.update({row["status"]: row["total"] for row in rows})
    return counts


def check_completion(job):
    """Tell the hiring team once when a job's screening has nothing left to do.

    Applies after HR started a run, or when the job no longer accepts applications.
    """
    config = config_for(job)
    if CVAnalysis.objects.filter(application__job=job, status__in=PENDING).exists():
        return False
    if config.run_requested_at is None and job.is_accepting_applications:
        return False
    claimed = JobScreeningConfig.objects.filter(pk=config.pk, completion_notified_at__isnull=True).update(
        completion_notified_at=timezone.now(), run_requested_at=None
    )
    if not claimed:
        return False
    counts = summary_of(job)
    users = CompanyMember.objects.filter(
        company_id=job.company_id, is_active=True, role__in=NOTIFY_ROLES, user__status=UserStatus.ACTIVE
    ).values_list("user_id", flat=True)
    body = f"{counts['completed']} CV(s) scored."
    if counts["manual_review"]:
        body += f" {counts['manual_review']} need a manual review."
    if counts["failed"]:
        body += f" {counts['failed']} could not be analysed."
    notify_many(
        list(users), "cv_screening_done", f"CV screening finished: {job.title}", body,
        link=f"/company/jobs/{job.pk}/candidates", payload={"job_id": str(job.pk), "counts": counts},
    )  # fmt: skip
    screening_completed.send_robust(sender=JobScreeningConfig, job=job, summary=counts)
    return True


# --- Sweep ------------------------------------------------------------------------------------------------------
def sweep():
    """Free analyses stuck mid-run, then queue every analysis that is due. Returns (reset, queued)."""
    now = timezone.now()
    reset = CVAnalysis.objects.filter(
        status=AnalysisStatus.PROCESSING, claimed_at__lte=now - timedelta(minutes=settings.CV_ANALYSIS_STALE_MINUTES)
    ).update(status=AnalysisStatus.QUEUED, claimed_at=None, next_attempt_at=now)
    due = list(
        CVAnalysis.objects.filter(status=AnalysisStatus.QUEUED, next_attempt_at__lte=now)
        .order_by("next_attempt_at")
        .values_list("application_id", flat=True)[:SWEEP_LIMIT]
    )
    enqueue(due)
    return reset, len(due)


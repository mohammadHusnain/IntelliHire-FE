"""The AI-assisted evaluation report (FR-53, FR-54): one model call over structured facts, checked by code.

The model gets numbers and short texts, never a name, an email or any identifying text. The recommendation that is
stored is the code's band unless the model was at most one band more cautious (composite.guard). Durable: the row is
the source of truth, a compare-and-set claim makes duplicate tasks harmless, and the sweep re-queues anything due.
"""
import logging
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import F, Q
from django.utils import timezone

from apps.common.choices import MemberRole, UserStatus
from apps.Module2_CompanyManagement.models import CompanyMember
from apps.Module5_Foundation.ai import llm
from apps.Module5_Foundation.ai.errors import AIError
from apps.Module5_Foundation.events import log_event
from apps.Module5_Foundation.notifications import notify_many
from apps.Module5_Foundation.redact import redact_pii

from ..models import CandidateEvaluation, ReportStatus
from . import composite as composite_rules
from .scores import cv_match_of, latest_evaluated

logger = logging.getLogger(__name__)
DISCLAIMER = "AI-assisted summary to support, not replace, a hiring decision."
NOTIFY_ROLES = (MemberRole.ADMIN, MemberRole.HR_MANAGER, MemberRole.RECRUITER)
SWEEP_LIMIT = 50


# --- Queueing ---------------------------------------------------------------------------------------------------
def queue_task(application_id):
    """Hand the report to the worker after commit. A dead broker only delays it: the sweep re-queues."""

    def send():
        from ..tasks import generate_report

        try:
            generate_report.delay(str(application_id))
        except Exception:
            logger.warning("Could not queue an evaluation report; the sweep will retry it", exc_info=True)

    transaction.on_commit(send)


def request_report(application_id):
    """Mark the report as generating (scores stay visible) and queue it. False when nothing exists to report on or one is running."""
    now = timezone.now()
    won = CandidateEvaluation.objects.filter(application_id=application_id).exclude(
        Q(report_status=ReportStatus.GENERATING) & Q(report_claimed_at__isnull=False)
    ).update(report_status=ReportStatus.GENERATING, report_attempts=0, next_report_at=now)
    if won:
        queue_task(application_id)
    return bool(won)


# --- The facts the model sees (and the ones it must never see) --------------------------------------------------
def _clean(text, application):
    return redact_pii(str(text or "")[:600], [application.full_name])


def build_facts(application, evaluation):
    job = application.job
    match = cv_match_of(application)
    screening, technical = latest_evaluated(application, "screening"), latest_evaluated(application, "technical")
    facts = {
        "job": {
            "title": job.title, "required_skills": list(job.required_skills or []),
            "min_experience_years": job.min_experience_years or 0, "required_education_level": job.education_level,
        },
        "scores": {
            "cv": _num(evaluation.cv_score), "screening": _num(evaluation.screening_score),
            "technical": _num(evaluation.technical_score), "composite": _num(evaluation.composite_score),
            "missing_stages": list(evaluation.missing_stages),
        },
        "cv": {"matched_skills": match.matched_skills, "missing_skills": match.missing_skills, "experience_years": float(match.experience_years)} if match else None,
        "screening": {"summary": _clean(screening.report.get("summary"), application)} if screening else None,
        "technical": None,
    }  # fmt: skip
    if technical:
        facts["technical"] = {
            "technical_relevance": technical.report.get("technical_relevance", ""),
            "questions": [
                {"index": q.get("index"), "score": q.get("score"), "comment": _clean(q.get("comment"), application)}
                for q in technical.report.get("questions", [])[:20]
            ],
        }
    return facts


def _num(value):
    return None if value is None else float(value)


def _stage_summaries(application):
    match = cv_match_of(application)
    screening, technical = latest_evaluated(application, "screening"), latest_evaluated(application, "technical")
    return {
        "cv": match.explanation if match else "",
        "screening": screening.report.get("summary", "") if screening else "",
        "technical": technical.report.get("summary", "") if technical else "",
    }


# --- Generating -------------------------------------------------------------------------------------------------
def _claim(application_id):
    now = timezone.now()
    stale = now - timedelta(minutes=settings.EVALUATION_REPORT_STALE_MINUTES)
    won = CandidateEvaluation.objects.filter(application_id=application_id, report_status=ReportStatus.GENERATING).filter(
        Q(report_claimed_at__isnull=True) | Q(report_claimed_at__lte=stale)
    ).update(report_claimed_at=now, report_attempts=F("report_attempts") + 1)
    return bool(won)


def generate(application_id):
    """Returns "ready", "failed" or "skipped" (someone else has it, or it was not requested)."""
    if not _claim(application_id):
        return "skipped"
    evaluation = CandidateEvaluation.objects.select_related("application__job", "application__cv_match").get(application_id=application_id)
    application, composite = evaluation.application, evaluation.composite_score
    try:
        answer = llm.generate_json("evaluation_report", {"facts": build_facts(application, evaluation)}, related=application)
    except AIError as exc:
        logger.warning("Evaluation report failed: %s", type(exc).__name__)
        return _fail(evaluation)
    report = {
        "summary": answer["summary"], "strengths": answer["strengths"], "weaknesses": answer["weaknesses"],
        "recommendation": composite_rules.guard(answer["recommendation"], composite),
        "stage_summaries": _stage_summaries(application), "ai_disclaimer": DISCLAIMER,
    }  # fmt: skip
    now = timezone.now()
    # Only if the scores did not move while the model was thinking; otherwise run again on the new numbers.
    won = CandidateEvaluation.objects.filter(pk=evaluation.pk, report_status=ReportStatus.GENERATING, composite_score=composite).update(
        report=report, report_status=ReportStatus.READY, generated_at=now, report_claimed_at=None, next_report_at=None
    )
    if not won:
        CandidateEvaluation.objects.filter(pk=evaluation.pk, report_status=ReportStatus.GENERATING).update(report_claimed_at=None, next_report_at=now)
        return "skipped"
    _announce(application)
    return "ready"


def _fail(evaluation):
    attempts = CandidateEvaluation.objects.filter(pk=evaluation.pk).values_list("report_attempts", flat=True).first() or 0
    final = attempts >= settings.EVALUATION_REPORT_MAX_ATTEMPTS
    CandidateEvaluation.objects.filter(pk=evaluation.pk, report_status=ReportStatus.GENERATING).update(
        report_status=ReportStatus.FAILED, report_claimed_at=None,
        next_report_at=None if final else timezone.now() + timedelta(minutes=settings.EVALUATION_REPORT_RETRY_MINUTES),
    )  # fmt: skip
    if final:
        _notify(evaluation.application, "evaluation_report_failed", "Report generation failed, manual review needed", "The scores are available; you can retry the report.")
    return "failed"


def _notify(application, kind, title, body):
    users = CompanyMember.objects.filter(
        company_id=application.job.company_id, is_active=True, role__in=NOTIFY_ROLES, user__status=UserStatus.ACTIVE
    ).values_list("user_id", flat=True)
    notify_many(
        list(users), kind, title, body, link=f"/company/candidates/{application.pk}",
        payload={"application_id": str(application.pk), "job_id": str(application.job_id)},
    )  # fmt: skip


def _announce(application):
    log_event(
        "evaluation.generated", company=application.job.company_id, target=application, summary="Evaluation report generated",
        metadata={"reference": application.reference},
    )  # fmt: skip
    _notify(application, "evaluation_ready", "Evaluation report ready", f"A report for {application.reference} is ready to review.")


def sweep():
    """Free reports stuck mid-run and queue every one that is due. Returns (reset, queued)."""
    now = timezone.now()
    reset = CandidateEvaluation.objects.filter(
        report_status=ReportStatus.GENERATING, report_claimed_at__lte=now - timedelta(minutes=settings.EVALUATION_REPORT_STALE_MINUTES)
    ).update(report_claimed_at=None, next_report_at=now)
    due = list(
        CandidateEvaluation.objects.filter(report_status__in=[ReportStatus.GENERATING, ReportStatus.FAILED], next_report_at__lte=now)
        .order_by("next_report_at")
        .values_list("application_id", flat=True)[:SWEEP_LIMIT]
    )
    CandidateEvaluation.objects.filter(application_id__in=due, report_status=ReportStatus.FAILED).update(report_status=ReportStatus.GENERATING)
    for application_id in due:
        queue_task(application_id)
    return reset, len(due)

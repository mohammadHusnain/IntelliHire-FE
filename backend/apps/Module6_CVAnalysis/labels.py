from .models import DEFAULT_THRESHOLD, AnalysisStatus

LABELS = {
    "shortlisted": "Shortlisted",
    "meets_threshold": "Meets threshold",
    "not_shortlisted": "Not shortlisted",
    "manual_review": "Manual review required",
    "analysing": "Analysing",
    "failed": "Analysis failed",
}


def cv_label(application):
    """The CV screening label HR sees (FR-40), or None when the CV has not been looked at.

    Reads only relations the list queries already join, so it never costs a query per row.
    """
    analysis = getattr(application, "cv_analysis", None)
    match = getattr(application, "cv_match", None)
    if analysis is None and match is None:
        return None
    if application.status == "shortlisted":
        return "shortlisted"
    if match is not None and (analysis is None or analysis.status == AnalysisStatus.COMPLETED):
        config = getattr(application.job, "screening_config", None)
        threshold = config.shortlist_threshold if config else DEFAULT_THRESHOLD
        return "meets_threshold" if match.score >= threshold else "not_shortlisted"
    if analysis.status == AnalysisStatus.MANUAL_REVIEW:
        return "manual_review"
    if analysis.status == AnalysisStatus.FAILED:
        return "failed"
    return "analysing"

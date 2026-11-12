"""The snapshot an interview is built from, taken once at invite time. It never holds contact details."""
from apps.Module5_Foundation.redact import redact_pii

DESCRIPTION_MAX = 4000


def seniority_band(min_experience_years):
    """junior up to 1 year, mid up to 4, senior from 5 (Module 8 may refine this)."""
    years = min_experience_years or 0
    return "junior" if years <= 1 else "mid" if years <= 4 else "senior"


def _cv_summary(application):
    analysis = getattr(application, "cv_analysis", None)
    if analysis is None or analysis.status != "completed" or not analysis.parsed:
        return {}
    parsed, names = analysis.parsed, [application.full_name]
    return {
        "technical_skills": [str(s)[:60] for s in (parsed.get("technical_skills") or [])[:30]],
        "soft_skills": [str(s)[:60] for s in (parsed.get("soft_skills") or [])[:15]],
        "education": [
            {"degree": str(e.get("degree", ""))[:100], "level": e.get("level", "")} for e in (parsed.get("education") or [])[:5]
        ],
        "experience": [
            {"role": str(e.get("role", ""))[:100], "summary": redact_pii(str(e.get("summary", ""))[:400], names)}
            for e in (parsed.get("experience") or [])[:8]
        ],
        "total_experience_years": parsed.get("total_experience_years") or 0,
    }


def build_context(application):
    job = application.job
    return {
        "job_title": job.title,
        "company_name": job.company.name,
        "description": (job.description or "")[:DESCRIPTION_MAX],
        "required_skills": [str(s)[:60] for s in (job.required_skills or [])[:40]],
        "min_experience_years": job.min_experience_years or 0,
        "seniority_band": seniority_band(job.min_experience_years),
        "cv_summary": _cv_summary(application),
    }

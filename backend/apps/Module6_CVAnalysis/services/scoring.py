"""Every number in the CV match is calculated here, in plain code: no model is ever asked for a score."""
import datetime
import hashlib
import json
import re
from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings

from apps.Module3_JobPosting.models import EducationLevel
from apps.Module5_Foundation.ai.vectors import cosine_similarity

LEVELS = [EducationLevel.NONE, EducationLevel.INTERMEDIATE, EducationLevel.BACHELOR, EducationLevel.MASTER, EducationLevel.PHD]
LEVEL_INDEX = {level.value: index for index, level in enumerate(LEVELS)}

# Different spellings of one skill. Keys and values are already normalised (lowercase, no punctuation noise).
ALIASES = {
    "js": "javascript", "es6": "javascript", "ecmascript": "javascript",
    "ts": "typescript",
    "reactjs": "react", "react.js": "react", "react js": "react",
    "nodejs": "node.js", "node": "node.js", "node js": "node.js",
    "vuejs": "vue", "vue.js": "vue", "vue js": "vue",
    "angularjs": "angular", "nextjs": "next.js", "next js": "next.js", "expressjs": "express", "express.js": "express",
    "py": "python", "python3": "python", "python 3": "python",
    "postgres": "postgresql", "postgre": "postgresql", "psql": "postgresql",
    "mongo": "mongodb", "mongo db": "mongodb",
    "ms sql": "sql server", "mssql": "sql server", "microsoft sql server": "sql server",
    "k8s": "kubernetes", "gcp": "google cloud", "google cloud platform": "google cloud",
    "aws": "amazon web services", "ml": "machine learning", "ai": "artificial intelligence",
    "dl": "deep learning", "nlp": "natural language processing",
    "drf": "django rest framework", "django rest": "django rest framework",
    "c sharp": "c#", "csharp": "c#", "cpp": "c++", "golang": "go", "dotnet": ".net", "dot net": ".net",
    "tailwind": "tailwind css", "tailwindcss": "tailwind css", "html5": "html", "css3": "css",
    "rest api": "rest", "rest apis": "rest", "restful": "rest", "restful api": "rest", "restful apis": "rest",
    "ci cd": "ci/cd", "cicd": "ci/cd", "github actions": "github actions", "oop": "object oriented programming",
    "object-oriented programming": "object oriented programming", "ms excel": "excel", "microsoft excel": "excel",
    "powerbi": "power bi", "scikit learn": "scikit-learn", "sklearn": "scikit-learn", "tf": "tensorflow",
}  # fmt: skip

_SPACES = re.compile(r"\s+")
_EDGES = re.compile(r"^[\s\-_,;:.()\[\]{}\"'/|]+|[\s\-_,;:()\[\]{}\"'/|]+$")
_DATE = re.compile(r"^(\d{4})(?:[-/.](\d{1,2}))?")


def round2(value):
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def normalise_skill(skill):
    """One canonical spelling per skill: lowercase, tidy spacing and edges, known aliases folded together."""
    text = _SPACES.sub(" ", str(skill or "").lower()).strip()
    text = _EDGES.sub("", text)
    if text.endswith(".") and text not in (".net",):
        text = text.rstrip(".")
    return ALIASES.get(text, text)


def skills_part(cv_skills, required_skills):
    """(score, matched, missing): required skills found in the CV divided by required skills, times 100.

    A job that requires nothing scores 100. Matched and missing keep the job's own spelling.
    """
    have = {normalise_skill(skill) for skill in cv_skills or []} - {""}
    matched, missing, seen = [], [], set()
    for skill in required_skills or []:
        key = normalise_skill(skill)
        if not key or key in seen:
            continue
        seen.add(key)
        (matched if key in have else missing).append(skill)
    total = len(matched) + len(missing)
    return (100.0 if total == 0 else 100.0 * len(matched) / total), matched, missing


def _month(value, default_month):
    match = _DATE.match(str(value or "").strip())
    if not match:
        return None
    year, month = int(match.group(1)), int(match.group(2) or default_month)
    if not (1950 <= year <= 2100 and 1 <= month <= 12):
        return None
    return year * 12 + (month - 1)


def experience_years(experience, fallback_years=None, today=None):
    """Years of work from the dated entries, counting overlapping periods once.

    A start without a month counts from January and an end without one to December. An open or "current" role
    runs to this month. Future dates are cut at this month. With no usable dates the CV's own stated total is
    used instead (limited to 0 to 50).
    """
    today = today or datetime.date.today()
    now = today.year * 12 + today.month  # exclusive end: the current month counts in full
    spans = []
    for entry in experience or []:
        if not isinstance(entry, dict):
            continue
        start = _month(entry.get("start"), 1)
        if start is None:
            continue
        end_raw = entry.get("end")
        if entry.get("is_current") or not end_raw or str(end_raw).strip().lower() in ("present", "current", "now", "ongoing"):
            end = now
        else:
            end = _month(end_raw, 12)
            if end is None:
                continue
            end += 1
        start, end = min(start, now), min(end, now)
        if end > start:
            spans.append((start, end))
    if not spans:
        try:
            return max(0.0, min(float(fallback_years or 0), 50.0))
        except (TypeError, ValueError):
            return 0.0
    spans.sort()
    months, (current_start, current_end) = 0, spans[0]
    for start, end in spans[1:]:
        if start <= current_end:
            current_end = max(current_end, end)
        else:
            months += current_end - current_start
            current_start, current_end = start, end
    months += current_end - current_start
    return min(round(months / 12, 1), 50.0)


def experience_part(years, minimum_years):
    if not minimum_years:
        return 100.0
    return 100.0 * min(1.0, max(float(years), 0.0) / float(minimum_years))


def highest_level(education):
    """The highest education level the CV supports. A degree still in progress counts as one level below."""
    best = 0
    for entry in education or []:
        if not isinstance(entry, dict):
            continue
        index = LEVEL_INDEX.get(str(entry.get("level") or "").lower())
        if index is None:
            continue
        if entry.get("completed") is False:
            index = max(index - 1, 0)
        best = max(best, index)
    return LEVELS[best].value


def education_part(cv_level, required_level):
    """100 when the CV meets the job's level, 50 when it is one level below, otherwise 0."""
    need = LEVEL_INDEX.get(required_level, 0)
    have = LEVEL_INDEX.get(cv_level, 0)
    if need == 0 or have >= need:
        return 100.0
    return 50.0 if need - have == 1 else 0.0


def semantic_part(cv_vector, job_vector):
    """Cosine similarity rescaled so CV_SEMANTIC_LOW maps to 0 and CV_SEMANTIC_HIGH to 100."""
    if not cv_vector or not job_vector:
        return 0.0
    low, high = settings.CV_SEMANTIC_LOW, settings.CV_SEMANTIC_HIGH
    value = (cosine_similarity(cv_vector, job_vector) - low) / (high - low) * 100.0
    return max(0.0, min(value, 100.0))


def weighted_total(parts, weights):
    return sum(parts[name] * weights[name] for name in ("skills", "experience", "education", "semantic")) / 100.0


def cv_scoring_text(parsed):
    """The text the semantic part compares with the job: what the person can do and has done.

    Names, institutions and employers are left out on purpose, so where someone studied or worked cannot
    raise or lower the score.
    """
    lines = []
    if parsed.get("technical_skills"):
        lines.append("Skills: " + ", ".join(map(str, parsed["technical_skills"])))
    for entry in parsed.get("experience") or []:
        if isinstance(entry, dict):
            lines.append(" ".join(filter(None, [str(entry.get("role") or ""), str(entry.get("summary") or "")])))
    for entry in parsed.get("projects") or []:
        if isinstance(entry, dict):
            lines.append(" ".join(filter(None, [str(entry.get("name") or ""), str(entry.get("summary") or "")])))
    for entry in parsed.get("education") or []:
        if isinstance(entry, dict) and entry.get("degree"):
            lines.append(str(entry["degree"]))
    return "\n".join(line for line in lines if line.strip())


def job_scoring_text(job):
    parts = [job.title, ", ".join(job.required_skills or []), job.description, job.responsibilities]
    return "\n".join(part for part in parts if part)


def job_signature(job, weights):
    """Fingerprint of everything on the job that a score depends on."""
    payload = {
        "skills": sorted({normalise_skill(skill) for skill in job.required_skills or []}),
        "min_years": job.min_experience_years or 0,
        "level": job.education_level,
        "text": hashlib.sha256(job_scoring_text(job).encode()).hexdigest(),
        "weights": weights,
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


def compute(parsed, job, weights, cv_vector, job_vector, today=None):
    """All parts of a match from the parsed CV, as plain values ready to store."""
    skills, matched, missing = skills_part(parsed.get("technical_skills"), job.required_skills)
    years = experience_years(parsed.get("experience"), parsed.get("total_experience_years"), today=today)
    parts = {
        "skills": skills,
        "experience": experience_part(years, job.min_experience_years),
        "education": education_part(highest_level(parsed.get("education")), job.education_level),
        "semantic": semantic_part(cv_vector, job_vector),
    }
    return {
        "score": round2(weighted_total(parts, weights)),
        "skills_score": round2(parts["skills"]),
        "experience_score": round2(parts["experience"]),
        "education_score": round2(parts["education"]),
        "semantic_score": round2(parts["semantic"]),
        "matched_skills": matched,
        "missing_skills": missing,
        "experience_years": Decimal(str(years)),
        "weights_used": dict(weights),
        "job_signature": job_signature(job, weights),
    }

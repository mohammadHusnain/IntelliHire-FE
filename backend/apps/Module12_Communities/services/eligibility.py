"""One function decides who fits a community's filters (FR-65): discovery badges, join requests and invitation previews all use it."""
from datetime import date


def _lower(values):
    return [str(v).strip().lower() for v in (values or []) if str(v).strip()]


def check_eligibility(user, community):
    """Returns {"eligible": bool, "reasons": [plain words]} from the candidate's profile. An empty filter restricts nothing."""
    profile = getattr(user, "candidate_profile", None)
    education = list(profile.education.all()) if profile else []
    skills = {s.lower() for s in _lower(profile.skills)} if profile else set()
    reasons = []

    universities = _lower(community.filter_universities)
    if universities and not any(u in e.institution.lower() for e in education for u in universities):
        reasons.append("Requires education at: " + ", ".join(community.filter_universities) + ".")

    degrees = _lower(community.filter_degrees)
    if degrees and not any(d in f"{e.degree} {e.field_of_study}".lower() for e in education for d in degrees):
        reasons.append("Requires a degree or field matching: " + ", ".join(community.filter_degrees) + ".")

    start, end = community.filter_grad_year_from, community.filter_grad_year_to
    if start is not None or end is not None:
        this_year = date.today().year
        years = [e.end_year or this_year for e in education]  # an ongoing degree counts as the current year
        if not any((start is None or y >= start) and (end is None or y <= end) for y in years):
            if start is not None and end is not None:
                reasons.append(f"Requires graduation between {start} and {end}.")
            elif start is not None:
                reasons.append(f"Requires graduation in {start} or later.")
            else:
                reasons.append(f"Requires graduation in {end} or earlier.")

    required = _lower(community.filter_skills)
    if required:
        have = [s for s in required if s in skills]
        ok = len(have) == len(required) if community.filter_skill_mode == "all" else bool(have)
        if not ok:
            word = "all of" if community.filter_skill_mode == "all" else "at least one of"
            reasons.append(f"Requires {word} these skills: " + ", ".join(community.filter_skills) + ".")
    return {"eligible": not reasons, "reasons": reasons}

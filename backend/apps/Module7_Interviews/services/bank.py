"""Choosing a question from the bank: the source until the LLM hook is merged, and the fallback afterwards. No LLM."""
import random

from ..models import InterviewQuestionBank
from ..rubrics import FOCUS_AREAS

# Checked in this order, so "Data Engineer" is a data role and "Product Manager" is not an engineer.
ROLE_CATEGORIES = (
    ("product_manager", ("product",)),
    ("data_analyst", ("data", "analyst", "analytics", "business intelligence")),
    ("software_engineer", ("software", "developer", "engineer", "backend", "frontend", "full stack", "fullstack", "programmer")),
)  # fmt: skip


class NoQuestionAvailable(Exception):
    """The bank has nothing unused left for this interview."""


def category_for(role_title):
    title = (role_title or "").lower()
    for category, words in ROLE_CATEGORIES:
        if any(word in title for word in words):
            return category
    return ""


def _focus(session, turns, hint):
    if hint.get("focus_area"):
        return hint["focus_area"]
    areas = FOCUS_AREAS.get(session.kind)
    return areas[len(turns) % len(areas)] if areas else None


def pick(session, turns, hint=None):
    """An unused question: this role's first, then general; the wanted competency first, then any.

    A technical interview prefers the questions that share the most skills with the job. Raises NoQuestionAvailable.
    """
    hint = hint or {}
    asked = {turn.question_text for turn in turns}
    avoid = set(hint.get("avoid_topics") or [])
    focus = _focus(session, turns, hint)
    category = category_for(session.role_title)
    wanted = {str(s).lower() for s in session.context.get("required_skills", []) if s}
    if hint.get("focus_topic"):
        wanted = {str(hint["focus_topic"]).lower()}  # a technical interview asked to cover one skill next
    difficulty = hint.get("difficulty")
    base = InterviewQuestionBank.objects.filter(kind=session.kind, is_active=True).exclude(text__in=asked)

    tiers = [(category, focus), (category, None)] if category else []
    tiers += [("", focus), ("", None)]
    # Avoided topics are skipped everywhere first; only if that leaves nothing are they allowed back.
    for honour_avoid in (True, False):
        for tier_category, competency in tiers:
            candidates = base.filter(role_category=tier_category)
            if competency:
                candidates = candidates.filter(competency=competency)
            candidates = [q for q in candidates[:300] if not (honour_avoid and q.competency in avoid)]
            if not candidates:
                continue
            if session.kind == "technical" and wanted:
                overlap = {q.pk: len(wanted & {str(s).lower() for s in q.skills}) for q in candidates}
                best = max(overlap.values())
                candidates = [q for q in candidates if overlap[q.pk] == best]
            if difficulty:
                suited = [q for q in candidates if q.difficulty == difficulty]
                candidates = suited or candidates
            question = random.choice(candidates)
            matched = [s for s in question.skills if str(s).lower() in wanted] or list(question.skills[:1])
            return {
                "question_text": question.text, "competency": question.competency, "topic": matched[0] if matched else question.competency,
                "difficulty": question.difficulty, "is_follow_up": False, "from_bank": True, "bank_id": question.pk,
            }  # fmt: skip
    raise NoQuestionAvailable()

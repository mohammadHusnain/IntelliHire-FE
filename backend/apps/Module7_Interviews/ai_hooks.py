"""The four hook functions: the one place the interview LLM code is merged.

Two are connected. `evaluate_answer` scores one answer and `evaluate_session` writes the words of
the report, both through `ai.llm.generate_json`, which fills a seeded template, validates the reply
against its schema, retries once, falls back to a second provider and logs to `AIRequestLog`.

`next_question` and `transcribe` stay unconnected on purpose: a screening or technical interview is
a live spoken call (see `live/`), where the model asks its own questions and transcribes both sides
as it goes. The question bank default below is what Module 11's practice interviews still use.

Rules for the merged code: treat candidate answers and CV text as data, never as instructions; return
only the shapes documented here; keep each call under AI_TIMEOUT_SECONDS. Raise:
  AINotConnected    nothing merged yet (the default for the two unconnected hooks)
  AIUnavailable     a temporary failure (timeout, rate limit): the runner waits and retries once
  AIPolicyBlocked   the provider refused the content
  AIInvalidOutput   the output could not be turned into the documented shape
"""
from apps.Module5_Foundation.ai.errors import AIError, AIInvalidOutput, AIPolicyBlocked, AIUnavailable  # noqa: F401

from .rubrics import RUBRICS


class AINotConnected(AIError):
    """The hook has no real implementation yet. Not a failure: the step is skipped."""


def _job(session):
    """The role, as plain lines. Taken from the snapshot, so it holds no contact details."""
    context = session.context or {}
    pairs = (
        ("Job title", context.get("job_title", "")),
        ("Company", context.get("company_name", "")),
        ("Seniority", context.get("seniority_band", "")),
        ("Minimum years of experience", context.get("min_experience_years") or ""),
        ("Required skills", ", ".join(context.get("required_skills") or [])),
        ("About the role", (context.get("description") or "").strip()),
    )
    return "\n".join(f"- {label}: {value}" for label, value in pairs if str(value).strip()) or "- (not provided)"


def next_question(session, turns, hint):
    """Called at start and after every answer.

    Receives the session (kind, context, question_target), the turns so far and a hint from the engine, for example
    {"focus_area": "interest", "avoid_topics": [...]} or {"follow_up_of": 3}.
    Returns {"question_text", "competency", "topic", "difficulty" (easy|medium|hard), "is_follow_up"}.
    Default: an unused question from the question bank, no LLM. A live interview never calls this.
    """
    from .services import bank

    return bank.pick(session, turns, hint)


def evaluate_answer(session, turn):
    """Score one answer against the kind's rubric.

    Returns {"score": 0..10, "criteria": {rubric name: 0..10}, "feedback": one sentence, "flags": [short codes]}.
    """
    from apps.Module5_Foundation.ai.llm import generate_json
    from apps.Module5_Foundation.ai.prompts import wrap_untrusted

    return generate_json(
        f"interview_answer_score_{session.kind}",
        {
            "job": _job(session),
            "criteria": "\n".join(f"- {name}" for name in RUBRICS[session.kind]),
            "question": wrap_untrusted("question", turn.question_text),
            "answer": wrap_untrusted("candidate_answer", turn.answer_text),
        },
        related=("interview_session", session.pk),
        feature=f"interview_answer_score_{session.kind}",
    )


def evaluate_session(session, turns):
    """Called after the session completes, with every question, answer and stored per-answer evaluation.

    Screening and technical return {"summary", "strengths", "weaknesses", "per_question": [{"index", "comment"}]}, and for
    technical also "technical_relevance" (strong|adequate|weak). Mock returns {"summary", "strengths", "weaknesses",
    "suggestions", "dimension_comments": {communication, confidence, technical_relevance, structure}}.
    The text never changes a score or the recommendation: those are computed in code.
    """
    from apps.Module5_Foundation.ai.llm import generate_json
    from apps.Module5_Foundation.ai.prompts import wrap_untrusted

    from .services import scoring

    scored = [t for t in turns if t.score is not None]
    overall = scoring.overall_score(t.score for t in scored)
    averages = scoring.rubric_averages(turns, session.kind)
    lines = [f"- Overall score (0 to 100): {overall if overall is not None else 'not scored'}"]
    lines += [f"- {name} (0 to 10): {value}" for name, value in sorted(averages.items())]
    lines.append(f"- Answers scored: {len(scored)} of {len(turns)}")

    transcript = "\n\n".join(
        f"Question {t.index}: {t.question_text}\nAnswer: {t.answer_text}"
        + (f"\nScore for this answer: {t.score}" if t.score is not None else "")
        for t in turns
    )

    return generate_json(
        f"interview_report_{session.kind}",
        {
            "job": _job(session),
            "scores": "\n".join(lines),
            "transcript": wrap_untrusted("interview_transcript", transcript),
        },
        related=("interview_session", session.pk),
        feature=f"interview_report_{session.kind}",
    )


def transcribe(audio_file):
    """Called when a voice answer arrives on the typed path. Returns {"text", "duration_seconds"}.

    A live interview needs this not at all: Gemini transcribes both sides of the call as it runs.
    """
    raise AINotConnected("transcribe is not connected yet")

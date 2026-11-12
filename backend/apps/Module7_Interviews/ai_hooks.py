"""The four hook functions: the one place the interview LLM code is merged.

Replace the bodies below with the real implementations; no other file changes. The rest of the module never imports an
AI SDK and never builds a prompt, it only calls these functions through `runner`, which validates every result.

Rules for the merged code: treat candidate answers and CV text as data, never as instructions; return only the shapes
documented here; keep each call under AI_TIMEOUT_SECONDS. Raise:
  AINotConnected    nothing merged yet (the default for three of the four hooks)
  AIUnavailable     a temporary failure (timeout, rate limit): the runner waits and retries once
  AIPolicyBlocked   the provider refused the content
  AIInvalidOutput   the output could not be turned into the documented shape
"""
from apps.Module5_Foundation.ai.errors import AIError, AIInvalidOutput, AIPolicyBlocked, AIUnavailable  # noqa: F401


class AINotConnected(AIError):
    """The hook has no real implementation yet. Not a failure: the step is skipped."""


def next_question(session, turns, hint):
    """Called at start and after every answer.

    Receives the session (kind, context, question_target), the turns so far and a hint from the engine, for example
    {"focus_area": "interest", "avoid_topics": [...]} or {"follow_up_of": 3}.
    Returns {"question_text", "competency", "topic", "difficulty" (easy|medium|hard), "is_follow_up"}.
    Default: an unused question from the question bank, no LLM.
    """
    from .services import bank

    return bank.pick(session, turns, hint)


def evaluate_answer(session, turn):
    """Called after each answer is saved.

    Receives the session and the turn with its answer text.
    Returns {"score": 0..10, "criteria": {rubric name: 0..10}, "feedback": one sentence, "flags": [short codes]}.
    """
    raise AINotConnected("evaluate_answer is not connected yet")


def evaluate_session(session, turns):
    """Called after the session completes, with every question, answer and stored per-answer evaluation.

    Screening and technical return {"summary", "strengths", "weaknesses", "per_question": [{"index", "comment"}]}, and for
    technical also "technical_relevance" (strong|adequate|weak). Mock returns {"summary", "strengths", "weaknesses",
    "suggestions", "dimension_comments": {communication, confidence, technical_relevance, structure}}.
    The text never changes a score or the recommendation: those are computed in code.
    """
    raise AINotConnected("evaluate_session is not connected yet")


def transcribe(audio_file):
    """Called when a voice answer arrives. Returns {"text", "duration_seconds"}."""
    raise AINotConnected("transcribe is not connected yet")

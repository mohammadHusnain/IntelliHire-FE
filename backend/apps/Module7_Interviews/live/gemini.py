"""The only place the Gemini Live SDK is imported.

A live interview is a bidirectional audio stream, so it cannot go through `ai.llm.generate_json`
(which takes a template in and returns validated JSON). This module is the documented exception:
it opens the stream and records the call in `AIRequestLog`, so Module 13's AI report still sees it.
"""
import logging

from django.conf import settings

logger = logging.getLogger(__name__)

INPUT_MIME = f"audio/pcm;rate={settings.LIVE_INPUT_SAMPLE_RATE}"


class LiveUnavailable(RuntimeError):
    """The provider could not be reached or refused the session."""


def _client():
    from google import genai  # imported lazily so the package is only needed where live calls run

    if not settings.GEMINI_API_KEY:
        raise LiveUnavailable("GEMINI_API_KEY is not set.")
    return genai.Client(api_key=settings.GEMINI_API_KEY, http_options={"api_version": "v1beta"})


def audio_blob(data):
    from google.genai import types

    return types.Blob(data=data, mime_type=INPUT_MIME)


def connect(system_prompt):
    """An async context manager yielding a live session, configured exactly as the reference app is."""
    config = {
        "response_modalities": ["AUDIO"],
        "system_instruction": system_prompt,
        "input_audio_transcription": {},
        "output_audio_transcription": {},
    }
    return _client().aio.live.connect(model=settings.GEMINI_LIVE_MODEL, config=config)


def log_call(session, *, status, seconds, error=""):
    """One AIRequestLog row per live call, so usage and failures appear in the AI report."""
    from apps.Module5_Foundation.models import AIRequestLog

    try:
        AIRequestLog.objects.create(
            feature=f"interview_live_{session.kind}",
            provider="gemini",
            model=settings.GEMINI_LIVE_MODEL,
            status=status,
            attempts=1,
            latency_ms=int(max(0, seconds) * 1000),
            error=str(error)[:300],
            related_type="interview_session",
            related_id=session.pk,
        )
    except Exception:  # logging must never break an interview
        logger.warning("Could not write the live AI request log", exc_info=True)

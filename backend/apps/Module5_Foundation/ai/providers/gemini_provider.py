"""Gemini adapter. Maps every SDK failure onto the project's own errors so callers never see SDK types.

This is the request/response provider used for scoring and reports. The live interview's audio stream
is a different thing entirely and lives in `Module7_Interviews/live/gemini.py`.
"""
from django.conf import settings

from ..errors import AIConfigurationError, AIPolicyBlocked, AIUnavailable
from .base import ChatResult, EmbedResult, Provider, TranscribeResult

# Substrings in a provider error that mean "refused the content" rather than "failed".
POLICY_MARKERS = ("safety", "blocked", "prohibited", "content policy", "recitation")
# ...and the ones that mean "try again later".
TRANSIENT_MARKERS = ("rate limit", "resource exhausted", "quota", "unavailable", "deadline", "timeout", "500", "502", "503", "504")


def _looks_like(markers, text):
    lowered = text.lower()
    return any(marker in lowered for marker in markers)


class GeminiProvider(Provider):
    name = "gemini"

    def __init__(self, client=None):
        self._injected = client

    def _client(self):
        if self._injected is not None:
            return self._injected
        if not settings.GEMINI_API_KEY:
            raise AIConfigurationError("GEMINI_API_KEY is not set.")
        from google import genai

        return genai.Client(api_key=settings.GEMINI_API_KEY)

    @staticmethod
    def _call(func, **kwargs):
        """Run an SDK call and translate whatever it raises.

        The SDK's exception classes move between versions, so the decision is made on the error text
        and on an HTTP status when one is attached, not on the class name.
        """
        try:
            return func(**kwargs)
        except Exception as exc:
            message = str(exc)
            status = getattr(exc, "code", None) or getattr(exc, "status_code", None)
            if _looks_like(POLICY_MARKERS, message):
                raise AIPolicyBlocked("The AI provider refused this content.") from exc
            if status in (401, 403) or "api key" in message.lower() or "permission" in message.lower():
                raise AIConfigurationError("The AI provider rejected the credentials.") from exc
            if status in (429, 500, 502, 503, 504) or _looks_like(TRANSIENT_MARKERS, message):
                raise AIUnavailable("The AI provider is unavailable.") from exc
            if status == 400:
                raise AIConfigurationError("The AI provider rejected the request.") from exc
            raise AIUnavailable("The AI provider failed.") from exc

    def chat(self, *, system, user, model, temperature, max_tokens, timeout, schema=None):
        from google.genai import types

        config = types.GenerateContentConfig(
            system_instruction=system,
            temperature=temperature,
            max_output_tokens=max_tokens,
            response_mime_type="application/json",
            http_options=types.HttpOptions(timeout=int(timeout * 1000)),
        )
        response = self._call(self._client().models.generate_content, model=model, contents=user, config=config)

        feedback = getattr(response, "prompt_feedback", None)
        if getattr(feedback, "block_reason", None):
            raise AIPolicyBlocked("The AI provider refused this content.")
        candidates = getattr(response, "candidates", None) or []
        if candidates and str(getattr(candidates[0], "finish_reason", "")).upper().endswith("SAFETY"):
            raise AIPolicyBlocked("The AI provider filtered its own answer.")

        usage = getattr(response, "usage_metadata", None)
        return ChatResult(
            text=getattr(response, "text", "") or "",
            prompt_tokens=getattr(usage, "prompt_token_count", 0) or 0,
            completion_tokens=getattr(usage, "candidates_token_count", 0) or 0,
        )

    def embed(self, texts, *, model, timeout):
        from google.genai import types

        response = self._call(
            self._client().models.embed_content,
            model=model,
            contents=list(texts),
            config=types.EmbedContentConfig(http_options=types.HttpOptions(timeout=int(timeout * 1000))),
        )
        vectors = [list(item.values) for item in (getattr(response, "embeddings", None) or [])]
        return EmbedResult(vectors=vectors, tokens=0)

    def transcribe(self, file, *, model, timeout):
        raise AIConfigurationError("Gemini transcription is not connected; the live interview transcribes its own audio.")

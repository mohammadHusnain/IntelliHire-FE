"""OpenAI adapter. Maps every SDK failure onto the project's own errors so callers never see SDK types."""
import openai

from django.conf import settings

from ..errors import AIConfigurationError, AIPolicyBlocked, AIUnavailable
from .base import ChatResult, EmbedResult, Provider, TranscribeResult

POLICY_CODES = {"content_policy_violation", "content_filter", "invalid_prompt"}


def _retry_after(exc):
    try:
        value = exc.response.headers.get("retry-after")
        return float(value) if value is not None else None
    except (AttributeError, TypeError, ValueError):
        return None


def _error_code(exc):
    body = getattr(exc, "body", None)
    if isinstance(body, dict):
        body = body.get("error", body)
        return str(body.get("code") or body.get("type") or "")
    return str(getattr(exc, "code", "") or "")


class OpenAIProvider(Provider):
    name = "openai"

    def __init__(self, client=None):
        self._injected = client

    def _client(self, timeout):
        if self._injected is not None:
            return self._injected
        if not settings.OPENAI_API_KEY:
            raise AIConfigurationError("OPENAI_API_KEY is not set.")
        return openai.OpenAI(api_key=settings.OPENAI_API_KEY, timeout=timeout, max_retries=0)

    @staticmethod
    def _call(func, **kwargs):
        try:
            return func(**kwargs)
        except openai.RateLimitError as exc:
            raise AIUnavailable("The AI provider is rate limiting requests.", retry_after=_retry_after(exc)) from exc
        except (openai.APITimeoutError, openai.APIConnectionError) as exc:
            raise AIUnavailable("The AI provider did not answer in time.") from exc
        except (openai.AuthenticationError, openai.PermissionDeniedError) as exc:
            raise AIConfigurationError("The AI provider rejected the credentials.") from exc
        except openai.BadRequestError as exc:
            if _error_code(exc) in POLICY_CODES:
                raise AIPolicyBlocked("The AI provider refused this content.") from exc
            raise AIConfigurationError(f"The AI provider rejected the request ({_error_code(exc) or 'bad request'}).") from exc
        except openai.APIStatusError as exc:
            if exc.status_code >= 500 or exc.status_code == 429:
                raise AIUnavailable(f"The AI provider failed ({exc.status_code}).", retry_after=_retry_after(exc)) from exc
            raise AIConfigurationError(f"The AI provider rejected the request ({exc.status_code}).") from exc

    def chat(self, *, system, user, model, temperature, max_tokens, timeout, schema=None):
        client = self._client(timeout)
        response = self._call(
            client.chat.completions.create,
            model=model,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            temperature=temperature,
            max_completion_tokens=max_tokens,
            response_format={"type": "json_object"},
            timeout=timeout,
        )
        choice = response.choices[0]
        if choice.finish_reason == "content_filter":
            raise AIPolicyBlocked("The AI provider filtered its own answer.")
        usage = getattr(response, "usage", None)
        return ChatResult(
            text=choice.message.content or "",
            prompt_tokens=getattr(usage, "prompt_tokens", 0) or 0,
            completion_tokens=getattr(usage, "completion_tokens", 0) or 0,
        )

    def embed(self, texts, *, model, timeout):
        client = self._client(timeout)
        response = self._call(client.embeddings.create, model=model, input=list(texts), timeout=timeout)
        vectors = [item.embedding for item in sorted(response.data, key=lambda item: item.index)]
        return EmbedResult(vectors=vectors, tokens=getattr(getattr(response, "usage", None), "total_tokens", 0) or 0)

    def transcribe(self, file, *, model, timeout):
        client = self._client(timeout)
        response = self._call(
            client.audio.transcriptions.create, model=model, file=file, response_format="verbose_json", timeout=timeout
        )
        return TranscribeResult(text=(getattr(response, "text", "") or "").strip(), duration_seconds=float(getattr(response, "duration", 0) or 0))

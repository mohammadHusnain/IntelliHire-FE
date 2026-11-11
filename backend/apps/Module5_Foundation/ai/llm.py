"""The only door to an AI provider: templates in, validated JSON (or vectors, or text) out.

One AIRequestLog row is written per call (never the prompt or the content). Callers should not hold a long database
transaction open around these calls: a rolled-back transaction would also roll back the log row.
"""
import hashlib
import json
import logging
import re
import threading
import time
from collections import OrderedDict

import jsonschema
from django.db import transaction

from ..models import AIRequestLog, AIRequestStatus
from .config import get_config
from .errors import (
    AIConfigurationError,
    AIError,
    AIInvalidOutput,
    AIPolicyBlocked,
    AIUnavailable,
    TranscriptionFailed,
)
from .prompts import active_template, render
from .providers import get_provider

logger = logging.getLogger(__name__)

_sleep = time.sleep  # replaced in tests
MAX_RETRY_WAIT = 30
EMBED_BATCH = 96
EMBED_TEXT_CHARS = 8000
CACHE_SIZE = 512
_FENCE = re.compile(r"^\s*```(?:json)?\s*(.*?)\s*```\s*$", re.DOTALL | re.IGNORECASE)
_embed_cache, _embed_lock = OrderedDict(), threading.Lock()


def _related(related):
    if related is None:
        return "", None
    if isinstance(related, tuple):
        return related
    return related._meta.model_name, getattr(related, "pk", None)


def _log(*, feature, provider, model, status, attempts, started, tokens=(0, 0), error="", related=None):
    related_type, related_id = _related(related)
    try:
        with transaction.atomic():
            AIRequestLog.objects.create(
                feature=feature[:60], provider=provider, model=model or "", status=status, attempts=attempts,
                prompt_tokens=tokens[0], completion_tokens=tokens[1], latency_ms=int((time.monotonic() - started) * 1000),
                error=error[:300], related_type=related_type, related_id=related_id,
            )  # fmt: skip
    except Exception:
        logger.exception("Could not record an AI request")


def _wait(exc, config):
    delay = float(config.retry_delay_seconds)
    retry_after = getattr(exc, "retry_after", None)
    if retry_after:
        delay = max(delay, min(float(retry_after), MAX_RETRY_WAIT))
    if delay > 0:
        _sleep(delay)


def _parse(text, schema):
    match = _FENCE.match(text or "")
    raw = match.group(1) if match else (text or "")
    try:
        data = json.loads(raw)
    except ValueError as exc:
        raise AIInvalidOutput("The reply was not valid JSON.") from exc
    if not isinstance(data, dict):
        raise AIInvalidOutput("The reply was not a JSON object.")
    if schema:
        errors = sorted(jsonschema.Draft202012Validator(schema).iter_errors(data), key=lambda e: list(map(str, e.absolute_path)))
        if errors:
            # Only where and which rule: the message itself could quote the candidate's text.
            found = "; ".join(f"{'.'.join(map(str, e.absolute_path)) or '$'}: {e.validator}" for e in errors[:3])
            raise AIInvalidOutput(f"The reply does not match the schema ({found}).")
    return data


class _Totals:
    def __init__(self):
        self.attempts = 0
        self.prompt_tokens = 0
        self.completion_tokens = 0


def _chat_json(provider, model, system, user, *, template, config, temperature, max_tokens, totals):
    """Up to two tries on one provider: after a temporary failure wait and repeat, after bad output ask again."""
    hint = ""
    for attempt in (1, 2):
        totals.attempts += 1
        try:
            result = provider.chat(
                system=system, user=user + hint, model=model, temperature=temperature, max_tokens=max_tokens,
                timeout=config.timeout_seconds, schema=template.output_schema or None,
            )  # fmt: skip
            totals.prompt_tokens += result.prompt_tokens
            totals.completion_tokens += result.completion_tokens
            return _parse(result.text, template.output_schema)
        except AIUnavailable as exc:
            if attempt == 2:
                raise
            _wait(exc, config)
        except AIInvalidOutput as exc:
            if attempt == 2:
                raise
            hint = f"\n\nYour previous reply was rejected: {exc} Reply again with a single valid JSON object and nothing else."
    raise AssertionError("unreachable")


def generate_json(template_key, variables, *, related=None, feature=None):
    """Run the active template `template_key` and return its answer as a dict that passed the schema.

    Raises PromptError (bad template or variables), AIPolicyBlocked, AIConfigurationError, AIUnavailable or
    AIInvalidOutput. A fallback provider, if configured, is tried when the primary one fails.
    """
    config = get_config()
    template = active_template(template_key)
    system, user = render(template, variables, config.max_input_chars)
    feature = feature or template_key
    is_eval = template.model_role == "eval"
    temperature = config.temperature_evaluation if is_eval else config.temperature_questions
    targets = [(config.provider, config.eval_model if is_eval else config.chat_model)]
    if config.fallback_provider and config.fallback_provider != config.provider:
        targets.append((config.fallback_provider, config.fallback_chat_model))
    totals, started, last_error = _Totals(), time.monotonic(), None
    for index, (provider_name, model) in enumerate(targets):
        used = provider_name
        try:
            data = _chat_json(
                get_provider(provider_name), model, system, user, template=template, config=config,
                temperature=temperature, max_tokens=config.max_tokens_for(feature), totals=totals,
            )  # fmt: skip
        except AIPolicyBlocked as exc:
            _finish(feature, used, model, AIRequestStatus.POLICY_BLOCKED, totals, started, exc, related)
            raise
        except (AIUnavailable, AIInvalidOutput, AIConfigurationError) as exc:
            last_error = exc
            continue
        except Exception as exc:  # a bug in a provider: never leak it to callers as an unknown type
            logger.exception("Unexpected failure in AI provider %s", provider_name)
            last_error = AIUnavailable("Unexpected AI failure.")
            last_error.__cause__ = exc
            continue
        status = AIRequestStatus.FALLBACK_USED if index else (AIRequestStatus.RETRIED if totals.attempts > 1 else AIRequestStatus.OK)
        _finish(feature, used, model, status, totals, started, None, related)
        return data
    _finish(feature, targets[-1][0], targets[-1][1], AIRequestStatus.FAILED, totals, started, last_error, related)
    raise last_error


def _finish(feature, provider, model, status, totals, started, error, related):
    _log(
        feature=feature, provider=provider, model=model, status=status, attempts=max(totals.attempts, 1), started=started,
        tokens=(totals.prompt_tokens, totals.completion_tokens), error=f"{type(error).__name__}: {error}" if error else "",
        related=related,
    )  # fmt: skip


def _with_retry(call, config):
    for attempt in (1, 2):
        try:
            return call(), attempt
        except AIUnavailable as exc:
            if attempt == 2:
                raise
            _wait(exc, config)


def embed(texts, *, related=None):
    """One vector per text, in order. Blank texts give None. Identical texts are only paid for once per process."""
    config = get_config()
    texts = list(texts)
    out = [None] * len(texts)
    keys, pending, computed = {}, [], {}
    for i, text in enumerate(texts):
        text = (text or "").strip()[:EMBED_TEXT_CHARS]
        if not text:
            continue
        key = hashlib.sha256(f"{config.embed_model}\0{text}".encode()).hexdigest()
        keys[i] = key
        with _embed_lock:
            cached = _embed_cache.get(key)
            if cached is not None:
                _embed_cache.move_to_end(key)
        if cached is not None:
            out[i] = cached
        elif key not in {k for k, _ in pending}:
            pending.append((key, text))
    if pending:
        started, attempts, tokens = time.monotonic(), 0, 0
        try:
            provider = get_provider(config.provider)
            for start in range(0, len(pending), EMBED_BATCH):
                batch = pending[start : start + EMBED_BATCH]
                result, used = _with_retry(
                    lambda b=batch: provider.embed([t for _, t in b], model=config.embed_model, timeout=config.timeout_seconds), config
                )
                attempts += used
                tokens += result.tokens
                if len(result.vectors) != len(batch) or not all(result.vectors):
                    raise AIInvalidOutput("The provider returned the wrong number of vectors.")
                with _embed_lock:
                    for (key, _), vector in zip(batch, result.vectors):
                        computed[key] = _embed_cache[key] = [float(x) for x in vector]
                        while len(_embed_cache) > CACHE_SIZE:
                            _embed_cache.popitem(last=False)
        except AIError as exc:
            _log(feature="embedding", provider=config.provider, model=config.embed_model, status=AIRequestStatus.FAILED,
                 attempts=max(attempts, 1), started=started, error=f"{type(exc).__name__}: {exc}", related=related)  # fmt: skip
            raise
        _log(feature="embedding", provider=config.provider, model=config.embed_model,
             status=AIRequestStatus.RETRIED if attempts > len(range(0, len(pending), EMBED_BATCH)) else AIRequestStatus.OK,
             attempts=max(attempts, 1), started=started, tokens=(tokens, 0), related=related)  # fmt: skip
    for i, key in keys.items():
        if out[i] is None:
            out[i] = computed[key]
    return out


def clear_embedding_cache():
    with _embed_lock:
        _embed_cache.clear()


def transcribe(file, *, related=None):
    """Speech to text. Returns the transcript text and its length in seconds, or raises TranscriptionFailed."""
    config = get_config()
    started = time.monotonic()
    attempts = 1
    try:
        provider = get_provider(config.provider)
        result, attempts = _with_retry(lambda: provider.transcribe(file, model=config.stt_model, timeout=config.timeout_seconds), config)
        if not result.text.strip():
            raise TranscriptionFailed("No speech was detected.")
    except TranscriptionFailed as exc:
        _log(feature="stt", provider=config.provider, model=config.stt_model, status=AIRequestStatus.FAILED,
             attempts=attempts, started=started, error="TranscriptionFailed: no speech", related=related)  # fmt: skip
        raise exc
    except AIError as exc:
        _log(feature="stt", provider=config.provider, model=config.stt_model, status=AIRequestStatus.FAILED,
             attempts=2 if isinstance(exc, AIUnavailable) else 1, started=started, error=f"{type(exc).__name__}: {exc}", related=related)  # fmt: skip
        raise TranscriptionFailed("The recording could not be transcribed.") from exc
    _log(feature="stt", provider=config.provider, model=config.stt_model,
         status=AIRequestStatus.RETRIED if attempts > 1 else AIRequestStatus.OK, attempts=attempts, started=started, related=related)  # fmt: skip
    return result

from dataclasses import dataclass, field

from django.conf import settings
from django.core.cache import cache

CACHE_KEY = "foundation:ai-config"
CACHE_SECONDS = 30


@dataclass(frozen=True)
class AIConfig:
    provider: str
    fallback_provider: str
    chat_model: str
    eval_model: str
    embed_model: str
    stt_model: str
    fallback_chat_model: str
    temperature_questions: float
    temperature_evaluation: float
    timeout_seconds: int
    retry_delay_seconds: int
    default_max_tokens: int
    max_input_chars: int
    screening_min_score: int
    screening_questions: int
    technical_questions: int
    mock_questions: int
    max_tokens: dict = field(default_factory=dict)

    def max_tokens_for(self, feature):
        return int(self.max_tokens.get(feature, self.default_max_tokens))


def _build():
    from ..models import AISettings

    row = AISettings.objects.filter(pk=1).first() or AISettings()
    return AIConfig(
        provider=row.provider or settings.AI_PROVIDER,
        fallback_provider=row.fallback_provider or settings.AI_FALLBACK_PROVIDER,
        chat_model=row.chat_model or settings.AI_CHAT_MODEL,
        eval_model=row.eval_model or settings.AI_EVAL_MODEL,
        embed_model=row.embed_model or settings.AI_EMBED_MODEL,
        stt_model=row.stt_model or settings.AI_STT_MODEL,
        fallback_chat_model=row.fallback_chat_model or settings.AI_CHAT_MODEL,
        temperature_questions=row.temperature_questions,
        temperature_evaluation=row.temperature_evaluation,
        timeout_seconds=row.timeout_seconds or settings.AI_TIMEOUT_SECONDS,
        retry_delay_seconds=settings.AI_RETRY_DELAY_SECONDS,
        default_max_tokens=settings.AI_MAX_OUTPUT_TOKENS,
        max_input_chars=settings.AI_MAX_INPUT_CHARS,
        screening_min_score=row.screening_min_score,
        screening_questions=row.screening_questions,
        technical_questions=row.technical_questions,
        mock_questions=row.mock_questions,
        max_tokens=dict(row.max_tokens or {}),
    )


def get_config():
    """The effective AI settings: the admin-edited row over Django settings, cached for a few seconds."""
    config = cache.get(CACHE_KEY)
    if config is None:
        config = _build()
        cache.set(CACHE_KEY, config, CACHE_SECONDS)
    return config


def clear_config_cache(**_):
    cache.delete(CACHE_KEY)

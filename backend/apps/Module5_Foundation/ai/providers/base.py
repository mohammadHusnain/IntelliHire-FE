from dataclasses import dataclass


@dataclass
class ChatResult:
    text: str
    prompt_tokens: int = 0
    completion_tokens: int = 0


@dataclass
class EmbedResult:
    vectors: list
    tokens: int = 0


@dataclass
class TranscribeResult:
    text: str
    duration_seconds: float = 0.0


class Provider:
    """What every AI provider must offer. Providers raise the errors in `ai.errors`; they never log prompts."""

    name = ""

    def chat(self, *, system, user, model, temperature, max_tokens, timeout, schema=None):
        raise NotImplementedError

    def embed(self, texts, *, model, timeout):
        raise NotImplementedError

    def transcribe(self, file, *, model, timeout):
        raise NotImplementedError

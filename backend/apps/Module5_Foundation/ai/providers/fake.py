"""A deterministic provider for development and tests: no network, no cost, schema-valid answers."""
import hashlib
import json
import math
import re
from collections import deque

from .base import ChatResult, EmbedResult, Provider, TranscribeResult

DIMENSIONS = 64


def example_from_schema(schema):
    """The simplest value that satisfies a JSON Schema (enough for the schemas this project writes)."""
    if not isinstance(schema, dict):
        return None
    if "enum" in schema:
        return schema["enum"][0]
    if "const" in schema:
        return schema["const"]
    kind = schema.get("type")
    if isinstance(kind, list):
        kind = next((k for k in kind if k != "null"), "null")
    if kind == "object" or "properties" in schema:
        props = schema.get("properties", {})
        required = schema.get("required", list(props))
        return {key: example_from_schema(props.get(key, {})) for key in required}
    if kind == "array":
        item = example_from_schema(schema.get("items", {}))
        return [item for _ in range(max(int(schema.get("minItems", 1)), 1))]
    if kind == "string":
        return "x" * int(schema.get("minLength", 0)) or "sample"
    if kind in ("integer", "number"):
        low, high = schema.get("minimum"), schema.get("maximum")
        value = 7 if low is None or low <= 7 else low
        if high is not None and value > high:
            value = high
        return int(value) if kind == "integer" else float(value)
    if kind == "boolean":
        return True
    return None


class FakeProvider(Provider):
    name = "fake"
    _chat, _embed, _stt = deque(), deque(), deque()
    calls = []

    @classmethod
    def reset(cls):
        cls._chat.clear(), cls._embed.clear(), cls._stt.clear()
        cls.calls = []

    @classmethod
    def queue_chat(cls, *items):
        """Next chat replies, in order: a dict or str is returned (dicts as JSON), an exception is raised."""
        cls._chat.extend(items)

    @classmethod
    def queue_embed(cls, *items):
        cls._embed.extend(items)

    @classmethod
    def queue_transcribe(cls, *items):
        cls._stt.extend(items)

    @staticmethod
    def _take(queue):
        item = queue.popleft()
        if isinstance(item, BaseException) or (isinstance(item, type) and issubclass(item, BaseException)):
            raise item
        return item

    def chat(self, *, system, user, model, temperature, max_tokens, timeout, schema=None):
        self.calls.append({"method": "chat", "model": model, "system": system, "user": user, "schema": schema})
        if self._chat:
            item = self._take(self._chat)
            text = item if isinstance(item, str) else json.dumps(item)
        else:
            text = json.dumps(example_from_schema(schema or {"type": "object", "properties": {"ok": {"type": "boolean"}}}))
        return ChatResult(text=text, prompt_tokens=len(system + user) // 4, completion_tokens=len(text) // 4)

    def embed(self, texts, *, model, timeout):
        self.calls.append({"method": "embed", "model": model, "texts": list(texts)})
        if self._embed:
            return EmbedResult(vectors=self._take(self._embed), tokens=0)
        return EmbedResult(vectors=[self._vector(text) for text in texts], tokens=sum(len(t) for t in texts) // 4)

    @staticmethod
    def _vector(text):
        """Hashed bag of words, length 1: texts that share words have a positive cosine similarity."""
        vector = [0.0] * DIMENSIONS
        for word in re.findall(r"[a-z0-9+#]+", text.lower()):
            vector[int(hashlib.sha256(word.encode()).hexdigest()[:8], 16) % DIMENSIONS] += 1.0
        norm = math.sqrt(sum(v * v for v in vector)) or 1.0
        return [v / norm for v in vector]

    def transcribe(self, file, *, model, timeout):
        self.calls.append({"method": "transcribe", "model": model})
        if self._stt:
            item = self._take(self._stt)
            return item if isinstance(item, TranscribeResult) else TranscribeResult(text=str(item), duration_seconds=1.0)
        return TranscribeResult(text="This is a fake transcript.", duration_seconds=1.0)

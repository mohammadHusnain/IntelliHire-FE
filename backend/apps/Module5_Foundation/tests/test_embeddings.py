import pytest

from apps.Module5_Foundation.ai import llm
from apps.Module5_Foundation.ai.errors import AIInvalidOutput, AIUnavailable, TranscriptionFailed
from apps.Module5_Foundation.ai.providers.base import TranscribeResult
from apps.Module5_Foundation.ai.providers.fake import FakeProvider, example_from_schema
from apps.Module5_Foundation.ai.vectors import cosine_similarity
from apps.Module5_Foundation.models import AIRequestLog

pytestmark = pytest.mark.django_db


def provider_calls(method):
    return [c for c in FakeProvider.calls if c["method"] == method]


class TestEmbed:
    def test_one_vector_per_text_in_order_and_one_log_row(self):
        vectors = llm.embed(["python developer", "python engineer", "chef"])
        assert len(vectors) == 3 and all(len(v) == 64 for v in vectors)
        assert AIRequestLog.objects.get().feature == "embedding"

    def test_similar_texts_are_closer_than_different_ones(self):
        a, b, c = llm.embed(["python django developer", "django python developer", "pastry chef baking bread"])
        assert cosine_similarity(a, b) > 0.9 > cosine_similarity(a, c)

    def test_blank_texts_give_none_and_cost_nothing(self):
        assert llm.embed(["", "   ", None]) == [None, None, None]
        assert llm.embed([]) == []
        assert provider_calls("embed") == [] and AIRequestLog.objects.count() == 0

    def test_a_repeated_text_is_only_paid_for_once_even_across_calls(self):
        llm.embed(["alpha", "alpha", "beta"])
        assert provider_calls("embed")[0]["texts"] == ["alpha", "beta"]
        again = llm.embed(["beta", "alpha"])
        assert len(provider_calls("embed")) == 1 and again[0] is not None and AIRequestLog.objects.count() == 1

    def test_large_inputs_are_split_into_batches(self):
        texts = [f"text number {i}" for i in range(200)]
        assert len(llm.embed(texts)) == 200
        assert [len(c["texts"]) for c in provider_calls("embed")] == [96, 96, 8]

    def test_more_distinct_texts_than_the_cache_holds_still_all_get_vectors(self, monkeypatch):
        monkeypatch.setattr(llm, "CACHE_SIZE", 3)
        vectors = llm.embed([f"word{i}" for i in range(10)])
        assert len(vectors) == 10 and all(v is not None for v in vectors)

    def test_very_long_text_is_trimmed(self):
        llm.embed(["x" * 20000])
        assert len(provider_calls("embed")[0]["texts"][0]) == llm.EMBED_TEXT_CHARS

    def test_a_temporary_failure_is_retried_once(self):
        FakeProvider.queue_embed(AIUnavailable("x"))
        assert llm.embed(["alpha"])[0] is not None
        log = AIRequestLog.objects.get()
        assert (log.status, log.attempts) == ("retried", 2)

    def test_two_failures_raise_and_are_logged(self):
        FakeProvider.queue_embed(AIUnavailable("x"), AIUnavailable("y"))
        with pytest.raises(AIUnavailable):
            llm.embed(["alpha"])
        assert AIRequestLog.objects.get().status == "failed"

    @pytest.mark.parametrize("bad", [[[0.1]], [[0.1], []], [[]]])
    def test_a_wrong_number_or_an_empty_vector_is_invalid(self, bad):
        FakeProvider.queue_embed(bad)
        with pytest.raises(AIInvalidOutput):
            llm.embed(["alpha", "beta"] if len(bad) == 2 else ["alpha", "beta", "gamma"] if bad == [[0.1]] else ["alpha"])


class TestCosine:
    def test_known_values(self):
        assert cosine_similarity([1, 0], [1, 0]) == pytest.approx(1)
        assert cosine_similarity([1, 0], [0, 1]) == pytest.approx(0)
        assert cosine_similarity([1, 1], [-1, -1]) == pytest.approx(-1)

    @pytest.mark.parametrize("a,b", [([], [1]), ([1], []), ([0, 0], [1, 1]), ([1, 2], [1]), (None, [1])])
    def test_degenerate_input_gives_zero(self, a, b):
        assert cosine_similarity(a, b) == 0.0


class TestTranscribe:
    def test_returns_text_and_duration(self):
        FakeProvider.queue_transcribe(TranscribeResult(text="  hello world ", duration_seconds=3.5))
        result = llm.transcribe(b"audio")
        assert result.duration_seconds == 3.5 and result.text.strip() == "hello world"
        assert AIRequestLog.objects.get().feature == "stt"

    def test_silence_is_a_failure(self):
        FakeProvider.queue_transcribe("   ")
        with pytest.raises(TranscriptionFailed, match="No speech"):
            llm.transcribe(b"audio")
        assert AIRequestLog.objects.get().status == "failed"

    def test_a_retry_then_success(self):
        FakeProvider.queue_transcribe(AIUnavailable("x"), "hello")
        assert llm.transcribe(b"audio").text == "hello"
        assert AIRequestLog.objects.get().status == "retried"

    def test_persistent_failure_is_a_transcription_failure_not_an_ai_error(self):
        FakeProvider.queue_transcribe(AIUnavailable("x"), AIUnavailable("y"))
        with pytest.raises(TranscriptionFailed):
            llm.transcribe(b"audio")
        assert AIRequestLog.objects.get().attempts == 2

    def test_other_ai_errors_also_become_a_transcription_failure(self):
        from apps.Module5_Foundation.ai.errors import AIConfigurationError, AIPolicyBlocked

        for error in (AIPolicyBlocked("no"), AIConfigurationError("key")):
            FakeProvider.queue_transcribe(error)
            with pytest.raises(TranscriptionFailed):
                llm.transcribe(b"audio")


class TestFakeSchemaExamples:
    def test_examples_satisfy_their_own_schemas(self):
        import jsonschema

        schemas = [
            {"type": "object", "required": ["a", "b"], "properties": {"a": {"type": "integer", "minimum": 8, "maximum": 10}, "b": {"enum": ["x", "y"]}}},
            {"type": "object", "required": ["items"], "properties": {"items": {"type": "array", "minItems": 2, "items": {"type": "string", "minLength": 3}}}},
            {"type": "object", "required": ["n", "ok", "nested"], "properties": {"n": {"type": "number", "maximum": 5}, "ok": {"type": "boolean"}, "nested": {"type": "object", "required": ["z"], "properties": {"z": {"type": ["string", "null"]}}}}},
        ]
        for schema in schemas:
            jsonschema.validate(example_from_schema(schema), schema)

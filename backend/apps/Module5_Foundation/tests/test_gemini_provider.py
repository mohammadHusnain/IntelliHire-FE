"""The Gemini adapter: JSON mode in, project errors out, never an SDK type.

The SDK's exception classes move between versions, so the adapter decides on the error text and on a
status when one is attached. These tests pin that translation with plain exceptions, which is exactly
what an unknown future SDK error looks like.
"""
from types import SimpleNamespace

import pytest

from apps.Module5_Foundation.ai.errors import AIConfigurationError, AIPolicyBlocked, AIUnavailable
from apps.Module5_Foundation.ai.providers import get_provider
from apps.Module5_Foundation.ai.providers.gemini_provider import GeminiProvider

CHAT = dict(system="s", user="u", model="gemini-2.5-flash", temperature=0.2, max_tokens=50, timeout=5)


class Client:
    """Just enough of the SDK's shape; each endpoint returns or raises what the test gave it."""

    def __init__(self, generate=None, embed=None):
        self.calls = {}
        outer = self

        def handler(name, outcome):
            def call(**kwargs):
                outer.calls[name] = kwargs
                if isinstance(outcome, BaseException):
                    raise outcome
                return outcome

            return call

        self.models = SimpleNamespace(generate_content=handler("generate", generate), embed_content=handler("embed", embed))


def reply(text="{}", usage=(10, 5), finish="STOP", block_reason=None):
    return SimpleNamespace(
        text=text,
        candidates=[SimpleNamespace(finish_reason=finish)],
        prompt_feedback=SimpleNamespace(block_reason=block_reason),
        usage_metadata=SimpleNamespace(prompt_token_count=usage[0], candidates_token_count=usage[1]),
    )


def failure(message, status=None):
    error = RuntimeError(message)
    if status is not None:
        error.code = status
    return error


def chat_with(outcome):
    client = Client(generate=outcome)
    return GeminiProvider(client=client).chat(**CHAT), client


class TestChat:
    def test_it_asks_for_json_and_reports_the_tokens_it_used(self):
        result, client = chat_with(reply('{"a": 1}'))
        assert (result.text, result.prompt_tokens, result.completion_tokens) == ('{"a": 1}', 10, 5)
        config = client.calls["generate"]["config"]
        assert config.response_mime_type == "application/json"
        assert config.system_instruction == "s"
        assert config.temperature == 0.2
        assert config.max_output_tokens == 50

    def test_the_timeout_reaches_the_sdk_in_milliseconds(self):
        _, client = chat_with(reply())
        assert client.calls["generate"]["config"].http_options.timeout == 5000

    def test_a_reply_with_no_text_is_an_empty_string_not_a_crash(self):
        result, _ = chat_with(SimpleNamespace(text=None, candidates=[], prompt_feedback=None, usage_metadata=None))
        assert (result.text, result.prompt_tokens, result.completion_tokens) == ("", 0, 0)

    def test_a_blocked_prompt_is_a_policy_error(self):
        with pytest.raises(AIPolicyBlocked):
            chat_with(reply(block_reason="SAFETY"))

    def test_an_answer_the_model_filtered_itself_is_a_policy_error(self):
        with pytest.raises(AIPolicyBlocked):
            chat_with(reply(finish="FinishReason.SAFETY"))

    @pytest.mark.parametrize("message", ["blocked by the safety filter", "PROHIBITED content", "recitation check failed"])
    def test_a_refusal_in_the_error_text_is_a_policy_error(self, message):
        with pytest.raises(AIPolicyBlocked):
            chat_with(failure(message))

    @pytest.mark.parametrize("status", [401, 403])
    def test_a_rejected_key_is_a_configuration_error(self, status):
        with pytest.raises(AIConfigurationError):
            chat_with(failure("nope", status))

    @pytest.mark.parametrize("message", ["API key not valid", "the caller does not have permission"])
    def test_a_credentials_message_without_a_status_is_a_configuration_error(self, message):
        with pytest.raises(AIConfigurationError):
            chat_with(failure(message))

    def test_a_rejected_request_is_a_configuration_error_so_it_is_not_retried(self):
        with pytest.raises(AIConfigurationError):
            chat_with(failure("model not found", 400))

    @pytest.mark.parametrize("status", [429, 500, 502, 503, 504])
    def test_a_server_side_status_is_temporary(self, status):
        with pytest.raises(AIUnavailable):
            chat_with(failure("later", status))

    @pytest.mark.parametrize("message", ["rate limit exceeded", "RESOURCE_EXHAUSTED", "quota reached", "deadline exceeded", "503 unavailable"])
    def test_a_temporary_message_without_a_status_is_temporary(self, message):
        with pytest.raises(AIUnavailable):
            chat_with(failure(message))

    def test_an_error_nobody_anticipated_is_temporary_and_never_leaks_the_sdk_type(self):
        with pytest.raises(AIUnavailable) as problem:
            chat_with(failure("something new in a future SDK"))
        assert "something new" not in str(problem.value), "the provider's own words never reach the caller"
        assert isinstance(problem.value.__cause__, RuntimeError), "the original error is kept for the log"


class TestEmbed:
    def test_it_returns_one_vector_per_text(self):
        client = Client(embed=SimpleNamespace(embeddings=[SimpleNamespace(values=[0.1, 0.2]), SimpleNamespace(values=[0.3, 0.4])]))
        result = GeminiProvider(client=client).embed(["a", "b"], model="text-embedding-004", timeout=5)
        assert result.vectors == [[0.1, 0.2], [0.3, 0.4]]
        assert client.calls["embed"]["contents"] == ["a", "b"]

    def test_a_failure_is_translated_like_any_other(self):
        with pytest.raises(AIUnavailable):
            GeminiProvider(client=Client(embed=failure("rate limit"))).embed(["a"], model="m", timeout=5)


class TestConfiguration:
    def test_it_is_registered_under_its_name(self):
        assert isinstance(get_provider("gemini"), GeminiProvider)

    def test_without_a_key_it_says_so_instead_of_calling_out(self, settings):
        settings.GEMINI_API_KEY = ""
        with pytest.raises(AIConfigurationError) as problem:
            GeminiProvider().chat(**CHAT)
        assert "GEMINI_API_KEY" in str(problem.value)

    def test_transcription_is_not_connected_here(self):
        with pytest.raises(AIConfigurationError):
            GeminiProvider(client=Client()).transcribe(None, model="m", timeout=5)

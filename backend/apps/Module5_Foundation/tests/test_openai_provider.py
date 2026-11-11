from types import SimpleNamespace

import openai
import pytest

try:  # the HTTP client the pinned SDK is built on
    import httpx2 as httpx
except ImportError:  # pragma: no cover
    import httpx

from apps.Module5_Foundation.ai.errors import AIConfigurationError, AIPolicyBlocked, AIUnavailable
from apps.Module5_Foundation.ai.providers.openai_provider import OpenAIProvider

CHAT = dict(system="s", user="u", model="gpt-4o-mini", temperature=0.2, max_tokens=50, timeout=5)


def response(status, headers=None):
    return httpx.Response(status, headers=headers or {}, request=httpx.Request("POST", "http://api.test/"))


def status_error(cls, status, body=None, headers=None):
    return cls("boom", response=response(status, headers), body=body)


class Client:
    """Just enough of the SDK's shape; each endpoint returns or raises what the test gave it."""

    def __init__(self, chat=None, embed=None, stt=None):
        self.calls = {}
        outer = self

        def handler(name, outcome):
            def call(**kwargs):
                outer.calls[name] = kwargs
                if isinstance(outcome, BaseException):
                    raise outcome
                return outcome

            return call

        self.chat = SimpleNamespace(completions=SimpleNamespace(create=handler("chat", chat)))
        self.embeddings = SimpleNamespace(create=handler("embed", embed))
        self.audio = SimpleNamespace(transcriptions=SimpleNamespace(create=handler("stt", stt)))


def completion(text="{}", finish="stop", usage=(10, 5)):
    return SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=text), finish_reason=finish)],
        usage=SimpleNamespace(prompt_tokens=usage[0], completion_tokens=usage[1]),
    )


def chat_with(outcome):
    client = Client(chat=outcome)
    return OpenAIProvider(client=client).chat(**CHAT), client


def test_chat_success_passes_json_mode_and_reports_tokens():
    result, client = chat_with(completion('{"a": 1}'))
    assert (result.text, result.prompt_tokens, result.completion_tokens) == ('{"a": 1}', 10, 5)
    sent = client.calls["chat"]
    assert sent["response_format"] == {"type": "json_object"} and sent["max_completion_tokens"] == 50 and sent["model"] == "gpt-4o-mini"
    assert [m["role"] for m in sent["messages"]] == ["system", "user"]


def test_missing_usage_and_content_are_tolerated():
    result, _ = chat_with(SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=None), finish_reason="stop")], usage=None))
    assert (result.text, result.prompt_tokens, result.completion_tokens) == ("", 0, 0)


def test_a_filtered_answer_is_a_policy_block():
    with pytest.raises(AIPolicyBlocked):
        chat_with(completion(finish="content_filter"))


@pytest.mark.parametrize("code", ["content_policy_violation", "invalid_prompt"])
def test_a_content_policy_bad_request_is_a_policy_block(code):
    with pytest.raises(AIPolicyBlocked):
        chat_with(status_error(openai.BadRequestError, 400, body={"error": {"code": code}}))


def test_any_other_bad_request_is_a_configuration_error():
    with pytest.raises(AIConfigurationError, match="context_length_exceeded"):
        chat_with(status_error(openai.BadRequestError, 400, body={"error": {"code": "context_length_exceeded"}}))


@pytest.mark.parametrize("cls,status", [(openai.AuthenticationError, 401), (openai.PermissionDeniedError, 403)])
def test_rejected_credentials_are_a_configuration_error(cls, status):
    with pytest.raises(AIConfigurationError, match="credentials"):
        chat_with(status_error(cls, status))


def test_rate_limits_are_temporary_and_carry_retry_after():
    with pytest.raises(AIUnavailable) as info:
        chat_with(status_error(openai.RateLimitError, 429, headers={"retry-after": "7"}))
    assert info.value.retry_after == 7.0


def test_a_rate_limit_without_a_header_has_no_retry_after():
    with pytest.raises(AIUnavailable) as info:
        chat_with(status_error(openai.RateLimitError, 429))
    assert info.value.retry_after is None


@pytest.mark.parametrize("error", [openai.APITimeoutError(request=httpx.Request("POST", "http://x")), openai.APIConnectionError(request=httpx.Request("POST", "http://x"))])
def test_timeouts_and_connection_errors_are_temporary(error):
    with pytest.raises(AIUnavailable):
        chat_with(error)


def test_server_errors_are_temporary_and_other_statuses_are_not():
    with pytest.raises(AIUnavailable):
        chat_with(status_error(openai.InternalServerError, 503))
    with pytest.raises(AIConfigurationError):
        chat_with(status_error(openai.NotFoundError, 404))


def test_embeddings_come_back_in_input_order_with_token_usage():
    data = [SimpleNamespace(index=1, embedding=[0.2]), SimpleNamespace(index=0, embedding=[0.1])]
    client = Client(embed=SimpleNamespace(data=data, usage=SimpleNamespace(total_tokens=9)))
    result = OpenAIProvider(client=client).embed(["a", "b"], model="text-embedding-3-small", timeout=5)
    assert result.vectors == [[0.1], [0.2]] and result.tokens == 9 and client.calls["embed"]["input"] == ["a", "b"]


def test_embedding_errors_are_mapped_too():
    with pytest.raises(AIUnavailable):
        OpenAIProvider(client=Client(embed=status_error(openai.RateLimitError, 429))).embed(["a"], model="m", timeout=5)


def test_transcription_returns_text_and_duration():
    client = Client(stt=SimpleNamespace(text="  hello ", duration=2.5))
    result = OpenAIProvider(client=client).transcribe(b"audio", model="whisper-1", timeout=5)
    assert (result.text, result.duration_seconds) == ("hello", 2.5)
    assert client.calls["stt"]["response_format"] == "verbose_json"


def test_without_a_key_nothing_is_called(settings):
    settings.OPENAI_API_KEY = ""
    with pytest.raises(AIConfigurationError, match="OPENAI_API_KEY"):
        OpenAIProvider().chat(**CHAT)


def test_with_a_key_a_real_client_is_built_with_no_sdk_retries(settings, monkeypatch):
    settings.OPENAI_API_KEY = "sk-test"
    built = {}

    class FakeOpenAI:
        def __init__(self, **kwargs):
            built.update(kwargs)
            self.chat = SimpleNamespace(completions=SimpleNamespace(create=lambda **kw: completion()))

    monkeypatch.setattr(openai, "OpenAI", FakeOpenAI)
    OpenAIProvider().chat(**CHAT)
    assert built == {"api_key": "sk-test", "timeout": 5, "max_retries": 0}

import pytest

from apps.Module5_Foundation.ai import llm
from apps.Module5_Foundation.ai.errors import AIConfigurationError, AIInvalidOutput, AIPolicyBlocked, AIUnavailable, PromptError
from apps.Module5_Foundation.ai.providers.base import ChatResult, Provider
from apps.Module5_Foundation.ai.providers.fake import FakeProvider
from apps.Module5_Foundation.models import AIRequestLog, AISettings

pytestmark = pytest.mark.django_db


def run(**variables):
    return llm.generate_json("score_answer", variables or {"answer": "I would use an index."})


def only_log():
    return AIRequestLog.objects.get()


class TestHappyPath:
    def test_the_fake_provider_returns_schema_valid_json_and_one_log_row_is_written(self, template):
        template()
        result = run()
        assert isinstance(result["score"], int) and 0 <= result["score"] <= 10 and isinstance(result["feedback"], str)
        log = only_log()
        assert (log.feature, log.provider, log.status, log.attempts, log.error) == ("score_answer", "fake", "ok", 1, "")
        assert log.model == "gpt-4o-mini" and log.prompt_tokens > 0 and log.completion_tokens > 0

    def test_scripted_answers_and_code_fences_are_accepted(self, template):
        template()
        FakeProvider.queue_chat('```json\n{"score": 4, "feedback": "ok"}\n```')
        assert run() == {"score": 4, "feedback": "ok"}

    def test_the_prompt_text_reaches_the_provider_but_never_the_log(self, template):
        template()
        run(answer="SECRET-CANDIDATE-ANSWER")
        assert "SECRET-CANDIDATE-ANSWER" in FakeProvider.calls[-1]["user"]
        row = only_log()
        assert "SECRET" not in repr(vars(row))

    def test_related_object_is_recorded(self, template, company_factory):
        template()
        company = company_factory()
        llm.generate_json("score_answer", {"answer": "x"}, related=company, feature="custom_feature")
        log = only_log()
        assert (log.feature, log.related_type, log.related_id) == ("custom_feature", "company", company.pk)

    def test_evaluation_templates_use_the_evaluation_model_and_temperature(self, template):
        template(key="judge", role="eval", user="{answer}")
        llm.generate_json("judge", {"answer": "x"})
        assert FakeProvider.calls[-1]["model"] == "gpt-4o" and only_log().model == "gpt-4o"

    def test_long_variables_are_cut_before_sending(self, template, settings):
        settings.AI_MAX_INPUT_CHARS = 200
        template()
        run(answer="x" * 5000)
        sent = FakeProvider.calls[-1]["user"]
        assert len(sent) < 300 and "[truncated]" in sent

    def test_per_feature_token_caps(self, template):
        template()
        AISettings.objects.create(max_tokens={"score_answer": 77})
        seen = {}
        original = FakeProvider.chat

        def spy(self, **kw):
            seen.update(kw)
            return original(self, **kw)

        FakeProvider.chat = spy
        try:
            run()
        finally:
            FakeProvider.chat = original
        assert seen["max_tokens"] == 77


class TestBadTemplates:
    def test_no_active_template(self):
        with pytest.raises(PromptError):
            run()
        assert AIRequestLog.objects.count() == 0

    def test_variables_must_match(self, template):
        template()
        with pytest.raises(PromptError):
            llm.generate_json("score_answer", {})
        with pytest.raises(PromptError):
            llm.generate_json("score_answer", {"answer": "x", "extra": "y"})
        assert AIRequestLog.objects.count() == 0 and FakeProvider.calls == []


class TestInvalidOutput:
    def test_bad_json_is_retried_once_with_the_problem_explained(self, template):
        template()
        FakeProvider.queue_chat("not json at all", {"score": 5, "feedback": "fine"})
        assert run()["score"] == 5
        assert len(FakeProvider.calls) == 2 and "rejected" in FakeProvider.calls[1]["user"]
        log = only_log()
        assert (log.status, log.attempts) == ("retried", 2)

    def test_two_bad_replies_raise_and_log_a_failure(self, template):
        template()
        FakeProvider.queue_chat("nope", "still nope")
        with pytest.raises(AIInvalidOutput):
            run()
        log = only_log()
        assert (log.status, log.attempts) == ("failed", 2) and "AIInvalidOutput" in log.error

    def test_a_schema_violation_is_reported_by_rule_not_by_value(self, template):
        template()
        FakeProvider.queue_chat({"score": 11, "feedback": "TOP-SECRET-TEXT"}, {"score": 12, "feedback": "TOP-SECRET-TEXT"})
        with pytest.raises(AIInvalidOutput) as info:
            run()
        assert "score: maximum" in str(info.value) and "TOP-SECRET-TEXT" not in str(info.value)
        assert "TOP-SECRET-TEXT" not in only_log().error

    @pytest.mark.parametrize("reply", ["[1, 2]", '"text"', "42", "null", ""])
    def test_a_reply_that_is_not_an_object_is_invalid(self, template, reply):
        template()
        FakeProvider.queue_chat(reply, reply)
        with pytest.raises(AIInvalidOutput):
            run()

    def test_a_missing_required_field_is_invalid(self, template):
        template()
        FakeProvider.queue_chat({"score": 1}, {"score": 1})
        with pytest.raises(AIInvalidOutput):
            run()

    def test_an_empty_schema_accepts_any_object(self, template):
        template(schema={"type": "object"})
        FakeProvider.queue_chat({"anything": [1]})
        assert run() == {"anything": [1]}


class TestTemporaryFailures:
    def test_one_retry_after_a_wait(self, template, settings, waits):
        settings.AI_RETRY_DELAY_SECONDS = 10
        template()
        FakeProvider.queue_chat(AIUnavailable("timeout"))
        assert run()["score"] == 7
        assert waits == [10] and only_log().status == "retried"

    def test_a_provider_retry_after_is_honoured_up_to_30_seconds(self, template, settings, waits):
        settings.AI_RETRY_DELAY_SECONDS = 10
        template()
        FakeProvider.queue_chat(AIUnavailable("rate", retry_after=45), AIUnavailable("rate", retry_after=5))
        with pytest.raises(AIUnavailable):
            run()
        # the second failure is final, so only the first wait happened
        assert waits == [30]

    def test_a_short_retry_after_does_not_shorten_the_wait(self, template, settings, waits):
        settings.AI_RETRY_DELAY_SECONDS = 10
        template()
        FakeProvider.queue_chat(AIUnavailable("rate", retry_after=2))
        run()
        assert waits == [10]

    def test_zero_delay_does_not_sleep(self, template, waits):
        template()
        FakeProvider.queue_chat(AIUnavailable("x"))
        run()
        assert waits == []

    def test_two_failures_raise_and_are_logged(self, template):
        template()
        FakeProvider.queue_chat(AIUnavailable("a"), AIUnavailable("b"))
        with pytest.raises(AIUnavailable):
            run()
        log = only_log()
        assert (log.status, log.attempts) == ("failed", 2)

    def test_unavailable_then_invalid_gives_up(self, template):
        template()
        FakeProvider.queue_chat(AIUnavailable("a"), "garbage")
        with pytest.raises(AIInvalidOutput):
            run()
        assert len(FakeProvider.calls) == 2

    def test_a_bug_in_a_provider_becomes_an_ai_error_and_is_logged(self, template, monkeypatch):
        template()
        FakeProvider.queue_chat(RuntimeError("boom"))
        with pytest.raises(AIUnavailable):
            run()
        assert only_log().status == "failed"


class TestPolicyAndConfiguration:
    def test_a_policy_block_raises_at_once_without_retry_or_fallback(self, template, settings):
        template()
        settings.AI_FALLBACK_PROVIDER = "backup"
        FakeProvider.queue_chat(AIPolicyBlocked("refused"))
        with pytest.raises(AIPolicyBlocked):
            run()
        log = only_log()
        assert (log.status, log.attempts) == ("policy_blocked", 1) and len(FakeProvider.calls) == 1

    def test_a_configuration_error_is_not_retried(self, template):
        template()
        FakeProvider.queue_chat(AIConfigurationError("bad key"))
        with pytest.raises(AIConfigurationError):
            run()
        assert len(FakeProvider.calls) == 1 and only_log().status == "failed"

    def test_an_unknown_provider_name(self, template):
        template()
        AISettings.objects.create(provider="nope")
        with pytest.raises(AIConfigurationError):
            run()

    def test_the_openai_provider_without_a_key_is_a_configuration_error(self, template, settings):
        template()
        settings.AI_PROVIDER, settings.OPENAI_API_KEY = "openai", ""
        with pytest.raises(AIConfigurationError, match="OPENAI_API_KEY"):
            run()


class Stub(Provider):
    def __init__(self, name, *replies):
        self.name, self.replies, self.calls = name, list(replies), 0

    def chat(self, **kw):
        self.calls += 1
        reply = self.replies.pop(0)
        if isinstance(reply, BaseException):
            raise reply
        return ChatResult(text=reply, prompt_tokens=3, completion_tokens=4)


class TestFallback:
    @pytest.fixture
    def providers(self, monkeypatch, settings, template):
        template()
        settings.AI_PROVIDER, settings.AI_FALLBACK_PROVIDER = "primary", "backup"
        stubs = {}
        monkeypatch.setattr(llm, "get_provider", lambda name: stubs[name])
        return stubs

    def test_the_fallback_answers_when_the_primary_is_down(self, providers):
        providers["primary"] = Stub("primary", AIUnavailable("a"), AIUnavailable("b"))
        providers["backup"] = Stub("backup", '{"score": 3, "feedback": "backup"}')
        assert run()["feedback"] == "backup"
        log = only_log()
        assert (log.status, log.provider, log.attempts) == ("fallback_used", "backup", 3)
        assert (log.prompt_tokens, log.completion_tokens) == (3, 4)

    def test_a_bad_primary_key_falls_back_too(self, providers):
        providers["primary"] = Stub("primary", AIConfigurationError("401"))
        providers["backup"] = Stub("backup", '{"score": 1, "feedback": "ok"}')
        assert run()["score"] == 1 and only_log().status == "fallback_used"

    def test_both_failing_raises_the_last_error_and_logs_once(self, providers):
        providers["primary"] = Stub("primary", AIUnavailable("a"), AIUnavailable("b"))
        providers["backup"] = Stub("backup", AIUnavailable("c"), AIUnavailable("d"))
        with pytest.raises(AIUnavailable, match="d"):
            run()
        assert AIRequestLog.objects.count() == 1 and only_log().status == "failed"

    def test_the_primary_answering_never_touches_the_fallback(self, providers):
        providers["primary"] = Stub("primary", '{"score": 2, "feedback": "p"}')
        providers["backup"] = Stub("backup")
        run()
        assert providers["backup"].calls == 0 and only_log().status == "ok"

    def test_the_same_provider_as_fallback_is_ignored(self, providers, settings):
        settings.AI_FALLBACK_PROVIDER = "primary"
        providers["primary"] = Stub("primary", AIUnavailable("a"), AIUnavailable("b"))
        with pytest.raises(AIUnavailable):
            run()
        assert providers["primary"].calls == 2

    def test_a_failing_log_write_never_breaks_the_call(self, template, monkeypatch, caplog):
        template()
        monkeypatch.setattr(AIRequestLog.objects, "create", lambda **kw: (_ for _ in ()).throw(RuntimeError("db")))
        assert run()["score"] == 7
        assert "Could not record an AI request" in caplog.text

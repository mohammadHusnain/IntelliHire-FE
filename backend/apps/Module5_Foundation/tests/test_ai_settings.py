import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction

from apps.Module5_Foundation.ai import llm
from apps.Module5_Foundation.ai.config import get_config
from apps.Module5_Foundation.ai.providers.fake import FakeProvider
from apps.Module5_Foundation.models import AISettings, ImmutableRecordError

pytestmark = pytest.mark.django_db


def test_without_a_row_the_django_settings_apply_and_no_row_is_created(settings):
    config = get_config()
    assert (config.provider, config.chat_model, config.eval_model, config.embed_model, config.stt_model) == ("fake", "gpt-4o-mini", "gpt-4o", "text-embedding-3-small", "whisper-1")
    assert (config.timeout_seconds, config.screening_min_score, config.screening_questions, config.technical_questions, config.mock_questions) == (30, 60, 6, 8, 8)
    assert AISettings.objects.count() == 0


def test_an_edited_row_wins_over_settings_and_takes_effect_immediately(template):
    template()
    assert get_config().chat_model == "gpt-4o-mini"
    row = AISettings.load()
    row.chat_model, row.temperature_questions, row.timeout_seconds = "gpt-4.1", 0.1, 45
    row.save()  # the cache is cleared by a signal, so no wait is needed
    config = get_config()
    assert (config.chat_model, config.temperature_questions, config.timeout_seconds) == ("gpt-4.1", 0.1, 45)
    llm.generate_json("score_answer", {"answer": "x"})
    assert FakeProvider.calls[-1]["model"] == "gpt-4.1"


def test_blank_fields_fall_back_per_field():
    AISettings.objects.create(chat_model="gpt-4.1", eval_model="")
    config = get_config()
    assert config.chat_model == "gpt-4.1" and config.eval_model == "gpt-4o"


def test_the_config_is_cached_between_calls(django_assert_num_queries):
    get_config()
    with django_assert_num_queries(0):
        get_config()


def test_deleting_the_settings_row_is_refused_but_a_queryset_delete_clears_the_cache():
    row = AISettings.load()
    with pytest.raises(ImmutableRecordError):
        row.delete()
    AISettings.objects.all().delete()
    assert get_config().chat_model == "gpt-4o-mini"


def test_there_is_only_ever_one_row():
    AISettings.objects.create(screening_min_score=70)
    AISettings(id=2, screening_min_score=80).save()
    assert AISettings.objects.count() == 1 and AISettings.objects.get().screening_min_score == 80
    with pytest.raises(IntegrityError), transaction.atomic():
        AISettings.objects.bulk_create([AISettings(id=2)])


@pytest.mark.parametrize("field,value", [("temperature_questions", 2.5), ("temperature_evaluation", -0.1), ("screening_min_score", 101), ("screening_questions", 2), ("technical_questions", 16), ("mock_questions", 0)])
def test_the_database_refuses_out_of_range_values(field, value):
    with pytest.raises(IntegrityError), transaction.atomic():
        AISettings(**{field: value}).save()


class TestValidation:
    def test_unknown_models_are_rejected(self):
        with pytest.raises(ValidationError) as info:
            AISettings(chat_model="not-a-model", stt_model="also-not").full_clean()
        assert {"chat_model", "stt_model"} <= set(info.value.message_dict)

    def test_allowed_models_pass(self):
        AISettings(chat_model="gpt-4o", embed_model="text-embedding-3-large").full_clean()

    @pytest.mark.parametrize("timeout", [4, 121])
    def test_timeouts_are_bounded(self, timeout):
        with pytest.raises(ValidationError) as info:
            AISettings(timeout_seconds=timeout).full_clean()
        assert "timeout_seconds" in info.value.message_dict

    @pytest.mark.parametrize("tokens", [{"a": 0}, {"a": 9000}, {"a": "5"}, {"a": True}, ["a"]])
    def test_token_caps_must_be_sensible(self, tokens):
        with pytest.raises(ValidationError) as info:
            AISettings(max_tokens=tokens).full_clean()
        assert "max_tokens" in info.value.message_dict

    def test_a_valid_cap_passes_and_is_used(self):
        row = AISettings(max_tokens={"cv_extract": 2000})
        row.full_clean()
        row.save()
        assert get_config().max_tokens_for("cv_extract") == 2000 and get_config().max_tokens_for("other") == 1200

from unittest import mock

import pytest
from django.contrib.auth.models import AnonymousUser
from django.db import transaction

from apps.Module5_Foundation.events import log_event, log_events_bulk
from apps.Module5_Foundation.models import ActivityEvent, ImmutableRecordError

pytestmark = pytest.mark.django_db


def test_an_event_records_who_what_and_where(user_factory, company_factory):
    actor, company = user_factory(), company_factory()
    event = log_event("job.published", actor=actor, company=company, target=company, summary="Job published: Backend")
    assert (event.actor, event.company, event.target_type, event.target_id) == (actor, company, "company", company.pk)
    assert event.summary == "Job published: Backend" and event.created_at


def test_a_system_event_has_no_actor_and_anonymous_users_count_as_none():
    assert log_event("cv.analysed", summary="x").actor is None
    assert log_event("cv.analysed", actor=AnonymousUser(), summary="x").actor is None


def test_explicit_target_fields_work_without_a_model_instance(company_factory):
    company = company_factory()
    event = log_event("job.closed", company=company.pk, target_type="jobposting", target_id=company.pk, summary="x")
    assert event.company_id == company.pk and event.target_type == "jobposting"


@pytest.mark.parametrize("bad", ["", "nodot", "Upper.case", "a.b c", "a..b", None])
def test_a_malformed_event_type_is_a_programming_error(bad):
    with pytest.raises(ValueError):
        log_event(bad, summary="x")


def test_secrets_are_hidden_and_values_become_plain_json(company_factory):
    import datetime
    import uuid

    event = log_event(
        "user.registered",
        summary="x",
        metadata={"password": "hunter2", "Reset_Token": "abc", "resume_text": "my cv", "nested": {"api_key": "k", "ok": 1},
                  "id": uuid.uuid4(), "when": datetime.datetime(2026, 1, 2, 3, 4), "items": [1, "two", None]},
    )  # fmt: skip
    meta = event.metadata
    assert meta["password"] == meta["Reset_Token"] == meta["resume_text"] == "[redacted]"
    assert meta["nested"] == {"api_key": "[redacted]", "ok": 1}
    assert isinstance(meta["id"], str) and meta["when"].startswith("2026-01-02") and meta["items"] == [1, "two", None]
    assert "hunter2" not in str(ActivityEvent.objects.get(pk=event.pk).metadata)


def test_oversized_metadata_is_replaced_not_stored():
    event = log_event("user.registered", summary="x", metadata={f"k{i}": "v" * 400 for i in range(20)})
    assert event.metadata == {"truncated": True}


def test_deeply_nested_metadata_is_cut_off():
    deep = {"a": {"b": {"c": {"d": {"e": 1}}}}}
    assert "[too deep]" in str(log_event("user.registered", summary="x", metadata=deep).metadata)


def test_summary_is_one_clean_line_of_at_most_300_characters():
    event = log_event("user.registered", summary="<b>Hello</b>\nworld\x00 " + "x" * 400)
    assert "\n" not in event.summary and "<b>" not in event.summary and "\x00" not in event.summary
    assert len(event.summary) <= 300 and event.summary.endswith("…")


def test_a_failing_write_is_swallowed_and_does_not_poison_the_transaction(user_factory, caplog):
    with transaction.atomic():
        user = user_factory()
        with mock.patch.object(ActivityEvent.objects, "create", side_effect=RuntimeError("db down")):
            assert log_event("user.registered", summary="x") is None
        user.refresh_from_db()  # the caller's transaction still works
    assert "Could not record activity event" in caplog.text


def test_a_database_error_inside_the_insert_rolls_back_only_the_savepoint():
    from django.db import IntegrityError

    with transaction.atomic():
        with mock.patch.object(ActivityEvent.objects, "create", side_effect=IntegrityError("boom")):
            assert log_event("user.registered", summary="x") is None
        assert ActivityEvent.objects.count() == 0
        log_event("user.registered", summary="after")
    assert ActivityEvent.objects.count() == 1


def test_a_rolled_back_action_leaves_no_event():
    with pytest.raises(RuntimeError):
        with transaction.atomic():
            log_event("user.registered", summary="x")
            raise RuntimeError
    assert ActivityEvent.objects.count() == 0


class TestImmutability:
    def test_saving_an_existing_event_is_refused(self):
        event = log_event("user.registered", summary="x")
        event.summary = "changed"
        with pytest.raises(ImmutableRecordError):
            event.save()

    def test_deleting_is_refused_on_the_model_and_the_queryset(self):
        event = log_event("user.registered", summary="x")
        with pytest.raises(ImmutableRecordError):
            event.delete()
        with pytest.raises(ImmutableRecordError):
            ActivityEvent.objects.all().delete()

    def test_bulk_updates_are_refused(self):
        log_event("user.registered", summary="x")
        with pytest.raises(ImmutableRecordError):
            ActivityEvent.objects.all().update(summary="changed")

    def test_deleting_the_actor_keeps_the_event(self, user_factory):
        actor = user_factory()
        event = log_event("user.registered", actor=actor, summary="x")
        actor.delete()
        event.refresh_from_db()
        assert event.actor is None


class TestBulk:
    def test_one_insert_for_many_events(self, company_factory, django_assert_max_num_queries):
        companies = [company_factory() for _ in range(3)]
        rows = [{"company": c, "target_type": "jobposting", "target_id": c.pk, "summary": f"Job {i}"} for i, c in enumerate(companies)]
        with django_assert_max_num_queries(3):
            assert log_events_bulk("job.closed", rows) == 3
        assert ActivityEvent.objects.filter(event_type="job.closed").count() == 3

    def test_empty_input_does_nothing_and_a_bad_type_raises(self):
        assert log_events_bulk("job.closed", []) == 0
        with pytest.raises(ValueError):
            log_events_bulk("nope", [{"summary": "x"}])

    def test_a_failure_is_swallowed(self):
        with mock.patch.object(ActivityEvent.objects, "bulk_create", side_effect=RuntimeError):
            assert log_events_bulk("job.closed", [{"summary": "x"}]) == 0

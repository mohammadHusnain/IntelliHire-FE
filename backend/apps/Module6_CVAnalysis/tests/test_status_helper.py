"""The compare-and-set status helper and the signals Module 4 gained for this module."""
import threading

import pytest
from django.db import connection

from apps.common.choices import MemberRole
from apps.Module4_ApplicationManagement.models import Application, ApplicationStatusChange
from apps.Module4_ApplicationManagement.services.review import set_status_if
from apps.Module4_ApplicationManagement.signals import application_shortlisted
from apps.Module5_Foundation.models import ActivityEvent, PromptTemplate

from ..models import CVAnalysis, CVMatch
from ..prompts import TEMPLATES

pytestmark = pytest.mark.django_db


def test_it_moves_only_from_the_expected_status(application_factory, job):
    application = application_factory(job)
    assert set_status_if(application.pk, expected="submitted", new_status="under_review", note="auto") is True
    assert set_status_if(application.pk, expected="submitted", new_status="shortlisted") is False
    application.refresh_from_db()
    assert application.status == "under_review"
    last = application.status_history.last()
    assert (last.from_status, last.to_status, last.source, last.changed_by, last.note) == ("submitted", "under_review", "system", None, "auto")
    event = ActivityEvent.objects.get(event_type="application.status_changed")
    assert event.actor is None and event.metadata["source"] == "system"


def test_an_unknown_application_is_simply_not_moved():
    import uuid

    assert set_status_if(uuid.uuid4(), expected="submitted", new_status="under_review") is False


def test_shortlisting_sends_the_signal_whoever_did_it(application_factory, job, clients):
    seen = []
    handler = lambda sender, application, **kw: seen.append(application.pk)  # noqa: E731
    application_shortlisted.connect(handler)
    try:
        first, second = application_factory(job), application_factory(job)
        set_status_if(first.pk, expected="submitted", new_status="shortlisted")
        clients[MemberRole.RECRUITER].patch(f"/api/applications/{second.pk}/status/", {"status": "shortlisted"}, format="json")
        clients[MemberRole.RECRUITER].patch(f"/api/applications/{second.pk}/status/", {"status": "interview"}, format="json")
    finally:
        application_shortlisted.disconnect(handler)
    assert seen == [first.pk, second.pk]


def test_a_failing_listener_never_blocks_a_status_change(application_factory, job):
    def broken(sender, application, **kw):
        raise RuntimeError("listener bug")

    application_shortlisted.connect(broken)
    try:
        application = application_factory(job)
        assert set_status_if(application.pk, expected="submitted", new_status="shortlisted") is True
    finally:
        application_shortlisted.disconnect(broken)


def test_deleting_an_application_removes_its_analysis_and_match(analysed):
    application = analysed()
    application.status_history.all().delete()
    Application.objects.filter(pk=application.pk).delete()
    assert CVAnalysis.objects.count() == 0 and CVMatch.objects.count() == 0


def test_both_prompt_templates_are_seeded_active_and_schema_valid():
    import jsonschema

    for template in TEMPLATES:
        row = PromptTemplate.objects.get(key=template["key"], is_active=True)
        assert row.version == 1
        jsonschema.Draft202012Validator.check_schema(row.output_schema)
    assert PromptTemplate.objects.get(key="cv_extract").placeholders() == {"cv_text"}
    assert PromptTemplate.objects.get(key="cv_explain").placeholders() == {"facts"}


def test_the_scheduled_sweep_is_registered(settings):
    from config.celery import app

    app.loader.import_default_modules()
    assert settings.CELERY_BEAT_SCHEDULE["cv-analysis-sweep"]["task"] in app.tasks


@pytest.mark.django_db(transaction=True)
def test_a_person_and_the_system_racing_never_both_win(application_factory, job, team, auth_client):
    """HR moves an application at the very moment the analysis wants to: exactly one move happens, history stays a chain."""
    _, users = team
    for _ in range(5):
        application = application_factory(job, queued=False)
        barrier, results = threading.Barrier(2), {}

        def system():
            try:
                barrier.wait(timeout=10)
                results["system"] = set_status_if(application.pk, expected="submitted", new_status="under_review", note="auto")
            finally:
                connection.close()

        def person():
            try:
                barrier.wait(timeout=10)
                results["person"] = auth_client(users[MemberRole.RECRUITER]).patch(
                    f"/api/applications/{application.pk}/status/", {"status": "on_hold"}, format="json"
                ).status_code
            finally:
                connection.close()

        threads = [threading.Thread(target=system), threading.Thread(target=person)]
        [t.start() for t in threads]
        [t.join(timeout=30) for t in threads]
        application.refresh_from_db()
        chain = list(ApplicationStatusChange.objects.filter(application=application).order_by("changed_at", "id").values_list("from_status", "to_status"))
        assert results["person"] == 200 and application.status == "on_hold"  # the person's decision always stands
        assert all(chain[i][0] == chain[i - 1][1] for i in range(1, len(chain))), chain
        assert len(chain) == (3 if results["system"] else 2)

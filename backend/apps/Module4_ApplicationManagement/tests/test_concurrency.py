"""Race conditions with real threads and committed transactions."""
import threading

import pytest
from django.db import connection

from apps.common.choices import MemberRole
from apps.Module4_ApplicationManagement.models import Application

from .helpers import app_url, apply_url, form, stored_files

pytestmark = pytest.mark.django_db(transaction=True)


def run_parallel(count, make_call):
    barrier = threading.Barrier(count)
    results = [None] * count

    def worker(index):
        try:
            barrier.wait(timeout=10)
            results[index] = make_call(index)
        except Exception as exc:  # surfaced to the asserting test
            results[index] = exc
        finally:
            connection.close()

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(count)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=60)
    return results


def test_simultaneous_duplicate_submissions_create_exactly_one_application(api_client_factory, open_job):
    def call(_):
        client = api_client_factory()
        return client.post(apply_url(open_job), form(), format="multipart", REMOTE_ADDR="203.0.113.50").status_code

    codes = run_parallel(5, call)
    assert codes.count(201) == 1 and codes.count(400) == 4, codes
    assert Application.objects.count() == 1 and len(stored_files(open_job)) == 1


def test_different_applicants_at_the_same_moment_all_get_unique_references(api_client_factory, open_job):
    def call(index):
        client = api_client_factory()
        return client.post(apply_url(open_job), form(email=f"p{index}@example.com"), format="multipart", REMOTE_ADDR=f"203.0.113.{index + 1}").status_code

    assert run_parallel(6, call) == [201] * 6
    references = list(Application.objects.values_list("reference", flat=True))
    assert len(references) == len(set(references)) == 6 and len(stored_files(open_job)) == 6


def test_concurrent_status_changes_keep_a_consistent_history_chain(team, auth_client, api_client_factory, open_job):
    _, users = team
    response = api_client_factory().post(apply_url(open_job), form(), format="multipart")
    application = Application.objects.get(reference=response.json()["reference"])
    targets = ["under_review", "shortlisted", "interview", "selected"]

    def call(index):
        return auth_client(users[MemberRole.RECRUITER]).patch(
            app_url(application, "status"), {"status": targets[index]}, format="json"
        ).status_code

    codes = run_parallel(4, call)
    assert codes.count(200) == 4, codes
    history = list(application.status_history.values_list("from_status", "to_status"))
    assert len(history) == 5
    assert all(history[i][0] == history[i - 1][1] for i in range(1, len(history)))
    application.refresh_from_db()
    assert application.status == history[-1][1]


def test_submitting_while_the_job_closes_never_saves_after_the_close(team, auth_client, api_client_factory, open_job):
    _, users = team

    def call(index):
        if index == 0:
            return auth_client(users[MemberRole.ADMIN]).post(f"/api/jobs/{open_job.pk}/close/").status_code
        client = api_client_factory()
        return client.post(apply_url(open_job), form(email=f"x{index}@example.com"), format="multipart", REMOTE_ADDR=f"203.0.113.{index}").status_code

    codes = run_parallel(4, call)
    assert codes[0] == 200 and all(code in (201, 410) for code in codes[1:]), codes
    assert Application.objects.count() == codes[1:].count(201)
    assert len(stored_files(open_job)) == Application.objects.count()

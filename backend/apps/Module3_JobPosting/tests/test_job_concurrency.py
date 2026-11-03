"""Race conditions with real threads and committed transactions."""
import threading

import pytest
from django.db import connection

from apps.common.choices import MemberRole
from apps.Module3_JobPosting.models import ApplicationField, JobPosting

from .helpers import future, job_url

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
        thread.join(timeout=30)
    return results


def test_concurrent_publish_opens_the_job_exactly_once(team, auth_client, job_factory):
    company, users = team
    job = job_factory(company, users[MemberRole.ADMIN], deadline=future(14))

    def call(_):
        return auth_client(users[MemberRole.RECRUITER]).post(job_url(job, "publish")).status_code

    codes = run_parallel(6, call)
    assert codes.count(200) == 1 and codes.count(409) == 5, codes
    job.refresh_from_db()
    assert job.status == "open" and job.form_slug


def test_concurrent_field_adds_get_distinct_keys_and_orders(team, auth_client, job_factory):
    company, users = team
    job = job_factory(company, users[MemberRole.ADMIN])

    def call(_):
        return auth_client(users[MemberRole.ADMIN]).post(
            job_url(job, "fields"), {"label": "Portfolio", "field_type": "url"}, format="json"
        ).status_code

    codes = run_parallel(5, call)
    assert codes == [201] * 5, codes
    keys = sorted(ApplicationField.objects.filter(job=job).values_list("key", flat=True))
    orders = sorted(ApplicationField.objects.filter(job=job).values_list("order", flat=True))
    assert keys == ["portfolio", "portfolio_2", "portfolio_3", "portfolio_4", "portfolio_5"]
    assert orders == [0, 1, 2, 3, 4]


def test_concurrent_close_and_delete_never_leave_a_half_state(team, auth_client, job_factory):
    company, users = team
    job = job_factory(company, users[MemberRole.ADMIN], status="open")

    def call(index):
        client = auth_client(users[MemberRole.ADMIN])
        return client.post(job_url(job, "close")).status_code if index % 2 == 0 else client.delete(job_url(job)).status_code

    codes = run_parallel(4, call)
    assert codes.count(200) == 1 and all(code in (200, 409) for code in codes), codes
    job.refresh_from_db()
    assert job.status == "closed" and job.close_reason == "manual"
    assert JobPosting.objects.filter(pk=job.pk).exists()


def test_distinct_jobs_published_together_get_distinct_slugs(team, auth_client, job_factory):
    company, users = team
    jobs = [job_factory(company, users[MemberRole.ADMIN], deadline=future(14)) for _ in range(6)]

    def call(index):
        return auth_client(users[MemberRole.ADMIN]).post(job_url(jobs[index], "publish")).status_code

    assert run_parallel(6, call) == [200] * 6
    slugs = list(JobPosting.objects.filter(company=company).values_list("form_slug", flat=True))
    assert len(slugs) == len(set(slugs)) == 6

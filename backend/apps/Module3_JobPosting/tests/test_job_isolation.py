"""Company B must never see or change Company A's jobs: every company-side endpoint answers 404 (Doc §Build order)."""
import pytest

from apps.common.choices import MemberRole

from .helpers import JOBS, future, job_url, payload

pytestmark = pytest.mark.django_db


@pytest.fixture
def world(team, job_factory, member_factory, auth_client):
    company, users = team
    draft = job_factory(company, users[MemberRole.ADMIN], deadline=future(14), fields=[{"label": "X", "key": "x", "field_type": "short_text"}])
    opened = job_factory(company, users[MemberRole.ADMIN], status="open", fields=[{"label": "Y", "key": "y", "field_type": "short_text"}])
    closed = job_factory(company, users[MemberRole.ADMIN], status="closed")
    outsider = member_factory(MemberRole.ADMIN)
    return {"draft": draft, "open": opened, "closed": closed, "outsider": auth_client(outsider), "owner": auth_client(users[MemberRole.ADMIN])}


def test_company_b_never_sees_company_a_jobs(world):
    assert world["outsider"].get(JOBS).json()["count"] == 0
    assert world["owner"].get(JOBS).json()["count"] == 3


@pytest.mark.parametrize(
    "method,suffix,body",
    [
        ("get", "", None),
        ("patch", "", {"title": "Hacked"}),
        ("delete", "", None),
        ("post", "publish", None),
        ("post", "close", None),
        ("post", "reopen", {"deadline": "2999-01-01T00:00:00Z"}),
        ("post", "duplicate", None),
        ("get", "form-preview", None),
        ("get", "fields", None),
        ("post", "fields", {"label": "Evil", "field_type": "url"}),
        ("post", "fields/reorder", {"field_ids": []}),
    ],
)
@pytest.mark.parametrize("which", ["draft", "open", "closed"])
def test_every_job_endpoint_is_404_for_another_company(world, method, suffix, body, which):
    job = world[which]
    kwargs = {"format": "json"} if body is not None else {}
    response = getattr(world["outsider"], method)(job_url(job, suffix), *([body] if body is not None else []), **kwargs)
    assert response.status_code == 404, (method, suffix, which, response.content)


@pytest.mark.parametrize("method,body", [("patch", {"label": "Hacked"}), ("delete", None)])
def test_field_detail_endpoints_are_404_for_another_company(world, method, body):
    field = world["draft"].custom_fields.get()
    response = getattr(world["outsider"], method)(job_url(world["draft"], f"fields/{field.pk}"), *([body] if body else []), **({"format": "json"} if body else {}))
    assert response.status_code == 404
    assert world["draft"].custom_fields.filter(pk=field.pk).exists()


def test_nothing_changed_after_all_the_attempts(world):
    from apps.Module3_JobPosting.models import JobPosting

    for which in ("draft", "open", "closed"):
        job = world[which]
        before = (job.title, job.status, job.deadline, job.form_slug, job.custom_fields.count())
        for suffix in ("publish", "close", "duplicate"):
            world["outsider"].post(job_url(job, suffix))
        world["outsider"].patch(job_url(job), {"title": "Hacked"}, format="json")
        world["outsider"].delete(job_url(job))
        job = JobPosting.objects.get(pk=job.pk)
        assert (job.title, job.status, job.deadline, job.form_slug, job.custom_fields.count()) == before
    assert JobPosting.objects.count() == 3  # no duplicate was created


def test_not_found_and_other_companys_job_look_identical(world):
    foreign = world["outsider"].get(job_url(world["open"]))
    missing = world["outsider"].get(job_url("00000000-0000-0000-0000-000000000000"))
    assert foreign.status_code == missing.status_code == 404 and foreign.json() == missing.json()


def test_a_field_id_of_another_company_cannot_be_reordered_into_my_job(world, member_factory, auth_client, job_factory):
    outsider_admin = member_factory(MemberRole.ADMIN)
    mine = job_factory(outsider_admin.company_membership.company, outsider_admin)
    foreign_field = world["draft"].custom_fields.get()
    response = auth_client(outsider_admin).post(job_url(mine, "fields/reorder"), {"field_ids": [foreign_field.pk]}, format="json")
    assert response.status_code == 400
    foreign_field.refresh_from_db()
    assert foreign_field.job == world["draft"]


def test_publishing_with_another_companys_company_id_in_the_body_is_ignored(world, team):
    company, _ = team
    created = world["owner"].post(JOBS, payload(company="00000000-0000-0000-0000-000000000000"), format="json")
    assert created.status_code == 201
    from apps.Module3_JobPosting.models import JobPosting

    assert JobPosting.objects.get(pk=created.json()["id"]).company == company

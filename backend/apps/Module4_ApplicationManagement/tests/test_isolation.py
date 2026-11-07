"""TC-22 and the isolation rule: Company B must get 404 on every company-side endpoint for Company A's data."""
import pytest

from apps.common.choices import MemberRole
from apps.Module4_ApplicationManagement.models import Application

from .conftest import full_answers
from .helpers import APPLICATIONS, app_url, apply_url, job_url

pytestmark = pytest.mark.django_db


@pytest.fixture
def world(api_client, clients, form_job, member_factory, auth_client):
    reference = api_client.post(apply_url(form_job), full_answers(), format="multipart").json()["reference"]
    application = Application.objects.get(reference=reference)
    outsider = member_factory(MemberRole.ADMIN)
    return {"job": form_job, "application": application, "owner": clients[MemberRole.ADMIN], "outsider": auth_client(outsider)}


def test_tc22_hr_of_the_owning_company_sees_the_application_and_downloads_the_cv(world):
    application, owner = world["application"], world["owner"]
    assert owner.get(app_url(application)).status_code == 200
    assert owner.get(APPLICATIONS).json()["count"] == 1
    response = owner.get(app_url(application, "resume"))
    assert response.status_code == 200 and b"".join(response.streaming_content).startswith(b"%PDF")


def test_tc22_hr_of_another_company_gets_404(world):
    application, outsider = world["application"], world["outsider"]
    assert outsider.get(app_url(application)).status_code == 404
    assert outsider.get(app_url(application, "resume")).status_code == 404


@pytest.mark.parametrize(
    "method,suffix,body",
    [
        ("get", "", None),
        ("get", "resume", None),
        ("get", "files/portfolio", None),
        ("patch", "status", {"status": "rejected"}),
    ],
)
def test_every_application_endpoint_is_404_for_another_company(world, method, suffix, body):
    kwargs = {"format": "json"} if body else {}
    response = getattr(world["outsider"], method)(app_url(world["application"], suffix), *([body] if body else []), **kwargs)
    assert response.status_code == 404, response.content
    world["application"].refresh_from_db()
    assert world["application"].status == "submitted"


@pytest.mark.parametrize("suffix", ["applications", "applications/export"])
def test_job_scoped_endpoints_are_404_for_another_company(world, suffix):
    assert world["outsider"].get(job_url(world["job"], suffix)).status_code == 404


def test_the_company_wide_list_is_empty_for_another_company(world):
    assert world["outsider"].get(APPLICATIONS).json()["count"] == 0
    assert world["outsider"].get(APPLICATIONS, {"job": str(world["job"].pk)}).json()["count"] == 0


def test_not_found_and_another_companys_application_look_identical(world):
    foreign = world["outsider"].get(app_url(world["application"]))
    missing = world["outsider"].get(f"{APPLICATIONS}00000000-0000-0000-0000-000000000000/")
    assert foreign.status_code == missing.status_code == 404 and foreign.json() == missing.json()


def test_nothing_changed_after_the_attempts(world):
    application = world["application"]
    before = (application.status, application.status_history.count())
    world["outsider"].patch(app_url(application, "status"), {"status": "selected"}, format="json")
    application.refresh_from_db()
    assert (application.status, application.status_history.count()) == before

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.common.tests.helpers import make_pdf

pytestmark = pytest.mark.django_db
RESUME = "/api/auth/profile/resume/"
PROFILE = "/api/auth/profile/"


@pytest.fixture
def candidate_client(auth_client, user_factory):
    from apps.accounts.models import CandidateProfile

    user = user_factory()
    CandidateProfile.objects.create(user=user)
    return auth_client(user)


def test_an_upload_larger_than_the_request_limit_is_refused_before_it_is_stored(candidate_client, settings):
    settings.MAX_REQUEST_BYTES = 2 * 1024
    response = candidate_client.put(RESUME, {"resume": SimpleUploadedFile("cv.pdf", make_pdf() + b"0" * 5000)}, format="multipart")
    assert response.status_code == 413
    assert response.json() == {"detail": "The request is too large.", "code": "request_too_large"}


def test_the_limit_applies_to_every_multipart_endpoint(candidate_client, settings):
    settings.MAX_REQUEST_BYTES = 100
    response = candidate_client.patch(PROFILE, {"headline": "x" * 500}, format="multipart")
    assert response.status_code == 413


def test_requests_within_the_limit_are_unaffected(candidate_client):
    response = candidate_client.put(RESUME, {"resume": SimpleUploadedFile("cv.pdf", make_pdf())}, format="multipart")
    assert response.status_code == 200


def test_json_requests_are_not_subject_to_the_multipart_limit(candidate_client, settings):
    settings.MAX_REQUEST_BYTES = 10
    assert candidate_client.patch(PROFILE, {"headline": "x" * 100}, format="json").status_code == 200

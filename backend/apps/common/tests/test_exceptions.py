from rest_framework import exceptions

from apps.common.exceptions import api_exception_handler


def handle(exc):
    return api_exception_handler(exc, {})


def test_not_found_has_detail_and_code():
    response = handle(exceptions.NotFound())
    assert response.status_code == 404
    assert response.data == {"detail": "Not found.", "code": "not_found"}


def test_permission_denied_keeps_custom_message():
    response = handle(exceptions.PermissionDenied("Unauthorized access."))
    assert response.status_code == 403
    assert response.data == {"detail": "Unauthorized access.", "code": "permission_denied"}


def test_authentication_failed_and_throttled_have_codes():
    assert handle(exceptions.AuthenticationFailed()).data["code"] == "authentication_failed"
    throttled = handle(exceptions.Throttled(wait=30))
    assert throttled.status_code == 429
    assert throttled.data["code"] == "throttled"


def test_field_errors_keep_default_shape():
    response = handle(exceptions.ValidationError({"email": ["Email already registered."]}))
    assert response.status_code == 400
    assert response.data == {"email": ["Email already registered."]}


def test_bare_validation_error_is_wrapped_as_non_field_errors():
    response = handle(exceptions.ValidationError(["Something is wrong."]))
    assert response.data == {"non_field_errors": ["Something is wrong."]}


def test_unknown_exceptions_are_left_to_django():
    assert handle(RuntimeError("boom")) is None

import importlib
from datetime import timedelta
from io import StringIO

import pytest
from django.core.management import call_command
from django.test import RequestFactory
from django.urls import clear_url_caches

from apps.common import views


def test_core_settings(settings):
    assert settings.AUTH_USER_MODEL == "accounts.User"
    assert settings.USE_TZ is True and settings.TIME_ZONE == "UTC"
    assert settings.MIDDLEWARE[0] == "corsheaders.middleware.CorsMiddleware"
    assert settings.DATABASES["default"]["ENGINE"] == "django.db.backends.postgresql"
    assert settings.CORS_ALLOW_CREDENTIALS is False
    assert settings.PASSWORD_RESET_TIMEOUT == 3600
    min_length = [v for v in settings.AUTH_PASSWORD_VALIDATORS if "MinimumLength" in v["NAME"]][0]
    assert min_length["OPTIONS"]["min_length"] == 8


def test_jwt_settings(settings):
    jwt = settings.SIMPLE_JWT
    assert jwt["ACCESS_TOKEN_LIFETIME"] == timedelta(minutes=15)
    assert jwt["REFRESH_TOKEN_LIFETIME"] == timedelta(days=7)
    assert jwt["ROTATE_REFRESH_TOKENS"] and jwt["BLACKLIST_AFTER_ROTATION"]


def test_rest_framework_defaults(settings):
    rf = settings.REST_FRAMEWORK
    assert rf["DEFAULT_PERMISSION_CLASSES"] == ["rest_framework.permissions.IsAuthenticated"]
    assert rf["PAGE_SIZE"] == 20
    assert rf["NUM_PROXIES"] == 0
    assert rf["DEFAULT_AUTHENTICATION_CLASSES"] == ["apps.Module1_Authentication.authentication.StatusAwareJWTAuthentication"]
    assert rf["DEFAULT_THROTTLE_RATES"] == {
        "login": "5/min",
        "register": "10/hour",
        "password_reset": "3/hour",
        "password_reset_confirm": "10/hour",
        "resend_verification": "3/hour",
        "public_apply": "10/hour",
    }


def test_the_schema_documents_bearer_authentication(client):
    schema = client.get("/api/schema/?format=json").json()
    assert schema["components"]["securitySchemes"]["jwtAuth"] == {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}


def test_swagger_and_schema_are_served(client):
    assert client.get("/api/docs/").status_code == 200
    assert client.get("/api/schema/").status_code == 200


def test_openapi_schema_generates_without_warnings():
    call_command("spectacular", "--validate", "--fail-on-warn", stdout=StringIO())


def test_api_docs_can_be_disabled(settings, client):
    import config.urls

    settings.API_DOCS_ENABLED = False
    importlib.reload(config.urls)
    clear_url_caches()
    try:
        assert client.get("/api/docs/").status_code == 404
        assert client.get("/api/schema/").status_code == 404
    finally:
        settings.API_DOCS_ENABLED = True
        importlib.reload(config.urls)
        clear_url_caches()


def test_unknown_api_path_returns_json_404(client):
    response = client.get("/api/does-not-exist/")
    assert response.status_code == 404
    assert response.json() == {"detail": "Not found.", "code": "not_found"}


def test_unknown_non_api_path_is_not_json(client):
    response = client.get("/does-not-exist/")
    assert response.status_code == 404
    assert "application/json" not in response["Content-Type"]


def test_server_error_handler_never_leaks_details():
    request = RequestFactory().get("/api/anything/")
    response = views.api_server_error(request)
    assert response.status_code == 500
    assert response.content == b'{"detail": "A server error occurred.", "code": "server_error"}'
    assert views.api_server_error(RequestFactory().get("/other/")).status_code == 500

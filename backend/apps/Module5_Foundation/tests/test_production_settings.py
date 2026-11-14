import os
import subprocess
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[3]
BASE_ENV = {
    "DJANGO_SETTINGS_MODULE": "config.settings.production",
    "SECRET_KEY": "x" * 50,
    "DATABASE_URL": "postgres://u:p@localhost/db",
    "FRONTEND_URL": "https://app.example",
    "ALLOWED_HOSTS": "api.example",
    "EMAIL_HOST": "smtp.example",
    "AI_PROVIDER": "openai",
    "OPENAI_API_KEY": "sk-test",
    "GEMINI_API_KEY": "g-test",
    "CELERY_TASK_ALWAYS_EAGER": "false",
}


def start(**overrides):
    env = {**os.environ, **BASE_ENV, **overrides}
    return subprocess.run([sys.executable, "-I", "-c", "import sys; sys.path.insert(0, '.'); import config.settings.production"], cwd=BACKEND, env=env, capture_output=True, text=True)


def test_a_complete_production_setup_starts():
    assert start().returncode == 0


def test_gemini_as_the_scoring_provider_starts_too():
    assert start(AI_PROVIDER="gemini", OPENAI_API_KEY="").returncode == 0


@pytest.mark.parametrize(
    "overrides,message",
    [
        ({"CELERY_TASK_ALWAYS_EAGER": "true"}, "CELERY_TASK_ALWAYS_EAGER"),
        ({"AI_PROVIDER": "fake"}, "fake provider"),
        ({"OPENAI_API_KEY": ""}, "OPENAI_API_KEY"),
        ({"AI_PROVIDER": "gemini", "GEMINI_API_KEY": ""}, "GEMINI_API_KEY"),
        ({"GEMINI_API_KEY": ""}, "live screening and technical interviews"),
    ],
)
def test_production_refuses_to_start_with_unsafe_background_or_ai_settings(overrides, message):
    result = start(**overrides)
    assert result.returncode != 0 and message in result.stderr

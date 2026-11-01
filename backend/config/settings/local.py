from .base import *  # noqa: F403

DEBUG = env.bool("DEBUG", default=True)  # noqa: F405
API_DOCS_ENABLED = env.bool("API_DOCS_ENABLED", default=True)  # noqa: F405
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])  # noqa: F405

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

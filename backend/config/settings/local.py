from .base import *  # noqa: F403

DEBUG = env.bool("DEBUG", default=True)  # noqa: F405
API_DOCS_ENABLED = env.bool("API_DOCS_ENABLED", default=True)  # noqa: F405
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])  # noqa: F405

# Console by default (the link is printed in the terminal). Set EMAIL_BACKEND to
# django.core.mail.backends.smtp.EmailBackend, plus the EMAIL_* values, to send real mail locally.
EMAIL_BACKEND = env("EMAIL_BACKEND", default="django.core.mail.backends.console.EmailBackend")  # noqa: F405
EMAIL_HOST = env("EMAIL_HOST", default="")  # noqa: F405
EMAIL_PORT = env.int("EMAIL_PORT", default=587)  # noqa: F405
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")  # noqa: F405
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")  # noqa: F405
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)  # noqa: F405
EMAIL_TIMEOUT = 10

CELERY_TASK_ALWAYS_EAGER = env.bool("CELERY_TASK_ALWAYS_EAGER", default=True)  # noqa: F405

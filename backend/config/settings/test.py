import os
import tempfile

os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")
os.environ.setdefault("FRONTEND_URL", "http://localhost:5173")

from .base import *  # noqa: E402, F403

DEBUG = False
API_DOCS_ENABLED = True

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}

_media = tempfile.mkdtemp(prefix="intellihire-test-media-")
MEDIA_ROOT = os.path.join(_media, "public")
PRIVATE_MEDIA_ROOT = os.path.join(_media, "private")

CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
AI_PROVIDER = "fake"
AI_FALLBACK_PROVIDER = ""
AI_RETRY_DELAY_SECONDS = 0

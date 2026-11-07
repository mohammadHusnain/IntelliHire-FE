from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parents[2]

env = environ.Env()
if (BASE_DIR / ".env").exists():
    environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("SECRET_KEY")
DEBUG = env.bool("DEBUG", default=False)
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=[])

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
    "apps.common",
    "apps.Module1_Authentication",
    "apps.Module2_CompanyManagement",
    "apps.Module3_JobPosting",
    "apps.Module4_ApplicationManagement",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

DATABASES = {"default": env.db("DATABASE_URL")}
DATABASES["default"]["CONN_MAX_AGE"] = env.int("DB_CONN_MAX_AGE", default=60)
DATABASES["default"]["CONN_HEALTH_CHECKS"] = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
        "OPTIONS": {"user_attributes": ("email", "full_name")},
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 8},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
PASSWORD_RESET_TIMEOUT = 60 * 60
EMAIL_VERIFICATION_MAX_AGE = 24 * 60 * 60
STAFF_INVITE_EXPIRY_DAYS = 7
COMPANY_EMAIL_BLOCKED_DOMAINS = [d.lower() for d in env.list("COMPANY_EMAIL_BLOCKED_DOMAINS", default=[])]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / env("MEDIA_ROOT", default="media")
PRIVATE_MEDIA_ROOT = BASE_DIR / env("PRIVATE_MEDIA_ROOT", default="private_media")

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "private": {"BACKEND": "apps.common.storage.PrivateFileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}

CV_MAX_UPLOAD_BYTES = 5 * 1024 * 1024
IMAGE_MAX_UPLOAD_BYTES = 2 * 1024 * 1024
MAX_REQUEST_BYTES = 12 * 1024 * 1024

FRONTEND_URL = env("FRONTEND_URL").rstrip("/")
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="IntelliHire <no-reply@localhost>")

CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=["http://localhost:5173"])
CORS_ALLOW_CREDENTIALS = False

API_DOCS_ENABLED = env.bool("API_DOCS_ENABLED", default=False)

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["apps.Module1_Authentication.authentication.StatusAwareJWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
        "apps.common.parsers.LimitedMultiPartParser",
    ],
    "DEFAULT_PAGINATION_CLASS": "apps.common.pagination.StandardPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "apps.common.exceptions.api_exception_handler",
    "NUM_PROXIES": env.int("NUM_PROXIES", default=0),
    "DEFAULT_THROTTLE_RATES": {
        "login": "5/min",
        "register": "10/hour",
        "password_reset": "3/hour",
        "password_reset_confirm": "10/hour",
        "resend_verification": "3/hour",
        "public_apply": "10/hour",
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": False,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

SPECTACULAR_SETTINGS = {
    "TITLE": "IntelliHire API",
    "DESCRIPTION": "Backend API for the IntelliHire recruitment platform (Phase 1).",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "ENUM_NAME_OVERRIDES": {
        "UserStatusEnum": "apps.common.choices.UserStatus.choices",
        "CompanyStatusEnum": "apps.common.choices.CompanyStatus.choices",
        "InvitationStatusEnum": "apps.Module2_CompanyManagement.models.InvitationStatus.choices",
        "UserRoleEnum": "apps.common.choices.UserRole.choices",
        "MemberRoleEnum": "apps.common.choices.MemberRole.choices",
        "JobStatusEnum": "apps.Module3_JobPosting.models.JobStatus.choices",
        "EmploymentTypeEnum": "apps.Module3_JobPosting.models.EmploymentType.choices",
        "WorkModeEnum": "apps.Module3_JobPosting.models.WorkMode.choices",
        "EducationLevelEnum": "apps.Module3_JobPosting.models.EducationLevel.choices",
        "CloseReasonEnum": "apps.Module3_JobPosting.models.CloseReason.choices",
        "FieldTypeEnum": "apps.Module3_JobPosting.models.FieldType.choices",
        "ApplicationStatusEnum": "apps.Module4_ApplicationManagement.models.ApplicationStatus.choices",
    },
}

LOG_LEVEL = env("LOG_LEVEL", default="INFO")
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {"format": "%(asctime)s %(levelname)s %(name)s: %(message)s"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "standard"},
    },
    "root": {"handlers": ["console"], "level": LOG_LEVEL},
    "loggers": {
        "django.request": {"handlers": ["console"], "level": "WARNING", "propagate": False},
    },
}

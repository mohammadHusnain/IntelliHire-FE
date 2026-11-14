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
    "channels",  # websockets for the live interview; no channel layer is needed (no group fan-out)
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
    "apps.Module5_Foundation",
    "apps.Module6_CVAnalysis",
    "apps.Module7_Interviews",
    "apps.Module8_TechnicalInterview",
    "apps.Module9_Evaluation",
    "apps.Module10_Tracking",
    "apps.Module11_MockInterview",
    "apps.Module12_Communities",
    "apps.Module13_PlatformAdmin",
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
        "notifications": "120/min",
        "interview_open": "120/min",
        "interview_start": "10/hour",
        "interview_answer": "60/min",
        "track_open": "120/min",
        "track_link": "10/hour",
        "track_request": "3/hour",
        "report_content": "5/hour",
        "report_public": "5/hour",
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
        "InterviewStatusEnum": "apps.Module7_Interviews.models.SessionStatus.choices",
        "InterviewKindEnum": "apps.Module7_Interviews.models.SessionKind.choices",
        "FlagTargetEnum": "apps.Module13_PlatformAdmin.models.FlagTarget.choices",
        "FlagStatusEnum": "apps.Module13_PlatformAdmin.models.FlagStatus.choices",
        "CommunityStatusEnum": "apps.Module12_Communities.models.CommunityStatus.choices",
        "CommunityJoinModeEnum": "apps.Module12_Communities.models.JoinMode.choices",
        "MockInterviewTypeEnum": "apps.Module11_MockInterview.models.InterviewType.choices",
        "HRDecisionEnum": "apps.Module9_Evaluation.models.Decision.choices",
        "ReportStatusEnum": "apps.Module9_Evaluation.models.ReportStatus.choices",
        "EvaluationRecommendationEnum": "apps.Module9_Evaluation.models.Recommendation.choices",
        "MissingStagePolicyEnum": "apps.Module9_Evaluation.models.MissingStagePolicy.choices",
    },
}

# --- Background tasks (Celery) -------------------------------------------------------------------------------
# Eager mode runs tasks inline (no Redis needed): local development and tests. Production runs a worker and beat.
CELERY_BROKER_URL = env("CELERY_BROKER_URL", default="redis://localhost:6379/0")
CELERY_TASK_ALWAYS_EAGER = env.bool("CELERY_TASK_ALWAYS_EAGER", default=False)
CELERY_TASK_EAGER_PROPAGATES = False
CELERY_TASK_ACKS_LATE = True
CELERY_TASK_REJECT_ON_WORKER_LOST = True
CELERY_TASK_SOFT_TIME_LIMIT = 240
CELERY_TASK_TIME_LIMIT = 300
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True
# A dead broker must slow a web request by about a second, never hang it.
CELERY_TASK_PUBLISH_RETRY_POLICY = {"max_retries": 1, "interval_start": 0, "interval_step": 0.2, "interval_max": 0.5}
CELERY_BROKER_TRANSPORT_OPTIONS = {"socket_connect_timeout": 2, "socket_timeout": 5, "visibility_timeout": 3600}
CELERY_BEAT_SCHEDULE = {
    "foundation-retry-failed-emails": {"task": "foundation.retry_failed_emails", "schedule": 600.0},
    "foundation-check-alerts": {"task": "foundation.check_alerts", "schedule": 300.0},
    "foundation-worker-heartbeat": {"task": "foundation.worker_heartbeat", "schedule": 60.0},
    "foundation-purge-email-bodies": {"task": "foundation.purge_email_bodies", "schedule": 86400.0},
    "jobs-close-expired": {"task": "foundation.close_expired_jobs", "schedule": 300.0},
    "cv-analysis-sweep": {"task": "cv_analysis.sweep", "schedule": 300.0},
    "interviews-sweep": {"task": "interviews.sweep", "schedule": 300.0},
    "evaluation-sweep": {"task": "evaluation.sweep", "schedule": 300.0},
    "tracking-sweep": {"task": "tracking.sweep", "schedule": 900.0},
    "communities-sweep": {"task": "communities.sweep", "schedule": 900.0},
}

# --- Email outbox -----------------------------------------------------------------------------------------------
EMAIL_OUTBOX_MAX_ATTEMPTS = 5
EMAIL_RETRY_DELAYS_MINUTES = [1, 5, 15, 60, 240]
EMAIL_SENDING_STALE_MINUTES = 15
EMAIL_SENSITIVE_BODY_RETENTION_DAYS = 7
EMAIL_ROW_RETENTION_DAYS = 90
EMAIL_MAX_BODY_CHARS = 200_000

# --- AI services (see Module5_Foundation.ai) --------------------------------------------------------------------
AI_PROVIDER = env("AI_PROVIDER", default="fake")  # openai | gemini | fake
AI_FALLBACK_PROVIDER = env("AI_FALLBACK_PROVIDER", default="")
OPENAI_API_KEY = env("OPENAI_API_KEY", default="")
AI_CHAT_MODEL = env("AI_CHAT_MODEL", default="gpt-4o-mini")
AI_EVAL_MODEL = env("AI_EVAL_MODEL", default="gpt-4o")
AI_EMBED_MODEL = env("AI_EMBED_MODEL", default="text-embedding-3-small")

# --- Live voice interview (Module 7, Gemini Live API) -----------------------------------------------------------
# The live call is a bidirectional audio stream, so it cannot go through `ai.llm.generate_json`.
# `Module7_Interviews/live/gemini.py` is the only other place an AI SDK is imported; it logs to AIRequestLog.
GEMINI_API_KEY = env("GEMINI_API_KEY", default="")
GEMINI_LIVE_MODEL = env("GEMINI_LIVE_MODEL", default="gemini-3.8-live")
GEMINI_CHAT_MODEL = env("GEMINI_CHAT_MODEL", default="gemini-2.5-flash")
# A ceiling no kind may exceed, however its rules are configured.
LIVE_INTERVIEW_MAX_SECONDS = env.int("LIVE_INTERVIEW_MAX_SECONDS", default=900)
# Audio formats the browser and Gemini agree on; changing these means changing the worklet too.
LIVE_INPUT_SAMPLE_RATE = 16000
LIVE_OUTPUT_SAMPLE_RATE = 24000
AI_STT_MODEL = env("AI_STT_MODEL", default="whisper-1")
AI_ALLOWED_MODELS = env.list(
    "AI_ALLOWED_MODELS",
    default=["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1", "text-embedding-3-small", "text-embedding-3-large", "whisper-1"],
)
AI_TIMEOUT_SECONDS = 30
AI_RETRY_DELAY_SECONDS = 10
AI_MAX_OUTPUT_TOKENS = 1200
AI_MAX_INPUT_CHARS = 12_000

# --- CV analysis (Module6_CVAnalysis) -----------------------------------------------------------------------------
CV_PARSER_VERSION = "1"
CV_MIN_TEXT_CHARS = 200  # less readable text than this means a scanned or empty CV: manual review
CV_ANALYSIS_MAX_ATTEMPTS = 3
CV_ANALYSIS_RETRY_MINUTES = 5
CV_ANALYSIS_STALE_MINUTES = 15
CV_ANALYSIS_DAILY_LIMIT = env.int("CV_ANALYSIS_DAILY_LIMIT", default=500)  # per company per UTC day; 0 = no limit
CV_SKILL_LIST_SUSPICIOUS = 60
# Cosine similarity is rescaled so LOW maps to 0 and HIGH to 100. Calibrate on real CVs with the real model.
CV_SEMANTIC_LOW = env.float("CV_SEMANTIC_LOW", default=0.2)
CV_SEMANTIC_HIGH = env.float("CV_SEMANTIC_HIGH", default=0.8)

# --- Interviews (Module7_Interviews) ------------------------------------------------------------------------------
INTERVIEW_LINK_VALID_DAYS = 7  # the candidate must start within this time (UC-08 EX-01)
INTERVIEW_IDLE_MINUTES = 30  # without activity an in-progress interview is marked interrupted
INTERVIEW_MAX_ANSWER_CHARS = 3000
INTERVIEW_MAX_AUDIO_SECONDS = 120
INTERVIEW_MAX_AUDIO_BYTES = 10 * 1024 * 1024
INTERVIEW_MIN_ANSWERS_TO_FINISH = 3
INTERVIEW_VOICE_ENABLED = env.bool("INTERVIEW_VOICE_ENABLED", default=False)  # turn on once the transcribe hook is merged
INTERVIEW_EVAL_MAX_ATTEMPTS = 3
INTERVIEW_EVAL_RETRY_MINUTES = 5
INTERVIEW_EVAL_STALE_MINUTES = 15
INTERVIEW_AI_OUTAGE_SECONDS = 120  # a technical interview is interrupted after the question hook has failed this long
INTERVIEW_AI_RETRY_AFTER = 120
INTERVIEW_EVAL_PARKED_HOURS = 6  # with no scoring hook merged, look at unevaluated interviews again this often

# --- Evaluation (Module9_Evaluation) ------------------------------------------------------------------------------
EVALUATION_REPORT_MAX_ATTEMPTS = 3
EVALUATION_REPORT_RETRY_MINUTES = 5
EVALUATION_REPORT_STALE_MINUTES = 15

# --- Mock interview (Module11_MockInterview) ---------------------------------------------------------------------
MOCK_SESSIONS_PER_DAY = 5  # per candidate, to control cost; a session ended before 3 answers does not count
MOCK_MIN_QUESTIONS = 8
MOCK_MAX_QUESTIONS = 10
MOCK_CV_EXCERPT_CHARS = 3000
MOCK_TREND_THRESHOLD = 2  # points between the last 3 scores and the 3 before that for "improving" or "declining"

# --- Tracking (Module10_Tracking) ---------------------------------------------------------------------------------
TRACKING_REMINDER_HOURS = 48  # an unstarted interview gets one reminder this long before it expires
TRACKING_LINKS_PER_EMAIL_PER_HOUR = 3  # lost-link emails to one address, however many people ask

LOG_LEVEL = env("LOG_LEVEL", default="INFO")
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {"format": "%(asctime)s %(levelname)s %(name)s: %(message)s"},
    },
    "filters": {"redact_tokens": {"()": "apps.common.log_filters.RedactTokens"}},
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "standard", "filters": ["redact_tokens"]},
    },
    "root": {"handlers": ["console"], "level": LOG_LEVEL},
    "loggers": {
        "django.request": {"handlers": ["console"], "level": "WARNING", "propagate": False},
        # The development server's access lines carry the request path, which for a private link is its credential.
        "django.server": {"handlers": ["console"], "level": "INFO", "propagate": False},
    },
}

ASGI_APPLICATION = "config.asgi.application"

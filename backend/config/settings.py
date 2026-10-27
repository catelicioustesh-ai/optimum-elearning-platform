
"""
Django settings for Optimum ERP LMS.
"""

import os
import sys
import tempfile
from datetime import timedelta
from pathlib import Path

try:
    from dotenv import load_dotenv
except ModuleNotFoundError:
    def load_dotenv(*args, **kwargs):
        return False

from django.core.exceptions import ImproperlyConfigured


BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from backend/.env
load_dotenv(BASE_DIR / ".env")


# --------------------------------------------------------------------------
# Basic settings
# --------------------------------------------------------------------------

SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY",
    "dev-only-change-this-in-production",
)

DEBUG = os.environ.get("DJANGO_DEBUG", "False").strip().lower() == "true"

ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get(
        "DJANGO_ALLOWED_HOSTS",
        "localhost,127.0.0.1,testserver",
    ).split(",")
    if host.strip()
]

GOOGLE_OAUTH_CLIENT_ID = os.environ.get(
    "GOOGLE_OAUTH_CLIENT_ID", ""
).strip()

MICROSOFT_OAUTH_CLIENT_ID = os.environ.get(
    "MICROSOFT_OAUTH_CLIENT_ID", ""
).strip()

APPLE_OAUTH_CLIENT_ID = os.environ.get(
    "APPLE_OAUTH_CLIENT_ID", ""
).strip()


# --------------------------------------------------------------------------
# Production settings validation
# --------------------------------------------------------------------------

if not DEBUG:
    required_production_settings = {
        "DJANGO_SECRET_KEY": os.environ.get("DJANGO_SECRET_KEY"),
        "DJANGO_ALLOWED_HOSTS": os.environ.get("DJANGO_ALLOWED_HOSTS"),
        "CORS_ALLOWED_ORIGINS": os.environ.get("CORS_ALLOWED_ORIGINS"),
        "EMAIL_HOST": os.environ.get("EMAIL_HOST"),
        "EMAIL_HOST_USER": os.environ.get("EMAIL_HOST_USER"),
        "EMAIL_HOST_PASSWORD": os.environ.get("EMAIL_HOST_PASSWORD"),
        "DEFAULT_FROM_EMAIL": os.environ.get("DEFAULT_FROM_EMAIL"),
        "FRONTEND_URL": os.environ.get("FRONTEND_URL"),
        "MSSQL_DB_NAME": os.environ.get("MSSQL_DB_NAME"),
        "MSSQL_DB_USER": os.environ.get("MSSQL_DB_USER"),
        "MSSQL_DB_PASSWORD": os.environ.get("MSSQL_DB_PASSWORD"),
        "MSSQL_DB_HOST": os.environ.get("MSSQL_DB_HOST"),
    }

    missing_settings = [
        name
        for name, value in required_production_settings.items()
        if not value
    ]

    if (
        missing_settings
        or SECRET_KEY == "dev-only-change-this-in-production"
    ):
        raise ImproperlyConfigured(
            "Production requires real values for: "
            + ", ".join(missing_settings or ["DJANGO_SECRET_KEY"])
        )


# --------------------------------------------------------------------------
# Applications
# --------------------------------------------------------------------------

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Third-party apps
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "drf_spectacular",

    # Project apps
    "apps.accounts",
    "apps.courses",
    "apps.enrollment",
    "apps.progress",
    "apps.submissions",
    "apps.quizzes",
    "apps.execution",
    "apps.dashboards",
    "apps.engagement",
    "apps.community",
    "apps.risk",
    "apps.sequencing",
    "apps.allocation",
]


# --------------------------------------------------------------------------
# Middleware
# --------------------------------------------------------------------------

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]


# --------------------------------------------------------------------------
# URLs and templates
# --------------------------------------------------------------------------

ROOT_URLCONF = "config.urls"

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

WSGI_APPLICATION = "config.wsgi.application"


# --------------------------------------------------------------------------
# Database: Microsoft SQL Server
# Uses SQL Server username/password authentication.
# Credentials are read from backend/.env.
# --------------------------------------------------------------------------

DATABASES = {
    "default": {
        "ENGINE": "mssql",
        "NAME": os.environ.get(
            "MSSQL_DB_NAME",
            "optimum_erp_lms",
        ),
        "USER": os.environ.get("MSSQL_DB_USER", ""),
        "PASSWORD": os.environ.get("MSSQL_DB_PASSWORD", ""),
        "HOST": os.environ.get("MSSQL_DB_HOST", "localhost"),
        "PORT": os.environ.get("MSSQL_DB_PORT", "1433"),
        "CONN_MAX_AGE": int(
            os.environ.get("DB_CONN_MAX_AGE", "60")
        ),
        "OPTIONS": {
            "driver": os.environ.get(
                "MSSQL_ODBC_DRIVER",
                "ODBC Driver 18 for SQL Server",
            ),
            "extra_params": os.environ.get(
                "MSSQL_EXTRA_PARAMS",
                "Encrypt=yes;TrustServerCertificate=yes;",
            ),
        },
    }
}


# --------------------------------------------------------------------------
# Authentication
# --------------------------------------------------------------------------

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "UserAttributeSimilarityValidator"
        ),
    },
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "MinimumLengthValidator"
        ),
    },
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "CommonPasswordValidator"
        ),
    },
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "NumericPasswordValidator"
        ),
    },
    {
        "NAME": "apps.accounts.validators.PasswordComplexityValidator",
    },
]

AUTHENTICATION_BACKENDS = [
    "apps.accounts.backends.CaseInsensitiveEmailBackend",
]


# --------------------------------------------------------------------------
# Password reset and email verification
# --------------------------------------------------------------------------

PASSWORD_RESET_TIMEOUT = int(
    os.environ.get("PASSWORD_RESET_TIMEOUT", str(60 * 60))
)

EMAIL_VERIFICATION_TIMEOUT = int(
    os.environ.get("EMAIL_VERIFICATION_TIMEOUT", str(60 * 60 * 24))
)

EMAIL_VERIFICATION_RESEND_COOLDOWN = int(
    os.environ.get("EMAIL_VERIFICATION_RESEND_COOLDOWN", "300")
)


# --------------------------------------------------------------------------
# Reverse proxies
# --------------------------------------------------------------------------

NUM_PROXIES_ENV = int(os.environ.get("NUM_PROXIES", "0"))


# --------------------------------------------------------------------------
# Django REST Framework
# --------------------------------------------------------------------------

REST_FRAMEWORK = {
    "NUM_PROXIES": NUM_PROXIES_ENV,
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "apps.accounts.authentication.CookieJWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.ScopedRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "auth": "10/minute",
        "password_reset": "5/hour",
        "email_resend": "5/hour",
        "code_run": "30/minute",
        "upload": "30/hour",
        "video_progress": "120/minute",
    },
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}


# --------------------------------------------------------------------------
# OpenAPI / Swagger
# --------------------------------------------------------------------------

SPECTACULAR_SETTINGS = {
    "TITLE": "Optimum ERP LMS API",
    "DESCRIPTION": "API reference for the Optimum ERP LMS backend.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "SCHEMA_PATH_PREFIX": r"/api/",
    "SWAGGER_UI_SETTINGS": {
        "persistAuthorization": True,
        "displayOperationId": True,
        "filter": True,
    },
    "ENUM_NAME_OVERRIDES": {
        "CourseStatusEnum": [
            ("draft", "Draft"),
            ("published", "Published"),
        ],
        "CertificateStatusEnum": [
            ("issued", "Issued"),
            ("revoked", "Revoked"),
        ],
        "SubmissionStatusEnum": [
            ("submitted", "Submitted"),
            ("graded", "Graded"),
            ("not_completed", "Not Completed"),
        ],
    },
}


# --------------------------------------------------------------------------
# Frontend URLs
# --------------------------------------------------------------------------

FRONTEND_URL = os.environ.get(
    "FRONTEND_URL",
    "http://localhost:5173",
).rstrip("/")

DEFAULT_FROM_EMAIL = os.environ.get(
    "DEFAULT_FROM_EMAIL",
    "Optimum LMS <no-reply@localhost>",
)

CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = [
    origin
    for origin in CORS_ALLOWED_ORIGINS
    if origin.startswith(("http://", "https://"))
]

CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SAMESITE = "Lax"


if not DEBUG and not FRONTEND_URL.startswith("https://"):
    raise ImproperlyConfigured(
        "Production FRONTEND_URL must use HTTPS for account security links."
    )


# --------------------------------------------------------------------------
# Email
# --------------------------------------------------------------------------

EMAIL_BACKEND = os.environ.get(
    "EMAIL_BACKEND",
    (
        "django.core.mail.backends.console.EmailBackend"
        if DEBUG
        else "django.core.mail.backends.smtp.EmailBackend"
    ),
)

EMAIL_FILE_PATH = os.environ.get(
    "EMAIL_FILE_PATH",
    str(BASE_DIR / "sent_emails"),
)

EMAIL_HOST = os.environ.get("EMAIL_HOST", "localhost")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = (
    os.environ.get("EMAIL_USE_TLS", "True").strip().lower() == "true"
)

EMAIL_TIMEOUT = 10

if (
    not DEBUG
    and EMAIL_BACKEND.endswith("smtp.EmailBackend")
    and EMAIL_HOST in ("", "localhost", "127.0.0.1")
):
    import logging

    logging.getLogger(__name__).warning(
        "EMAIL_HOST is not configured: verification and "
        "password-reset emails will NOT be delivered."
    )


# --------------------------------------------------------------------------
# JWT
# --------------------------------------------------------------------------

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "AUTH_HEADER_TYPES": ("Bearer",),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
}


# --------------------------------------------------------------------------
# Code execution sandbox
# --------------------------------------------------------------------------

SANDBOX_URL = os.environ.get(
    "SANDBOX_URL",
    "http://localhost:9000",
)

SANDBOX_TOKEN = os.environ.get("SANDBOX_TOKEN", "")

if not DEBUG and not SANDBOX_TOKEN:
    import logging

    logging.getLogger(__name__).warning(
        "SANDBOX_TOKEN is not set: "
        "the code runner will refuse requests."
    )


# --------------------------------------------------------------------------
# File uploads
# --------------------------------------------------------------------------

SUBMISSION_MAX_UPLOAD_MB = int(
    os.environ.get("SUBMISSION_MAX_UPLOAD_MB", "10")
)

COURSE_VIDEO_MAX_UPLOAD_MB = int(
    os.environ.get("COURSE_VIDEO_MAX_UPLOAD_MB", "500")
)

DATA_UPLOAD_MAX_MEMORY_SIZE = 12 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 2 * 1024 * 1024


# --------------------------------------------------------------------------
# HTTPS and security
# --------------------------------------------------------------------------

if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"


# --------------------------------------------------------------------------
# Internationalization
# --------------------------------------------------------------------------

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True


# --------------------------------------------------------------------------
# Static and media files
# --------------------------------------------------------------------------

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"


# --------------------------------------------------------------------------
# Default primary key
# --------------------------------------------------------------------------

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# --------------------------------------------------------------------------
# Testing
# --------------------------------------------------------------------------

if "test" in sys.argv:
    PASSWORD_HASHERS = [
        "django.contrib.auth.hashers.MD5PasswordHasher",
    ]

    MEDIA_ROOT = tempfile.mkdtemp(prefix="lms_test_media_")


# --------------------------------------------------------------------------
# Video progress
# --------------------------------------------------------------------------

VIDEO_COMPLETE_THRESHOLD = 0.9
VIDEO_MAX_PLAYBACK_RATE = 2.0

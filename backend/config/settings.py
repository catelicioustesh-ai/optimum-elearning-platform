"""
Django settings for Optimum ERP LMS.
"""
import os
import sys
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-only-change-this-in-production")
DEBUG = os.environ.get("DJANGO_DEBUG", "True") == "True"
ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,testserver").split(",")

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
    missing_settings = [name for name, value in required_production_settings.items() if not value]
    if missing_settings or SECRET_KEY == "dev-only-change-this-in-production":
        raise ImproperlyConfigured(
            "Production requires real values for: " + ", ".join(missing_settings or ["DJANGO_SECRET_KEY"])
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

    # third party
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "drf_spectacular",

    # our apps
    "apps.accounts",
    "apps.courses",
    "apps.enrollment",
    "apps.progress",
    "apps.submissions",
    "apps.quizzes",
    "apps.execution",
    "apps.dashboards",
    "apps.engagement",
    "apps.risk",
    "apps.sequencing",
    "apps.allocation",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",   # serves /static/ (admin CSS) from the container
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

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
# Database: Microsoft SQL Server is the only supported runtime backend.
# --------------------------------------------------------------------------
DATABASES = {
    "default": {
        "ENGINE": "config.mssql",
        "NAME": os.environ.get("MSSQL_DB_NAME", "optimum_erp_lms"),
        "USER": os.environ.get("MSSQL_DB_USER", ""),
        "PASSWORD": os.environ.get("MSSQL_DB_PASSWORD", ""),
        "HOST": os.environ.get("MSSQL_DB_HOST", "localhost"),
        "PORT": os.environ.get("MSSQL_DB_PORT", "1433"),
        "CONN_MAX_AGE": int(os.environ.get("DB_CONN_MAX_AGE", "60")),
        "OPTIONS": {
            "driver": os.environ.get("MSSQL_ODBC_DRIVER", "ODBC Driver 18 for SQL Server"),
            "extra_params": os.environ.get(
                "MSSQL_EXTRA_PARAMS",
                "Encrypt=yes;TrustServerCertificate=no;" if not DEBUG
                else "Encrypt=yes;TrustServerCertificate=yes;",
            ),
        },
    }
}


# --------------------------------------------------------------------------
# Auth
# --------------------------------------------------------------------------
AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
    # Requires upper + lower case + a digit. Mirrors the live checklist in
    # frontend/src/lib/passwordRules.js; keep the two in sync.
    {"NAME": "apps.accounts.validators.PasswordComplexityValidator"},
]

# Login matches the email case-insensitively ("Ann@X.com" == "ann@x.com").
AUTHENTICATION_BACKENDS = ["apps.accounts.backends.CaseInsensitiveEmailBackend"]

# Lifetime of the one-time links emailed to users (seconds).
# Password reset links are short-lived because they grant account takeover.
PASSWORD_RESET_TIMEOUT = int(os.environ.get("PASSWORD_RESET_TIMEOUT", str(60 * 60)))          # 1 hour
EMAIL_VERIFICATION_TIMEOUT = int(os.environ.get("EMAIL_VERIFICATION_TIMEOUT", str(60 * 60 * 24)))  # 24 hours

# Number of reverse proxies in front of Django (nginx/ALB). With 0 behind a proxy, EVERY user shares the
# proxy's IP and the login throttle locks everyone out after 10 attempts/minute total.
NUM_PROXIES_ENV = int(os.environ.get("NUM_PROXIES", "0"))

REST_FRAMEWORK = {
    "NUM_PROXIES": NUM_PROXIES_ENV,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.ScopedRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        # applied only to views that opt in via throttle_scope —
        # login/register specifically, to blunt brute-force/credential-
        # stuffing attempts without throttling normal API usage.
        "auth": "10/minute",   # per client IP — set NUM_PROXIES correctly behind nginx (see below)
        "password_reset": "5/hour",
        "code_run": "30/minute",      # sandbox execution (expensive)
        "upload": "30/hour",          # submission file uploads
        "video_progress": "120/minute",  # heartbeat pings every ~10s per open player
    },
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Optimum ERP LMS API",
    "DESCRIPTION": "API reference for the Optimum ERP LMS backend.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173").rstrip("/")
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "Optimum LMS <no-reply@localhost>")
if not DEBUG and not FRONTEND_URL.startswith("https://"):
    raise ImproperlyConfigured("Production FRONTEND_URL must use HTTPS for account security links.")
# Email.  NOTE: Django only reads EMAIL_BACKEND / EMAIL_HOST / ... — an earlier
# version of this file defined a MAILERS dict, which Django ignores, so
# verification and password-reset emails were silently never delivered
# (the default SMTP backend tried localhost:25 and the failure was swallowed).
#
#   DEBUG=True  -> emails are printed to the runserver console (copy the link
#                  from there). Override with EMAIL_BACKEND=... if you prefer,
#                  e.g. django.core.mail.backends.filebased.EmailBackend.
#   DEBUG=False -> real SMTP, configured from the EMAIL_* variables above.
EMAIL_BACKEND = os.environ.get(
    "EMAIL_BACKEND",
    "django.core.mail.backends.console.EmailBackend" if DEBUG
    else "django.core.mail.backends.smtp.EmailBackend",
)
EMAIL_FILE_PATH = os.environ.get("EMAIL_FILE_PATH", str(BASE_DIR / "sent_emails"))
EMAIL_HOST = os.environ.get("EMAIL_HOST", "localhost")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = os.environ.get("EMAIL_USE_TLS", "True") == "True"
EMAIL_TIMEOUT = 10
if not DEBUG and EMAIL_BACKEND.endswith("smtp.EmailBackend") and EMAIL_HOST in ("", "localhost", "127.0.0.1"):
    import logging
    logging.getLogger(__name__).warning(
        "EMAIL_HOST is not configured: verification and password-reset emails will NOT be delivered, "
        "so new users cannot verify. Set EMAIL_HOST/EMAIL_HOST_USER/EMAIL_HOST_PASSWORD, or use "
        "`python manage.py verify_users --all` to unblock accounts manually.")

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "AUTH_HEADER_TYPES": ("Bearer",),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
}

# Allow the Vite frontend (different port) to call this API.
# Tighten this to your real frontend URL before deploying.
CORS_ALLOWED_ORIGINS = os.environ.get(
    "CORS_ALLOWED_ORIGINS", "http://localhost:5173"
).split(",")
CSRF_TRUSTED_ORIGINS = [origin.strip() for origin in CORS_ALLOWED_ORIGINS if origin.strip().startswith("https://")]

# External code-execution sandbox service (see apps/execution/views.py and
# /sandbox). Shared secret so only this backend can call the runner.
SANDBOX_URL = os.environ.get("SANDBOX_URL", "http://localhost:9000")
SANDBOX_TOKEN = os.environ.get("SANDBOX_TOKEN", "")
if not DEBUG and not SANDBOX_TOKEN:
    # Deliberately NOT fatal: a missing runner secret must never stop users logging in.
    # Code execution simply returns 503 until it is set.
    import logging
    logging.getLogger(__name__).warning("SANDBOX_TOKEN is not set: the code runner will refuse requests.")

# Submission uploads: enforced in apps/submissions/validators.py
SUBMISSION_MAX_UPLOAD_MB = int(os.environ.get("SUBMISSION_MAX_UPLOAD_MB", "10"))
COURSE_VIDEO_MAX_UPLOAD_MB = int(os.environ.get("COURSE_VIDEO_MAX_UPLOAD_MB", "500"))
# Reject oversized request bodies before they are buffered in memory.
DATA_UPLOAD_MAX_MEMORY_SIZE = 12 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 2 * 1024 * 1024


# --------------------------------------------------------------------------
# HTTPS / security hardening
#
# These are only turned on when DEBUG=False. Locally (DEBUG=True) they stay
# off so `runserver` over plain http keeps working — turning on
# SECURE_SSL_REDIRECT with no TLS in front of you just breaks local dev.
# In production, this app MUST sit behind a reverse proxy (nginx, a cloud
# load balancer, etc.) that terminates real TLS and forwards the
# X-Forwarded-Proto header; SECURE_PROXY_SSL_HEADER below tells Django to
# trust that header when deciding if a request was actually HTTPS.
# --------------------------------------------------------------------------
if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

    SECURE_HSTS_SECONDS = 31536000  # 1 year, standard once you're confident HTTPS is stable
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

# These are safe to leave on always, dev or prod:
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"  # blocks this site from being iframed elsewhere (clickjacking)


# --------------------------------------------------------------------------
# I18N / static
# --------------------------------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# Tests hash dozens of passwords; the real PBKDF2 hasher makes the suite crawl.
if "test" in sys.argv:
    PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
    import tempfile
    MEDIA_ROOT = tempfile.mkdtemp(prefix="lms_test_media_")   # never write test uploads into ./media

# Video progress (apps/progress/video.py)
VIDEO_COMPLETE_THRESHOLD = 0.9   # fraction of the video that must be genuinely watched
VIDEO_MAX_PLAYBACK_RATE = 2.0

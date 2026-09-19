"""Base settings for CLAIRE Studio backend.

Source of truth: dossier/00_overview/CONTRACT.md.
Environment-driven (django-environ) — no secrets hardcoded.
"""

from __future__ import annotations

import os
from pathlib import Path

import environ

# backend/config/settings/base.py -> backend/
BASE_DIR = Path(__file__).resolve().parents[2]
# repo root: .../annotation-studio
REPO_ROOT = BASE_DIR.parent
# CLAIRE project root (where data/raw lives): .../CLAIRE
PROJECT_ROOT = REPO_ROOT.parent

env = environ.Env(
    DJANGO_DEBUG=(bool, False),
    DJANGO_ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1"]),
    CORS_ALLOWED_ORIGINS=(
        list,
        [
            "http://localhost:3001",
            "http://127.0.0.1:3001",
            # Tolère l'ancien port 3000 le temps de la transition.
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ],
    ),
)

# Read .env if present (never committed).
_env_file = os.environ.get("DJANGO_ENV_FILE", str(BASE_DIR / ".env"))
if os.path.exists(_env_file):
    environ.Env.read_env(_env_file)

SECRET_KEY = env("DJANGO_SECRET_KEY", default="dev-insecure-change-me-in-prod")
DEBUG = env("DJANGO_DEBUG")
ALLOWED_HOSTS = env("DJANGO_ALLOWED_HOSTS")

# --- Paths to real corpora / pre-annotation data (overridable via env) -------
# Defaults live INSIDE the project (REPO_ROOT = claire-studio) so the app is
# portable without machine-specific env: claire-studio/data/{claudette_tos,preannotations,translations}.
DATA_DIR = Path(env("CLAIRE_DATA_DIR", default=str(REPO_ROOT / "data")))
DATA_RAW_DIR = Path(env("CLAIRE_DATA_RAW_DIR", default=str(DATA_DIR)))
CLAUDETTE_DIR = Path(
    env("CLAIRE_CLAUDETTE_DIR", default=str(DATA_DIR / "claudette_tos"))
)
PREANNOTATIONS_DIR = Path(
    env("CLAIRE_PREANNOTATIONS_DIR", default=str(DATA_DIR / "preannotations"))
)
ANNOTATIONS_DIR = Path(
    env("CLAIRE_ANNOTATIONS_DIR", default=str(DATA_DIR / "preannotations"))
)
VOCABULARY_FILE = Path(
    env(
        "CLAIRE_VOCABULARY_FILE",
        default=str(REPO_ROOT / "dossier" / "00_overview" / "vocabulary.yaml"),
    )
)
EXPORTS_DIR = Path(env("CLAIRE_EXPORTS_DIR", default=str(BASE_DIR / "var" / "exports")))
ANALYSIS_ARTIFACTS_DIR = Path(
    env("CLAIRE_ANALYSIS_ARTIFACTS_DIR", default=str(BASE_DIR / "var" / "analysis"))
)
ANALYSIS_DISPATCH_MODE = env("CLAIRE_ANALYSIS_DISPATCH_MODE", default="thread")
ANALYSIS_RUN_TIMEOUT_SECONDS = env.int("CLAIRE_ANALYSIS_RUN_TIMEOUT_SECONDS", default=900)
ANALYSIS_REPORT_RETENTION_DAYS = env.int("CLAIRE_ANALYSIS_REPORT_RETENTION_DAYS", default=365)
FIXTURES_DIR = BASE_DIR / "fixtures"
# File-based features confinement root (translations sync, auto-pull). A10/SSRF.
TRANSLATIONS_ROOT = Path(
    env("CLAIRE_TRANSLATIONS_ROOT", default=str(DATA_DIR / "translations"))
)
# Interpréteur pour `python -m pactiva_lab` (claire/lab/runners/local.py). None (défaut)
# = celui de Django (sys.executable). À définir explicitement quand `research/` a besoin
# de dépendances ML lourdes (torch, transformers) que l'environnement Django n'a pas
# vocation à porter — voir docs/pactiva-lab/02_ARCHITECTURE.md.
LAB_RESEARCH_PYTHON = env("LAB_RESEARCH_PYTHON", default=None)
# Au-delà de ce nombre de runs, un sweep ciblant Grid'5000 est refusé sans `force=true` —
# Grid'5000 déconseille explicitement de soumettre de nombreux petits jobs OAR séparés,
# voir docs/pactiva-g5k/research/02_OAR_KADEPLOY.md §4.3.
LAB_G5K_MAX_RUNS_PER_SWEEP = env.int("LAB_G5K_MAX_RUNS_PER_SWEEP", default=3)

# --- Démonstration publique (page reviewer, docs/pactiva-reviewer-demo) --------------
# Modèle Legal-BERT T11 servi (dossier écrit par TransformerFinetune.save) et jeu figé du Lab
# dont proviennent les 17 contrats hold-out. Le texte collé n'est jamais conservé.
DEMO_MODEL_DIR = env("DEMO_MODEL_DIR", default=str(BASE_DIR.parent / "var" / "models" / "legalbert_T11_holdout"))
DEMO_DATASET_ID = env("DEMO_DATASET_ID", default="0a2542a1-c5b0-4ef8-95e0-15abea0566db")
DEMO_ACCESS_CODE = env("DEMO_ACCESS_CODE", default="")
DEMO_MAX_CHARS = env.int("DEMO_MAX_CHARS", default=60000)
DEMO_MAX_SENTENCES = env.int("DEMO_MAX_SENTENCES", default=400)
DEMO_QUEUE_MAX = env.int("DEMO_QUEUE_MAX", default=3)
DEMO_JOB_TIMEOUT = env.int("DEMO_JOB_TIMEOUT", default=120)
DEMO_THREADS = env.int("DEMO_THREADS", default=3)
DEMO_RUN_INLINE = False
# Délai avant de tuer un run local (claire/lab/runners/local.py). 3600 s (l'ancien défaut
# implicite) suffit à peine pour UN SEUL pli d'un encodeur lourd sans GPU sur ce VPS — un
# run réel a dépassé ce délai en production (12 août 2026). 7200 s laisse la marge pour
# les 5 plis d'une validation croisée complète, cache d'embeddings compris.
LAB_LOCAL_TIMEOUT = env.int("LAB_LOCAL_TIMEOUT", default=7200)

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # 3rd party
    "channels",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
    # local apps (one per domain — CONTRACT §6)
    "claire.accounts",
    "claire.corpora",
    "claire.schemes",
    "claire.projects",
    "claire.annotations",
    "claire.collaboration",
    "claire.imports",
    "claire.translations",
    "claire.exports",
    "claire.gold",
    "claire.analysis",
    "claire.lab",
    "claire.demo",
    "claire.audit",
    "claire.common",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "claire.common.middleware.SecurityHeadersMiddleware",
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
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# --- Channels (temps réel, chantier D) ---------------------------------------
# Présence/collaboration live via WebSocket. Couche InMemory par défaut (dev/test,
# mono-process) ; Redis en prod (multi-workers) via CHANNELS_USE_REDIS=true +
# channels-redis. Le flag FEATURE_FLAGS.realtime_collaboration pilote l'activation UI.
if env.bool("CHANNELS_USE_REDIS", default=False):
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {"hosts": [env("REDIS_URL", default="redis://localhost:6379/0")]},
        }
    }
else:
    CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}

# --- Database (SQLite dev, Postgres-ready via DATABASE_URL) ------------------
DATABASES = {
    "default": env.db_url(
        "DATABASE_URL",
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
    )
}

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- DRF ---------------------------------------------------------------------
REST_FRAMEWORK = {
    # --- Casing bridge (frontend CONTRACT) -----------------------------------
    # The frontend (frontend/src/types/contract.ts) consumes camelCase and does
    # NOT transform responses. djangorestframework-camel-case renders snake_case
    # model/serializer fields as camelCase on the way out and parses incoming
    # camelCase JSON back to snake_case on the way in — so serializers stay
    # idiomatic snake_case (CONTRACT §6) while the wire format is camelCase.
    "DEFAULT_RENDERER_CLASSES": (
        "djangorestframework_camel_case.render.CamelCaseJSONRenderer",
        "djangorestframework_camel_case.render.CamelCaseBrowsableAPIRenderer",
    ),
    "DEFAULT_PARSER_CLASSES": (
        "djangorestframework_camel_case.parser.CamelCaseJSONParser",
        "djangorestframework_camel_case.parser.CamelCaseFormParser",
        "djangorestframework_camel_case.parser.CamelCaseMultiPartParser",
    ),
    # `ui_preferences` (préférences UI par compte) est un BLOB JSON dont les clés internes
    # SONT déjà en camelCase (contrat front lib/prefs/schema.ts) et dont certaines clés sont
    # des ids de modèle LIBRES (map ghostJudges). On l'exclut de la conversion camel↔snake
    # pour le préserver VERBATIM dans les deux sens (sinon les clés imbriquées seraient
    # snake-isées au parse et re-camelisées au render, corrompant les ids de juge).
    "JSON_UNDERSCOREIZE": {"ignore_fields": ("ui_preferences", "uiPreferences")},
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "claire.common.pagination.DefaultPagination",
    "PAGE_SIZE": 25,
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.OrderingFilter",
        "rest_framework.filters.SearchFilter",
    ),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "claire.common.exceptions.claire_exception_handler",
    # --- Rate limiting (security.md §4, A07) ---------------------------------
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.ScopedRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        # Strict, dedicated budget for login (anti brute-force).
        "login": env("THROTTLE_LOGIN_RATE", default="5/min"),
        # Generous reads, stricter writes/exports for authenticated traffic.
        "burst": env("THROTTLE_BURST_RATE", default="120/min"),
        "exports": env("THROTTLE_EXPORTS_RATE", default="10/min"),
        # Onboarding (chantier E) : anti-abus inscription / reset mot de passe.
        "register": env("THROTTLE_REGISTER_RATE", default="10/hour"),
        "password_reset": env("THROTTLE_PASSWORD_RESET_RATE", default="5/hour"),
        # Démonstration publique (page reviewer) : trafic anonyme, borné par adresse.
        "demo": env("THROTTLE_DEMO_RATE", default="30/hour"),
        "demo_burst": env("THROTTLE_DEMO_BURST_RATE", default="6/min"),
    },
}

from datetime import timedelta  # noqa: E402

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=env.int("JWT_ACCESS_MINUTES", default=60)
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env.int("JWT_REFRESH_DAYS", default=7)),
    "AUTH_HEADER_TYPES": ("Bearer",),
    # Refresh rotation + blacklist of the consumed refresh (security.md §1,
    # threat_model.md §3.1 S — anti-replay). Requires token_blacklist app.
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}

SPECTACULAR_SETTINGS = {
    "TITLE": "CLAIRE Studio API",
    "DESCRIPTION": "Plateforme d'annotation juridique collaborative (CLAUDETTE / UNFAIR-ToS).",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SCHEMA_PATH_PREFIX": "/api/v1",
}

# --- Security headers & transport (security.md §7, A05) ----------------------
# Baseline values applied in all environments; prod.py tightens HSTS/SSL.
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
X_FRAME_OPTIONS = "DENY"

# --- CORS --------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS")
CORS_ALLOW_CREDENTIALS = True

# --- Feature flags (points 4b/7 + admin) -------------------------------------
# Exposés par GET /config/flags ; l'UI s'y conforme. Le temps réel reste OFF par
# défaut tant que l'infra ASGI/Channels n'est pas active (cf. dossier 06).
FEATURE_FLAGS = {
    "realtime_collaboration": env.bool("FEATURE_REALTIME", default=False),
    "presence": env.bool("FEATURE_PRESENCE", default=True),
    "attribution_overlay": env.bool("FEATURE_ATTRIBUTION", default=True),
    "comments_multilevel": env.bool("FEATURE_COMMENTS_MULTILEVEL", default=True),
    "undo_redo": env.bool("FEATURE_UNDO_REDO", default=True),
    "analytics_screen": env.bool("FEATURE_ANALYTICS", default=True),
    "version_explorer": env.bool("FEATURE_VERSION_EXPLORER", default=True),
}

# --- Seed defaults (dé-rigidification — H1/H2/§7) ----------------------------
# Valeurs « métier » des seeders rendues configurables : aucune constante figée
# dans le code. Les défauts reproduisent la démo CLAUDETTE mais peuvent pointer un
# tout autre corpus/projet via l'environnement. Le mot de passe de démo n'est plus
# un secret en dur. SEED_HUMAN_FROM_LLM=False ⇒ l'annotation humaine démarre VIDE
# (le LLM reste une suggestion à adopter, cf. CONTRACT / chantier B).
SEED_PASSWORD = env("CLAIRE_SEED_PASSWORD", default="claire-demo")
SEED_CORPUS_SLUG = env("CLAIRE_SEED_CORPUS_SLUG", default="claudette-tos")
SEED_PROJECT_SLUG = env("CLAIRE_SEED_PROJECT_SLUG", default="claudette-gold-v1")
SEED_TRANSLATION_FOLDER = env(
    "CLAIRE_SEED_TRANSLATION_FOLDER", default="claudette_fr"
)
SEED_HUMAN_FROM_LLM = env.bool("CLAIRE_SEED_HUMAN_FROM_LLM", default=False)

# --- E-mail (chantier E) -----------------------------------------------------
# Aucun secret en dur : tout vient de l'environnement. En dev, backend « console »
# (les e-mails sont imprimés, aucun SMTP requis) ; prod.py bascule sur SMTP
# (serveur Stalwart, domaine dédié). FRONTEND_BASE_URL sert à construire les liens
# de vérification e-mail, réinitialisation de mot de passe et invitations.
EMAIL_BACKEND = env(
    "DJANGO_EMAIL_BACKEND",
    default="django.core.mail.backends.console.EmailBackend",
)
EMAIL_HOST = env("EMAIL_HOST", default="localhost")
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
EMAIL_USE_SSL = env.bool("EMAIL_USE_SSL", default=False)
EMAIL_TIMEOUT = env.int("EMAIL_TIMEOUT", default=10)
DEFAULT_FROM_EMAIL = env(
    "DEFAULT_FROM_EMAIL", default="Pactiva <no-reply@pactiva.legal>"
)
SERVER_EMAIL = env("SERVER_EMAIL", default="no-reply@pactiva.legal")
FRONTEND_BASE_URL = env("FRONTEND_BASE_URL", default="http://localhost:3001")
# Durée de validité des liens signés (vérif e-mail / reset), en secondes.
EMAIL_TOKEN_MAX_AGE = env.int("EMAIL_TOKEN_MAX_AGE", default=60 * 60 * 24)

# --- Logging (structured, debuggable) ----------------------------------------
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {
        # A09: never let PII (emails/tokens/passwords) reach the logs.
        "pii_scrubber": {"()": "claire.common.logging.PIIScrubber"},
    },
    "formatters": {
        "structured": {
            "format": (
                "%(asctime)s level=%(levelname)s logger=%(name)s "
                "msg=%(message)s"
            ),
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "structured",
            "filters": ["pii_scrubber"],
        },
    },
    "root": {"handlers": ["console"], "level": env("DJANGO_LOG_LEVEL", default="INFO")},
    "loggers": {
        "claire": {
            "handlers": ["console"],
            "level": env("CLAIRE_LOG_LEVEL", default="DEBUG"),
            "propagate": False,
        },
    },
}

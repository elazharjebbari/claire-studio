"""Test settings — SQLite rapide localement, Postgres lorsque TEST_DATABASE_URL est fourni."""

from .base import *  # noqa: F401,F403
from .base import env

DEBUG = False
SECRET_KEY = "test-only-django-secret-key-at-least-32-bytes"
_test_database_url = env("TEST_DATABASE_URL", default="")
DATABASES = (
    {"default": env.db_url("TEST_DATABASE_URL")}
    if _test_database_url
    else {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
)
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
# E-mails capturés en mémoire (django.core.mail.outbox) pour les assertions de test.
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
# Export EN TÂCHE DE FOND exécuté en SYNCHRONE en test (déterministe, pas de thread
# → pas de verrou SQLite). En prod, run_export_async lance un thread daemon.
EXPORTS_RUN_INLINE = True
ANALYSIS_DISPATCH_MODE = "inline"

# Démonstration publique : jobs synchrones et déterministes en test.
DEMO_RUN_INLINE = True

"""Test settings — in-memory SQLite, fast password hasher."""

from .base import *  # noqa: F401,F403

DEBUG = False
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
# E-mails capturés en mémoire (django.core.mail.outbox) pour les assertions de test.
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

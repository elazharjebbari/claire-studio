"""Production settings — Postgres via DATABASE_URL, hardened, secrets from env."""

from .base import *  # noqa: F401,F403
from .base import env

DEBUG = False
# SECRET_KEY must be provided via env in production.
SECRET_KEY = env("DJANGO_SECRET_KEY")

# Security hardening.
SECURE_SSL_REDIRECT = env.bool("DJANGO_SECURE_SSL_REDIRECT", default=True)
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = env.int("DJANGO_HSTS_SECONDS", default=31536000)
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
X_FRAME_OPTIONS = "DENY"

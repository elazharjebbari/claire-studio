"""Development settings — SQLite, debug on, permissive CORS for localhost:3000."""

from .base import *  # noqa: F401,F403
from .base import REST_FRAMEWORK, env

DEBUG = True
ALLOWED_HOSTS = ["*"]
# Allow override but default to dev-friendly secret already in base.
SECRET_KEY = env("DJANGO_SECRET_KEY", default="dev-insecure-change-me-in-prod")

# En dev, l'auto-login + un éventuel rechargement peuvent dépasser le quota de
# prod (5/min) et provoquer des 429 en cascade. On assouplit fortement le quota
# login en dev (la protection brute-force stricte reste active en prod).
REST_FRAMEWORK = {
    **REST_FRAMEWORK,
    "DEFAULT_THROTTLE_RATES": {
        **REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"],
        "login": env("THROTTLE_LOGIN_RATE", default="60/min"),
    },
}

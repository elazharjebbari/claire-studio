"""Development settings — SQLite, debug on, permissive CORS for localhost:3000."""

from .base import *  # noqa: F401,F403
from .base import env

DEBUG = True
ALLOWED_HOSTS = ["*"]
# Allow override but default to dev-friendly secret already in base.
SECRET_KEY = env("DJANGO_SECRET_KEY", default="dev-insecure-change-me-in-prod")

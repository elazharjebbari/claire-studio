"""Transactional e-mails for account flows (chantier E).

Links point at the frontend (settings.FRONTEND_BASE_URL) which calls the matching
API endpoint. From address = settings.DEFAULT_FROM_EMAIL. The backend is env-driven
(console in dev, Stalwart SMTP in prod) — see settings.
"""

from __future__ import annotations

import logging
from urllib.parse import urlencode

from django.conf import settings
from django.core.mail import send_mail

from .tokens import make_email_verify_token, make_password_reset_pair

logger = logging.getLogger("claire.accounts")


def _frontend_link(path: str, query: dict[str, str]) -> str:
    base = settings.FRONTEND_BASE_URL.rstrip("/")
    return f"{base}{path}?{urlencode(query)}"


def send_verification_email(user) -> None:
    link = _frontend_link("/verify-email", {"token": make_email_verify_token(user)})
    send_mail(
        subject="Vérifiez votre adresse e-mail — CLAIRE Studio",
        message=(
            f"Bonjour {user.display_name or user.username},\n\n"
            f"Confirmez votre adresse e-mail en ouvrant ce lien :\n{link}\n\n"
            f"Le lien expire dans 24 h. Si vous n'êtes pas à l'origine de cette "
            f"inscription, ignorez cet e-mail."
        ),
        from_email=None,  # → DEFAULT_FROM_EMAIL
        recipient_list=[user.email],
    )
    logger.info("verification_email_sent user=%s", user.pk)


def send_password_reset_email(user) -> None:
    uidb64, token = make_password_reset_pair(user)
    link = _frontend_link("/reset-password", {"uid": uidb64, "token": token})
    send_mail(
        subject="Réinitialisation de votre mot de passe — CLAIRE Studio",
        message=(
            f"Bonjour {user.display_name or user.username},\n\n"
            f"Pour choisir un nouveau mot de passe, ouvrez ce lien :\n{link}\n\n"
            f"Le lien expire après usage ou changement de mot de passe. Si vous "
            f"n'avez rien demandé, ignorez cet e-mail."
        ),
        from_email=None,
        recipient_list=[user.email],
    )
    logger.info("password_reset_email_sent user=%s", user.pk)

"""Chiffrement des identifiants de calcul au repos.

Trois règles, appliquées ici et testées :

1. **Clé DÉDIÉE** (`LAB_CREDENTIALS_KEY`), jamais dérivée de `DJANGO_SECRET_KEY` : faire
   tourner l'une ne doit pas rendre l'autre illisible. Une rotation de la clé Django est
   une opération courante ; elle ne doit pas détruire les identifiants Grid'5000.
2. **Refus explicite** si la clé est absente. Jamais de stockage en clair « en
   attendant » : un secret écrit en clair une fois le reste indéfiniment, et personne ne
   s'en souvient au moment de l'audit.
3. **Jamais de déchiffrement vers l'API.** Le secret n'est déchiffré qu'en mémoire, dans
   le worker, au moment de soumettre un job.
"""

from __future__ import annotations

import os

from django.core.exceptions import ImproperlyConfigured

ENV_KEY = "LAB_CREDENTIALS_KEY"

GENERATE_HINT = (
    "Générer une clé avec : python -c \"from cryptography.fernet import Fernet; "
    "print(Fernet.generate_key().decode())\" puis la placer dans la variable "
    f"d'environnement {ENV_KEY} (jamais dans le dépôt)."
)


class CredentialsKeyMissing(ImproperlyConfigured):
    """Clé de chiffrement absente — on refuse d'écrire un secret."""


def _fernet():
    key = os.environ.get(ENV_KEY, "").strip()
    if not key:
        raise CredentialsKeyMissing(
            f"{ENV_KEY} absente : refus de stocker un identifiant. {GENERATE_HINT}"
        )
    try:
        from cryptography.fernet import Fernet
    except ImportError as exc:  # pragma: no cover - dépend de l'environnement
        raise ImproperlyConfigured(
            "le paquet `cryptography` est requis pour stocker des identifiants"
        ) from exc
    try:
        return Fernet(key.encode())
    except Exception as exc:
        raise CredentialsKeyMissing(
            f"{ENV_KEY} invalide (clé Fernet urlsafe base64 de 32 octets attendue). "
            f"{GENERATE_HINT}"
        ) from exc


def encrypt_secret(raw: str) -> str:
    """Chiffre un secret. Lève si la clé manque — jamais de repli en clair."""
    if not raw:
        raise ValueError("secret vide")
    return _fernet().encrypt(raw.encode("utf-8")).decode("ascii")


def decrypt_secret(token: str) -> str:
    """Déchiffre. À n'appeler que dans le worker, au moment de soumettre un job."""
    if not token:
        raise ValueError("aucun secret stocké")
    return _fernet().decrypt(token.encode("ascii")).decode("utf-8")


def is_configured() -> bool:
    """La plateforme peut-elle stocker des identifiants ? Sert à l'UI pour désactiver
    proprement la cible distante au lieu de la faire disparaître."""
    try:
        _fernet()
        return True
    except ImproperlyConfigured:
        return False


def mask(value: str) -> str:
    """Représentation sûre pour les journaux et les messages d'erreur."""
    if not value:
        return ""
    if len(value) <= 4:
        return "•" * len(value)
    return f"{value[:2]}{'•' * (len(value) - 4)}{value[-2:]}"

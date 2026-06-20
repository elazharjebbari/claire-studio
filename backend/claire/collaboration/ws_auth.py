"""Authentification JWT pour les WebSockets (chantier D).

Le client passe son access token en query string (`?token=<access>`), comme pour
l'auth REST (Bearer) mais adapté au handshake WS. Jamais d'accès anonyme : un scope
sans utilisateur authentifié sera refusé par le consumer.
"""

from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser


@database_sync_to_async
def _user_from_token(token: str):
    from django.contrib.auth import get_user_model
    from rest_framework_simplejwt.tokens import AccessToken

    try:
        access = AccessToken(token)
        return get_user_model().objects.get(pk=access["user_id"])
    except Exception:  # noqa: BLE001 — tout jeton invalide → anonyme (refusé ensuite)
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    """Place `scope['user']` à partir du jeton JWT de la query string."""

    async def __call__(self, scope, receive, send):
        params = parse_qs(scope.get("query_string", b"").decode())
        token = (params.get("token") or [None])[0]
        scope["user"] = await _user_from_token(token) if token else AnonymousUser()
        return await super().__call__(scope, receive, send)

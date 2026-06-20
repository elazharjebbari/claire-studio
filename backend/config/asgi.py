"""Point d'entrée ASGI — HTTP (Django) + WebSocket (Channels, chantier D).

Le routeur de protocole sépare le trafic HTTP classique des WebSockets de
collaboration (présence). L'auth WS se fait par jeton JWT en query string.
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

# Initialise Django (apps) AVANT d'importer consumers/routing.
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402

from claire.collaboration.routing import websocket_urlpatterns  # noqa: E402
from claire.collaboration.ws_auth import JWTAuthMiddleware  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": JWTAuthMiddleware(URLRouter(websocket_urlpatterns)),
    }
)

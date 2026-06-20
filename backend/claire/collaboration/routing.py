"""Routes WebSocket de la collaboration (chantier D)."""

from django.urls import re_path

from . import consumers

websocket_urlpatterns = [
    re_path(
        r"^ws/presence/(?P<annotation_id>[^/]+)/$",
        consumers.PresenceConsumer.as_asgi(),
    ),
]

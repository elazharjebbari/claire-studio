"""Présence temps réel par annotation (chantier D) — WebSocket via Channels.

Chaque participant rejoint la « salle » d'une annotation ; le roster (qui est là +
sur quelle phrase) est partagé via le cache et diffusé au groupe à chaque
join/leave/focus. Donne une présence multi-utilisateur réelle (pas seulement « soi »).

Dégradation : si l'infra WS n'est pas active, l'UI retombe sur la présence REST
(GET /annotations/{id}/presence) — aucun couplage dur. Jamais d'accès anonyme.
"""

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.core.cache import cache

ROSTER_TTL = 120  # secondes ; un participant inactif expire du roster


class PresenceConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")
        if user is None or not user.is_authenticated:
            await self.close(code=4401)  # auth requise — jamais d'anonyme
            return
        from claire.common.identity import display_name, user_color

        self.annotation_id = self.scope["url_route"]["kwargs"]["annotation_id"]
        self.group = f"presence_{self.annotation_id}"
        self.me = {
            "userId": str(user.pk),
            "name": display_name(user),
            "color": user_color(user.pk),
            "focusSentence": None,
        }
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()
        await self._set_member(self.me)
        await self._broadcast()

    async def disconnect(self, code):
        if hasattr(self, "group"):
            await self._remove_member()
            await self.channel_layer.group_discard(self.group, self.channel_name)
            await self._broadcast()

    async def receive_json(self, content, **kwargs):
        if content.get("type") == "focus" and hasattr(self, "me"):
            self.me["focusSentence"] = content.get("sentenceIndex")
            await self._set_member(self.me)
            await self._broadcast()

    # --- roster partagé (cache) ------------------------------------------------
    def _read(self) -> dict:
        return cache.get(self.group) or {}

    def _write(self, roster: dict) -> None:
        cache.set(self.group, roster, ROSTER_TTL)

    async def _set_member(self, member: dict) -> None:
        roster = await sync_to_async(self._read)()
        roster[self.channel_name] = member
        await sync_to_async(self._write)(roster)

    async def _remove_member(self) -> None:
        roster = await sync_to_async(self._read)()
        roster.pop(self.channel_name, None)
        await sync_to_async(self._write)(roster)

    async def _broadcast(self) -> None:
        roster = await sync_to_async(self._read)()
        await self.channel_layer.group_send(
            self.group,
            {"type": "presence.update", "participants": list(roster.values())},
        )

    async def presence_update(self, event) -> None:
        await self.send_json({"type": "presence", "participants": event["participants"]})

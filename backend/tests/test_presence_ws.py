"""Présence temps réel WebSocket (chantier D) — Channels + InMemory.

Vérifie : refus anonyme, présence multi-utilisateur diffusée, broadcast du focus.
"""

import pytest
from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model

from config.asgi import application

User = get_user_model()


def _make_user(username):
    return User.objects.create_user(
        username=username, email=f"{username}@x.local", password="x"
    )


def _token_for(user):
    from rest_framework_simplejwt.tokens import AccessToken

    return str(AccessToken.for_user(user))


async def _connect(username, annotation_id="ann-1"):
    user = await database_sync_to_async(_make_user)(username)
    token = await database_sync_to_async(_token_for)(user)
    comm = WebsocketCommunicator(
        application, f"/ws/presence/{annotation_id}/?token={token}"
    )
    connected, _ = await comm.connect()
    return user, comm, connected


async def _clear_cache():
    from django.core.cache import cache

    await database_sync_to_async(cache.clear)()


@pytest.mark.django_db(transaction=True)
async def test_presence_refuses_anonymous():
    comm = WebsocketCommunicator(application, "/ws/presence/ann-1/")  # pas de token
    connected, _ = await comm.connect()
    assert connected is False  # jamais d'accès anonyme
    await comm.disconnect()


@pytest.mark.django_db(transaction=True)
async def test_presence_multi_user_roster():
    await _clear_cache()
    u1, c1, ok1 = await _connect("wsalice")
    assert ok1
    first = await c1.receive_json_from()
    assert first["type"] == "presence"
    assert any(p["userId"] == str(u1.pk) for p in first["participants"])

    u2, c2, ok2 = await _connect("wsbob")
    assert ok2
    update = await c1.receive_json_from()
    ids = {p["userId"] for p in update["participants"]}
    assert {str(u1.pk), str(u2.pk)} <= ids  # présence réelle (pas seulement soi)

    await c1.disconnect()
    await c2.disconnect()


@pytest.mark.django_db(transaction=True)
async def test_focus_is_broadcast():
    await _clear_cache()
    u1, c1, _ = await _connect("wsfocus")
    await c1.receive_json_from()  # roster initial
    await c1.send_json_to({"type": "focus", "sentenceIndex": 7})
    msg = await c1.receive_json_from()
    me = next(p for p in msg["participants"] if p["userId"] == str(u1.pk))
    assert me["focusSentence"] == 7
    await c1.disconnect()

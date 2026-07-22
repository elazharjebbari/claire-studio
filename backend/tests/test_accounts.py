"""Account onboarding flows (chantier E) — register, verify, reset, profile."""

import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from rest_framework.test import APIClient

from claire.accounts.tokens import make_email_verify_token, make_password_reset_pair

pytestmark = pytest.mark.django_db
User = get_user_model()


@pytest.fixture(autouse=True)
def _clear_throttle_cache():
    # Les vues onboarding sont throttlées (ScopedRateThrottle) ; on repart d'un
    # budget neuf à chaque test pour éviter les 429 dus à l'accumulation.
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def client():
    return APIClient()


# ------------------------------------------------------------------- register
def test_register_creates_unverified_user_and_sends_email(client):
    resp = client.post(
        "/api/v1/auth/register",
        {
            "username": "newbie",
            "email": "newbie@example.com",
            "password": "S3cur3-pass!",
            "displayName": "Newbie",
        },
        format="json",
    )
    assert resp.status_code == 201, resp.content
    user = User.objects.get(username="newbie")
    assert user.is_email_verified is False
    assert user.role == "annotator"
    assert user.display_name == "Newbie"
    assert len(mail.outbox) == 1
    assert "newbie@example.com" in mail.outbox[0].to


def test_register_rejects_duplicate_email_case_insensitive(client):
    User.objects.create_user(username="a", email="dup@example.com", password="x")
    resp = client.post(
        "/api/v1/auth/register",
        {"username": "b", "email": "DUP@example.com", "password": "S3cur3-pass!"},
        format="json",
    )
    assert resp.status_code == 400


def test_register_rejects_weak_password(client):
    resp = client.post(
        "/api/v1/auth/register",
        {"username": "weak", "email": "weak@example.com", "password": "123"},
        format="json",
    )
    assert resp.status_code == 400
    assert not User.objects.filter(username="weak").exists()


# -------------------------------------------------------------- verify e-mail
def test_verify_email_with_valid_token(client):
    user = User.objects.create_user(username="v", email="v@example.com", password="x")
    assert user.is_email_verified is False
    resp = client.post(
        "/api/v1/auth/verify-email",
        {"token": make_email_verify_token(user)},
        format="json",
    )
    assert resp.status_code == 200
    user.refresh_from_db()
    assert user.is_email_verified is True


def test_verify_email_with_invalid_token(client):
    resp = client.post(
        "/api/v1/auth/verify-email", {"token": "garbage"}, format="json"
    )
    assert resp.status_code == 400


# ------------------------------------------------------------- password reset
def test_password_reset_sends_email_when_user_exists(client):
    User.objects.create_user(username="r", email="r@example.com", password="x")
    resp = client.post(
        "/api/v1/auth/password-reset", {"email": "r@example.com"}, format="json"
    )
    assert resp.status_code == 200
    assert len(mail.outbox) == 1


def test_password_reset_does_not_leak_unknown_email(client):
    resp = client.post(
        "/api/v1/auth/password-reset", {"email": "nobody@example.com"}, format="json"
    )
    assert resp.status_code == 200  # réponse identique (anti-énumération)
    assert len(mail.outbox) == 0


def test_password_reset_confirm_sets_password_and_token_is_one_time(client):
    user = User.objects.create_user(
        username="c", email="c@example.com", password="oldpass"
    )
    uidb64, token = make_password_reset_pair(user)
    resp = client.post(
        "/api/v1/auth/password-reset/confirm",
        {"uid": uidb64, "token": token, "newPassword": "Brand-New-99!"},
        format="json",
    )
    assert resp.status_code == 200
    user.refresh_from_db()
    assert user.check_password("Brand-New-99!")
    # Token à usage unique : invalide après changement de mot de passe.
    resp2 = client.post(
        "/api/v1/auth/password-reset/confirm",
        {"uid": uidb64, "token": token, "newPassword": "Another-99!"},
        format="json",
    )
    assert resp2.status_code == 400


def test_password_reset_confirm_rejects_bad_token(client):
    user = User.objects.create_user(username="d", email="d@example.com", password="x")
    uidb64, _ = make_password_reset_pair(user)
    resp = client.post(
        "/api/v1/auth/password-reset/confirm",
        {"uid": uidb64, "token": "bad-token", "newPassword": "Brand-New-99!"},
        format="json",
    )
    assert resp.status_code == 400


# -------------------------------------------------------------------- profile
def test_me_patch_updates_profile_but_not_role(client):
    user = User.objects.create_user(
        username="p", email="p@example.com", password="x", role="annotator"
    )
    client.force_authenticate(user=user)
    resp = client.patch(
        "/api/v1/me",
        {"displayName": "Pat", "locale": "fr", "role": "admin"},
        format="json",
    )
    assert resp.status_code == 200
    user.refresh_from_db()
    assert user.display_name == "Pat"
    assert user.locale == "fr"
    assert user.role == "annotator"  # rôle jamais modifiable via le profil
    assert resp.json()["isEmailVerified"] is False


# ─────────────────────────────────────────────────────────────────────────────
# Préférences d'interface PAR COMPTE — isolation entre comptes (refonte atelier).
# « Marche pour TOUS les comptes, pas que le mien » : ce que pose un annotateur ne
# doit jamais déteindre sur un autre, quel que soit le rôle.
# ─────────────────────────────────────────────────────────────────────────────
def _patch_prefs(client, user, prefs):
    client.force_authenticate(user=user)
    return client.patch("/api/v1/me", {"uiPreferences": prefs}, format="json")


def test_ui_preferences_isolated_between_accounts(client):
    """Deux comptes (rôles différents) ; les prefs de l'un n'affectent jamais l'autre."""
    alice = User.objects.create_user(username="ui_alice", email="a@ex.com", password="x", role="annotator")
    bob = User.objects.create_user(username="ui_bob", email="b@ex.com", password="x", role="lead")

    r1 = _patch_prefs(client, alice, {"overlays": {"showUnfairness": False}, "panels": {"inspectorOpen": False}})
    assert r1.status_code == 200
    r2 = _patch_prefs(client, bob, {"overlays": {"showUnfairness": True}, "panels": {"inspectorOpen": True}})
    assert r2.status_code == 200

    alice.refresh_from_db()
    bob.refresh_from_db()
    # Chaque compte conserve EXACTEMENT ses propres valeurs (aucune fuite croisée).
    assert alice.ui_preferences["overlays"]["showUnfairness"] is False
    assert alice.ui_preferences["panels"]["inspectorOpen"] is False
    assert bob.ui_preferences["overlays"]["showUnfairness"] is True
    assert bob.ui_preferences["panels"]["inspectorOpen"] is True

    # Le GET /me de chacun renvoie SON blob (pas celui de l'autre).
    client.force_authenticate(user=alice)
    assert client.get("/api/v1/me").json()["uiPreferences"]["panels"]["inspectorOpen"] is False
    client.force_authenticate(user=bob)
    assert client.get("/api/v1/me").json()["uiPreferences"]["panels"]["inspectorOpen"] is True


def test_ui_preferences_partial_merge_preserves_other_keys(client):
    """PATCH PARTIEL : poser une clé ne réinitialise pas les autres (par compte)."""
    u = User.objects.create_user(username="ui_merge", email="m@ex.com", password="x", role="annotator")
    _patch_prefs(client, u, {"overlays": {"showUnfairness": False}})
    _patch_prefs(client, u, {"panels": {"triageOpen": True}})
    u.refresh_from_db()
    assert u.ui_preferences["overlays"]["showUnfairness"] is False  # préservé
    assert u.ui_preferences["panels"]["triageOpen"] is True


def test_ui_preferences_whitelist_rejects_arbitrary_keys(client):
    """Whitelist stricte : une clé inconnue est ignorée (jamais de JSON arbitraire stocké)."""
    u = User.objects.create_user(username="ui_wl", email="w@ex.com", password="x", role="annotator")
    r = _patch_prefs(client, u, {"evil": {"x": 1}, "overlays": {"showUnfairness": False}})
    assert r.status_code == 200
    u.refresh_from_db()
    assert "evil" not in u.ui_preferences
    assert u.ui_preferences["overlays"]["showUnfairness"] is False

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

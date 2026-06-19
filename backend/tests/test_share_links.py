"""Liens de partage persistés (chantier D) — révocation, quota, expiration, auth.

L'invité rejoint via son compte AUTHENTIFIÉ (jamais anonyme). Un lien révoqué /
expiré / épuisé est refusé. Le quota n'est décompté que sur une adhésion nouvelle.
"""

from datetime import timedelta

import pytest
from django.utils import timezone

from claire.collaboration.models import ShareLink
from claire.projects.models import ProjectMembership

pytestmark = pytest.mark.django_db


def _link(project, admin_user, **kw):
    kw.setdefault("token", "tok")
    kw.setdefault("role_granted", "annotator")
    return ShareLink.objects.create(project=project, created_by=admin_user, **kw)


def test_admin_creates_persisted_share_link(auth, admin_user, project):
    r = auth(admin_user).post(
        f"/api/v1/projects/{project.slug}/share-links",
        {"roleGranted": "annotator"},
        format="json",
    )
    assert r.status_code == 201, r.content
    data = r.json()
    assert data["token"]
    assert data["usable"] is True
    assert ShareLink.objects.filter(token=data["token"]).exists()


def test_non_admin_cannot_create(auth, annotator, project):
    r = auth(annotator).post(
        f"/api/v1/projects/{project.slug}/share-links",
        {"roleGranted": "annotator"},
        format="json",
    )
    assert r.status_code in (403, 404)


def test_authenticated_user_joins_and_quota_decrements(auth, admin_user, annotator, project):
    _link(project, admin_user, token="tok-join", role_granted="reviewer", max_uses=2)
    r = auth(annotator).post("/api/v1/share-links/tok-join/join", {}, format="json")
    assert r.status_code == 200, r.content
    assert r.json()["joined"] is True
    assert ProjectMembership.objects.filter(
        project=project, user=annotator, role="reviewer"
    ).exists()
    assert ShareLink.objects.get(token="tok-join").used_count == 1

    # Rejoindre alors qu'on est déjà membre ne reconsomme pas de quota.
    r2 = auth(annotator).post("/api/v1/share-links/tok-join/join", {}, format="json")
    assert r2.status_code == 200
    assert r2.json()["joined"] is False
    assert ShareLink.objects.get(token="tok-join").used_count == 1


def test_join_requires_authentication(api_client, admin_user, project):
    _link(project, admin_user, token="tok-anon")
    r = api_client.post("/api/v1/share-links/tok-anon/join", {}, format="json")
    assert r.status_code == 401  # jamais d'accès anonyme


def test_join_rejects_revoked(auth, admin_user, annotator, project):
    _link(project, admin_user, token="tok-rev", revoked=True)
    r = auth(annotator).post("/api/v1/share-links/tok-rev/join", {}, format="json")
    assert r.status_code == 403


def test_join_rejects_expired(auth, admin_user, annotator, project):
    _link(project, admin_user, token="tok-exp", expires_at=timezone.now() - timedelta(hours=1))
    r = auth(annotator).post("/api/v1/share-links/tok-exp/join", {}, format="json")
    assert r.status_code == 403


def test_join_rejects_exhausted(auth, admin_user, annotator, project):
    _link(project, admin_user, token="tok-full", max_uses=0)
    r = auth(annotator).post("/api/v1/share-links/tok-full/join", {}, format="json")
    assert r.status_code == 403


def test_admin_revokes_share_link(auth, admin_user, project):
    _link(project, admin_user, token="tok-x")
    r = auth(admin_user).post(
        f"/api/v1/projects/{project.slug}/share-links/tok-x/revoke", {}, format="json"
    )
    assert r.status_code == 200
    assert ShareLink.objects.get(token="tok-x").revoked is True

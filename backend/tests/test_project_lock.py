"""Verrou NIVEAU PROJET (gel de campagne) : un admin verrouille toutes les sessions
d'un coup. Override prioritaire du verrou par-annotation — un annotateur ne peut ni
éditer, ni soumettre, ni déverrouiller sa session tant que le projet est verrouillé.
"""

import pytest
from rest_framework.test import APIClient

from claire.projects.models import Project, ProjectMembership
from claire.audit.models import ActivityEvent

pytestmark = pytest.mark.django_db

API = "/api/v1"


def _client(user):
    """APIClient DISTINCT par utilisateur — sinon `force_authenticate` sur le client
    partagé écraserait l'identité (piège : admin+annotateur dans le même test)."""
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _add(client, ann_id, anchor=0, theme="META"):
    return client.post(
        f"{API}/annotations/{ann_id}/clauses",
        {"anchorIndex": anchor, "theme": theme, "validated": True},
        format="json",
    )


def _events(project, verb):
    return ActivityEvent.objects.filter(
        verb=verb, target_type="projects.project", target_id=str(project.pk)
    )


# ── un admin verrouille le projet → toutes les sessions gelées (423), audit ─────
def test_admin_locks_project_freezes_all_sessions(
    auth, project, annotation, annotator, admin_user
):
    # En campagne réelle, l'annotateur est membre du projet (peut donc le consulter).
    ProjectMembership.objects.get_or_create(project=project, user=annotator)
    ac = _client(annotator)
    assert _add(ac, annotation.id, anchor=0).status_code == 201  # éditable avant

    # Admin verrouille le projet.
    r = _client(admin_user).post(f"{API}/projects/{project.slug}/lock")
    assert r.status_code == 200, r.content
    assert r.json()["locked"] is True
    project.refresh_from_db()
    assert project.locked is True and project.locked_by_id == admin_user.id
    assert _events(project, "project.locked").count() == 1

    # L'annotateur ne peut plus éditer (423) ni soumettre (423).
    assert _add(ac, annotation.id, anchor=1).status_code == 423
    assert ac.post(f"{API}/annotations/{annotation.id}/submit").status_code == 423
    # Exposé par l'API annotation/projet pour le frontend.
    assert ac.get(f"{API}/projects/{project.slug}").json()["locked"] is True


# ── un annotateur ne peut PAS déverrouiller sa session si le projet est verrouillé ─
def test_annotator_cannot_unlock_session_while_project_locked(
    auth, project, annotation, annotator, admin_user
):
    ac = _client(annotator)
    assert _add(ac, annotation.id).status_code == 201
    _client(admin_user).post(f"{API}/projects/{project.slug}/lock")

    # /unlock individuel refusé (409) tant que le projet est gelé.
    r = ac.post(f"{API}/annotations/{annotation.id}/unlock")
    assert r.status_code == 409, r.content
    # Changement de statut (ici soumettre) également refusé (423) — pas de contournement.
    assert ac.patch(
        f"{API}/annotations/{annotation.id}", {"status": "submitted"}, format="json"
    ).status_code == 423
    # Et /lock individuel ne « rouvre » évidemment rien : édition toujours refusée.
    assert _add(ac, annotation.id, anchor=2).status_code == 423


# ── le déverrouillage projet (admin) rétablit l'édition ─────────────────────────
def test_admin_unlock_project_restores_editing(
    auth, project, annotation, annotator, admin_user
):
    ac = _client(annotator)
    assert _add(ac, annotation.id).status_code == 201
    adm = _client(admin_user)
    adm.post(f"{API}/projects/{project.slug}/lock")
    assert _add(ac, annotation.id, anchor=1).status_code == 423  # gelé

    r = adm.post(f"{API}/projects/{project.slug}/unlock")
    assert r.status_code == 200, r.content
    assert r.json()["locked"] is False
    project.refresh_from_db()
    assert project.locked is False
    assert _events(project, "project.unlocked").count() == 1

    # Édition de nouveau possible.
    assert _add(ac, annotation.id, anchor=1).status_code == 201


# ── lock/unlock projet IDEMPOTENTS ──────────────────────────────────────────────
def test_project_lock_unlock_idempotent(auth, project, admin_user):
    adm = _client(admin_user)
    assert adm.post(f"{API}/projects/{project.slug}/lock").status_code == 200
    assert adm.post(f"{API}/projects/{project.slug}/lock").status_code == 200
    assert _events(project, "project.locked").count() == 1  # un seul événement
    assert adm.post(f"{API}/projects/{project.slug}/unlock").status_code == 200
    assert adm.post(f"{API}/projects/{project.slug}/unlock").status_code == 200
    project.refresh_from_db()
    assert project.locked is False


# ── permission : un annotateur ne peut PAS verrouiller le projet ────────────────
def test_annotator_cannot_lock_project(auth, project, annotator):
    r = _client(annotator).post(f"{API}/projects/{project.slug}/lock")
    assert r.status_code in (403, 404), r.content
    project.refresh_from_db()
    assert project.locked is False


# ── le rollup documents expose le verrou de session (point 2 — badges de statut) ─
def test_documents_rollup_exposes_session_locked(auth, project, annotation, annotator):
    ProjectMembership.objects.get_or_create(project=project, user=annotator)
    ac = _client(annotator)
    assert _add(ac, annotation.id).status_code == 201

    # Avant soumission : session non verrouillée, statut draft.
    rows = ac.get(f"{API}/projects/{project.slug}/documents").json()["results"]
    mine = next(r for r in rows if r["document"]["id"] == annotation.document_id)
    assert mine["mySession"]["locked"] is False
    assert mine["mySession"]["status"] == "draft"

    # Après soumission : auto-verrou → locked True, statut submitted.
    assert ac.post(f"{API}/annotations/{annotation.id}/submit").status_code == 200
    rows = ac.get(f"{API}/projects/{project.slug}/documents").json()["results"]
    mine = next(r for r in rows if r["document"]["id"] == annotation.document_id)
    assert mine["mySession"]["locked"] is True
    assert mine["mySession"]["status"] == "submitted"


# ── le verrou projet n'efface PAS les verrous par-annotation (indépendance) ─────
def test_project_unlock_keeps_annotation_locks(
    auth, project, annotation, annotator, admin_user
):
    ac = _client(annotator)
    assert _add(ac, annotation.id).status_code == 201
    # L'annotateur soumet → sa session est verrouillée (annotation-level).
    assert ac.post(f"{API}/annotations/{annotation.id}/submit").status_code == 200
    annotation.refresh_from_db()
    assert annotation.locked is True

    adm = _client(admin_user)
    adm.post(f"{API}/projects/{project.slug}/lock")
    adm.post(f"{API}/projects/{project.slug}/unlock")

    # Le verrou projet levé, mais la session reste verrouillée (soumise) : édition 423.
    annotation.refresh_from_db()
    assert annotation.locked is True
    assert _add(ac, annotation.id, anchor=1).status_code == 423
    # L'annotateur peut maintenant déverrouiller SA session (projet plus gelé).
    assert ac.post(f"{API}/annotations/{annotation.id}/unlock").status_code == 200

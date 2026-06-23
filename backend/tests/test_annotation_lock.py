"""Verrouillage / déverrouillage d'annotation (point 2) : auto-lock à la soumission,
lock/unlock manuels, refus d'écriture (423) tant que verrouillé, réouverture d'un
document soumis, permissions (propriétaire + relecteur/admin), audit.

Garantit qu'une campagne peut figer un document soumis tout en permettant d'y revenir.
"""

import pytest

from claire.annotations.models import Annotation, AnnotationStatus, Clause
from claire.annotations.services import transition_status
from claire.audit.models import ActivityEvent
from tests.conftest import UserFactory

pytestmark = pytest.mark.django_db

API = "/api/v1"


def _add(client, ann_id, anchor=0, theme="META"):
    return client.post(
        f"{API}/annotations/{ann_id}/clauses",
        {"anchorIndex": anchor, "theme": theme, "validated": True},
        format="json",
    )


def _submit(client, ann_id):
    return client.post(f"{API}/annotations/{ann_id}/submit")


def _events(annotation, verb):
    return ActivityEvent.objects.filter(
        verb=verb, target_type="annotations.annotation", target_id=str(annotation.pk)
    )


# ── auto-lock : soumettre VERROUILLE automatiquement ────────────────────────────
def test_submit_auto_locks(auth, annotation, annotator):
    c = auth(annotator)
    assert _add(c, annotation.id).status_code == 201
    r = _submit(c, annotation.id)
    assert r.status_code == 200, r.content
    annotation.refresh_from_db()
    assert annotation.status == AnnotationStatus.SUBMITTED
    assert annotation.locked is True
    assert annotation.locked_at is not None
    assert annotation.locked_by_id == annotator.id
    # Exposé par l'API (le frontend en a besoin pour le bandeau/lecture seule).
    body = c.get(f"{API}/annotations/{annotation.id}").json()
    assert body["locked"] is True


# ── un document VERROUILLÉ refuse TOUTE écriture de clause (423) ─────────────────
def test_locked_rejects_all_clause_writes(auth, annotation, annotator):
    c = auth(annotator)
    add = _add(c, annotation.id, anchor=0)
    cid = add.json()["id"]
    assert _submit(c, annotation.id).status_code == 200  # verrouille

    # add_clause (nouvelle ancre)
    assert _add(c, annotation.id, anchor=1).status_code == 423
    # PATCH clause
    assert c.patch(f"{API}/clauses/{cid}", {"certainty": 1}, format="json").status_code == 423
    # batch
    assert c.post(
        f"{API}/annotations/{annotation.id}/clauses/batch",
        {"clauses": [{"anchorIndex": 2, "theme": "META"}]},
        format="json",
    ).status_code == 423
    # swap-primary
    assert c.post(f"{API}/clauses/{cid}/swap-primary", {"label": "META"}, format="json").status_code == 423
    # boundary
    assert c.post(f"{API}/clauses/{cid}/boundary", {"op": "set_soft"}, format="json").status_code == 423
    # DELETE clause
    assert c.delete(f"{API}/clauses/{cid}").status_code == 423

    # DB intacte : la clause initiale est toujours là, inchangée, et seule.
    assert Clause.objects.filter(annotation=annotation).count() == 1
    row = Clause.objects.get(pk=cid)
    assert row.certainty is None and row.boundary_type == "hard"


# ── un doc verrouillé refuse aussi l'édition de global_certainty (contenu gelé) ──
def test_locked_rejects_global_certainty_edit(auth, annotation, annotator):
    c = auth(annotator)
    assert _add(c, annotation.id).status_code == 201
    c.post(f"{API}/annotations/{annotation.id}/lock")
    r = c.patch(
        f"{API}/annotations/{annotation.id}", {"globalCertainty": 2}, format="json"
    )
    assert r.status_code == 423, r.content
    annotation.refresh_from_db()
    assert annotation.global_certainty is None  # rien écrit


# ── déverrouiller un document SOUMIS le ROUVRE en draft (on y revient) ──────────
def test_unlock_submitted_reopens_to_draft_and_resubmit_relocks(auth, annotation, annotator):
    c = auth(annotator)
    assert _add(c, annotation.id).status_code == 201
    assert _submit(c, annotation.id).status_code == 200
    annotation.refresh_from_db()
    assert annotation.locked and annotation.versions.count() == 1

    # unlock → réouverture en draft, déverrouillé, SANS nouveau snapshot.
    r = c.post(f"{API}/annotations/{annotation.id}/unlock")
    assert r.status_code == 200, r.content
    annotation.refresh_from_db()
    assert annotation.status == AnnotationStatus.DRAFT
    assert annotation.locked is False
    assert annotation.versions.count() == 1  # la réouverture ne snapshot pas

    # On peut de nouveau éditer (plus de 423).
    assert _add(c, annotation.id, anchor=1).status_code == 201

    # Re-soumission → nouvelle version + re-verrouillage.
    assert _submit(c, annotation.id).status_code == 200
    annotation.refresh_from_db()
    assert annotation.locked is True
    assert annotation.versions.count() == 2


# ── un état TERMINAL/revue verrouillé n'est PAS déverrouillable (contenu protégé) ─
@pytest.mark.parametrize(
    "to_status",
    [AnnotationStatus.APPROVED, AnnotationStatus.ARCHIVED, AnnotationStatus.REJECTED],
)
def test_unlock_refused_on_post_review_states(
    auth, annotation, annotator, admin_user, to_status
):
    c = auth(annotator)
    assert _add(c, annotation.id).status_code == 201
    # Mène à l'état cible par la FSM (submitted verrouille, états suivants gardent le verrou).
    transition_status(annotation, AnnotationStatus.SUBMITTED, admin_user)
    if to_status == AnnotationStatus.ARCHIVED:
        transition_status(annotation, AnnotationStatus.ARCHIVED, admin_user)
    else:
        transition_status(annotation, AnnotationStatus.IN_REVIEW, admin_user)
        transition_status(annotation, to_status, admin_user)
    annotation.refresh_from_db()
    assert annotation.locked is True

    # unlock → refusé (409) ; le document reste verrouillé.
    r = c.post(f"{API}/annotations/{annotation.id}/unlock")
    assert r.status_code == 409, r.content
    annotation.refresh_from_db()
    assert annotation.locked is True
    # Et le contenu reste protégé : on ne peut pas ajouter de clause (423).
    assert _add(c, annotation.id, anchor=1).status_code == 423


# ── lock / unlock MANUELS sur un brouillon (sans soumettre) ─────────────────────
def test_manual_lock_unlock_on_draft(auth, annotation, annotator):
    c = auth(annotator)
    assert _add(c, annotation.id).status_code == 201

    # lock manuel d'un brouillon → verrouillé, statut inchangé (draft).
    r = c.post(f"{API}/annotations/{annotation.id}/lock")
    assert r.status_code == 200, r.content
    annotation.refresh_from_db()
    assert annotation.locked is True and annotation.status == AnnotationStatus.DRAFT
    # écriture refusée
    assert _add(c, annotation.id, anchor=1).status_code == 423

    # unlock manuel → déverrouillé, toujours draft (pas de transition).
    assert c.post(f"{API}/annotations/{annotation.id}/unlock").status_code == 200
    annotation.refresh_from_db()
    assert annotation.locked is False and annotation.status == AnnotationStatus.DRAFT
    # écriture de nouveau permise
    assert _add(c, annotation.id, anchor=1).status_code == 201


# ── lock / unlock sont IDEMPOTENTS ──────────────────────────────────────────────
def test_lock_unlock_idempotent(auth, annotation, annotator):
    c = auth(annotator)
    assert _add(c, annotation.id).status_code == 201
    assert c.post(f"{API}/annotations/{annotation.id}/lock").status_code == 200
    assert c.post(f"{API}/annotations/{annotation.id}/lock").status_code == 200  # re-lock no-op
    annotation.refresh_from_db()
    assert annotation.locked is True
    assert _events(annotation, "annotation.locked").count() == 1  # un seul événement

    assert c.post(f"{API}/annotations/{annotation.id}/unlock").status_code == 200
    assert c.post(f"{API}/annotations/{annotation.id}/unlock").status_code == 200  # re-unlock no-op
    annotation.refresh_from_db()
    assert annotation.locked is False


# ── audit : lock/unlock journalisés ─────────────────────────────────────────────
def test_lock_unlock_emit_audit_events(auth, annotation, annotator):
    c = auth(annotator)
    assert _add(c, annotation.id).status_code == 201
    c.post(f"{API}/annotations/{annotation.id}/lock")
    assert _events(annotation, "annotation.locked").count() == 1
    c.post(f"{API}/annotations/{annotation.id}/unlock")
    assert _events(annotation, "annotation.unlocked").count() == 1


# ── permissions : propriétaire + relecteur/admin OK ; étranger refusé ───────────
def test_owner_can_lock_unlock(auth, annotation, annotator):
    c = auth(annotator)
    assert _add(c, annotation.id).status_code == 201
    assert c.post(f"{API}/annotations/{annotation.id}/lock").status_code == 200
    assert c.post(f"{API}/annotations/{annotation.id}/unlock").status_code == 200


def test_reviewer_can_lock(auth, annotation, annotator, reviewer):
    auth(annotator)  # le propriétaire pose une clause
    _add(auth(annotator), annotation.id)
    # Le relecteur (rôle transverse) peut verrouiller.
    rc = auth(reviewer)
    assert rc.post(f"{API}/annotations/{annotation.id}/lock").status_code == 200
    annotation.refresh_from_db()
    assert annotation.locked is True


def test_stranger_annotator_cannot_lock(auth, annotation, annotator):
    _add(auth(annotator), annotation.id)
    bob = UserFactory(username="bob", role="annotator")  # ni propriétaire ni relecteur
    bc = auth(bob)
    # Indépendance des sessions : bob ne voit même pas l'annotation d'autrui → 404.
    assert bc.post(f"{API}/annotations/{annotation.id}/lock").status_code == 404
    annotation.refresh_from_db()
    assert annotation.locked is False

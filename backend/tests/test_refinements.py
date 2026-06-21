"""Raffinements R1–R3 : lecture seule stricte, synchro statut, endpoint IAA."""

import pytest

from tests.conftest import UserFactory

pytestmark = pytest.mark.django_db


# ── R1 — Lecture seule STRICTE sur l'annotation d'autrui (intégrité IAA) ─────────
def test_admin_cannot_add_clause_to_others_annotation(
    auth, annotation, scheme_with_themes, admin_user
):
    """Même un admin ne peut pas éditer le CONTENU de l'annotation d'un tiers."""
    resp = auth(admin_user).post(
        f"/api/v1/annotations/{annotation.id}/clauses",
        {"anchorIndex": 0, "theme": "META"}, format="json",
    )
    assert resp.status_code == 403, resp.content


def test_admin_cannot_patch_others_annotation(
    auth, annotation, scheme_with_themes, admin_user
):
    resp = auth(admin_user).patch(
        f"/api/v1/annotations/{annotation.id}",
        {"global_certainty": 2}, format="json",
    )
    assert resp.status_code == 403, resp.content


def test_reviewer_cannot_edit_others_annotation_content(
    auth, annotation, scheme_with_themes, reviewer
):
    """Le reviewer agit via /reviews, jamais en modifiant les clauses."""
    resp = auth(reviewer).post(
        f"/api/v1/annotations/{annotation.id}/clauses",
        {"anchorIndex": 0, "theme": "META"}, format="json",
    )
    assert resp.status_code == 403, resp.content


def test_admin_cannot_patch_others_clause(
    auth, annotation, scheme_with_themes, admin_user
):
    """Le propriétaire crée une clause ; l'admin ne peut pas la modifier."""
    owner = auth(annotation.annotator)
    created = owner.post(
        f"/api/v1/annotations/{annotation.id}/clauses",
        {"anchorIndex": 0, "theme": "META"}, format="json",
    )
    clause_id = created.json()["id"]
    resp = auth(admin_user).patch(
        f"/api/v1/clauses/{clause_id}", {"theme": "TERMINATION"}, format="json",
    )
    assert resp.status_code == 403, resp.content


def test_owner_still_edits_own_annotation(
    auth, annotation, scheme_with_themes
):
    """Garde-fou : le durcissement R1 ne casse pas le propriétaire."""
    resp = auth(annotation.annotator).post(
        f"/api/v1/annotations/{annotation.id}/clauses",
        {"anchorIndex": 0, "theme": "META"}, format="json",
    )
    assert resp.status_code == 201, resp.content


def test_owner_can_patch_and_delete_own_clause(
    auth, annotation, scheme_with_themes
):
    """Régression (bug 403 PATCH/DELETE /clauses) : DRF vérifie la permission sur la
    CLAUSE (objet du queryset), pas l'annotation. IsAnnotationOwner doit remonter à
    clause.annotation.annotator_id, sinon le PROPRIÉTAIRE lui-même est rejeté."""
    owner = auth(annotation.annotator)
    created = owner.post(
        f"/api/v1/annotations/{annotation.id}/clauses",
        {"anchorIndex": 0, "theme": "META"}, format="json",
    )
    assert created.status_code == 201, created.content
    clause_id = created.json()["id"]

    patched = owner.patch(
        f"/api/v1/clauses/{clause_id}", {"theme": "TERMINATION"}, format="json",
    )
    assert patched.status_code == 200, patched.content

    deleted = owner.delete(f"/api/v1/clauses/{clause_id}")
    assert deleted.status_code in (200, 204), deleted.content


def test_add_clause_numeric_client_op_id_no_500(
    auth, annotation, scheme_with_themes
):
    """Régression (bug 500 'int has no strip') : un clientOpId NUMÉRIQUE (id serveur
    d'une clause restaurée par un undo) ne doit pas faire planter add_clause."""
    resp = auth(annotation.annotator).post(
        f"/api/v1/annotations/{annotation.id}/clauses",
        {"anchorIndex": 0, "theme": "META", "clientOpId": 123},
        format="json",
    )
    assert resp.status_code in (200, 201), resp.content


# ── R2 — Synchro Assignment.status ↔ état de l'Annotation ───────────────────────
def test_assignment_status_syncs_with_annotation_lifecycle(
    auth, annotation, scheme_with_themes
):
    from claire.projects.models import Assignment, AssignmentStatus

    assignment = Assignment.objects.create(
        project=annotation.project,
        document=annotation.document,
        assignee=annotation.annotator,
    )
    assert assignment.status == AssignmentStatus.PENDING

    client = auth(annotation.annotator)
    # 1) Pose d'une clause → in_progress.
    client.post(
        f"/api/v1/annotations/{annotation.id}/clauses",
        {"anchorIndex": 0, "theme": "META"}, format="json",
    )
    assignment.refresh_from_db()
    assert assignment.status == AssignmentStatus.IN_PROGRESS

    # 2) Soumission → done.
    client.post(f"/api/v1/annotations/{annotation.id}/submit")
    assignment.refresh_from_db()
    assert assignment.status == AssignmentStatus.DONE


def test_assignment_returns_to_pending_when_last_clause_removed(
    db, annotation, scheme_with_themes, document_with_sentences
):
    """post_delete : retirer la dernière clause d'un brouillon → pending."""
    from claire.annotations.models import Clause
    from claire.projects.models import Assignment, AssignmentStatus

    assignment = Assignment.objects.create(
        project=annotation.project,
        document=annotation.document,
        assignee=annotation.annotator,
    )
    sentence = document_with_sentences.sentences.get(index=0)
    clause = Clause.objects.create(
        annotation=annotation,
        anchor_sentence=sentence,
        theme=scheme_with_themes.themes_map["META"],
    )
    assignment.refresh_from_db()
    assert assignment.status == AssignmentStatus.IN_PROGRESS

    clause.delete()
    assignment.refresh_from_db()
    assert assignment.status == AssignmentStatus.PENDING


# ── R3 — Endpoint IAA : matrice paire-à-paire + détail ──────────────────────────
def test_project_iaa_endpoint_returns_pairs(
    auth, project, document_with_sentences, scheme_with_themes, admin_user
):
    from claire.annotations.models import Annotation, AnnotationStatus, Clause

    document_with_sentences.n_sentences = 5
    document_with_sentences.save()
    meta = scheme_with_themes.themes_map["META"]
    term = scheme_with_themes.themes_map["TERMINATION"]
    u1 = UserFactory()
    u2 = UserFactory()
    s = {i: document_with_sentences.sentences.get(index=i) for i in range(5)}
    for user in (u1, u2):
        ann = Annotation.objects.create(
            project=project, document=document_with_sentences, annotator=user,
            status=AnnotationStatus.SUBMITTED,
        )
        Clause.objects.create(annotation=ann, anchor_sentence=s[0], theme=meta)
        Clause.objects.create(annotation=ann, anchor_sentence=s[3], theme=term)

    resp = auth(admin_user).get(f"/api/v1/projects/{project.slug}/iaa")
    assert resp.status_code == 200, resp.content
    data = resp.json()
    # Rendu camelCase (pont DRF) : meanKappa / pairs[].annotatorA / nSentences.
    assert data["meanKappa"] == 1.0
    assert len(data["pairs"]) == 1
    pair = data["pairs"][0]
    assert pair["document"] == document_with_sentences.external_id
    assert {pair["annotatorA"], pair["annotatorB"]} == {u1.username, u2.username}
    assert pair["kappa"] == 1.0
    assert pair["nSentences"] == 5
    assert data["detail"]["globalKappa"] == 1.0

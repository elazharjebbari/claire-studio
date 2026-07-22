"""Batterie « campagne-ready » : persistance DB intégrale + soumission sans perte.

Objectif : garantir, AVANT de lancer une vraie campagne d'annotation, que
  (1) TOUT champ saisi par l'annotateur est bien écrit en base (relecture API ET
      relecture DB directe — y compris les champs jamais exposés par l'API) ;
  (2) la SOUMISSION fonctionne de bout en bout (statut, audit, version) et fige un
      snapshot FIDÈLE : aucune donnée manquante (multi-label, frontière, triage…).

Couvre les trous identifiés à la cartographie : round-trip DB complet, fidélité du
snapshot de soumission, client_op_id persisté, global_certainty, ordre contigu,
et le comportement (non gardé) de la soumission d'une annotation vide.
"""

import pytest

from claire.annotations.models import (
    AnnotationStatus,
    AnnotationVersion,
    Clause,
    ClauseTheme,
)
from claire.annotations.services import build_snapshot
from claire.audit.models import ActivityEvent

pytestmark = pytest.mark.django_db

API = "/api/v1"


def _add(client, ann_id, payload):
    return client.post(f"{API}/annotations/{ann_id}/clauses", payload, format="json")


def _clauses_api(client, ann_id):
    return client.get(f"{API}/annotations/{ann_id}").json()["clauses"]


def _latest_version(annotation):
    return (
        AnnotationVersion.objects.filter(annotation=annotation)
        .order_by("-number")
        .first()
    )


# ── 1. Fidélité intégrale d'une clause MONO (API + DB directe) ──────────────────
def test_mono_clause_full_field_fidelity_api_and_db(auth, annotation, annotator):
    c = auth(annotator)
    r = _add(
        c,
        annotation.id,
        {
            "anchorIndex": 1,
            "theme": "TERMINATION",
            "legalNature": "OBLIGATION",
            "evidenceSpan": "may terminate at any time",
            "rationale": "résiliation unilatérale du contrat",
            "certainty": 3,
            "validated": True,
            "boundary": {"type": "soft", "support": 2},
            "triageLevel": "C4",
            "clientOpId": "op-mono-1",
        },
    )
    assert r.status_code == 201, r.content
    cid = r.json()["id"]

    # (a) Relecture API : tous les champs exposés.
    api = next(x for x in _clauses_api(c, annotation.id) if x["anchorIndex"] == 1)
    assert api["theme"] == "TERMINATION"
    assert api["legalNature"] == "OBLIGATION"
    assert api["evidenceSpan"] == "may terminate at any time"
    assert api["rationale"] == "résiliation unilatérale du contrat"
    assert api["certainty"] == 3
    assert api["validated"] is True
    assert api["boundary"] == {"type": "soft", "support": 2}
    assert api["triageLevel"] == "C4"

    # (b) Relecture DB DIRECTE — dont client_op_id, jamais exposé par l'API.
    row = Clause.objects.get(pk=cid)
    assert row.anchor_sentence.index == 1
    assert row.theme.code == "TERMINATION"
    assert row.legal_nature.code == "OBLIGATION"
    assert row.evidence_span == "may terminate at any time"
    assert row.rationale == "résiliation unilatérale du contrat"
    assert row.certainty == 3
    assert row.validated is True
    assert row.boundary_type == "soft"
    assert row.boundary_support == 2
    assert row.triage_level == "C4"
    assert row.client_op_id == "op-mono-1"


# ── 2. Fidélité d'une clause MULTI-LABEL (tags primaire + secondaires) ──────────
def test_multilabel_clause_persists_all_tags(auth, annotation, annotator):
    c = auth(annotator)
    r = _add(
        c,
        annotation.id,
        {
            "anchorIndex": 2,
            "themes": [
                {"label": "TERMINATION", "role": "primary", "support": 0},
                {"label": "META", "role": "secondary", "support": 0},
            ],
            "evidenceSpan": "preuve",
            "certainty": 2,
            "validated": True,
        },
    )
    assert r.status_code == 201, r.content
    cid = r.json()["id"]

    # API : scalaire `theme` = miroir du primaire + liste `themes` complète.
    api = next(x for x in _clauses_api(c, annotation.id) if x["anchorIndex"] == 2)
    assert api["theme"] == "TERMINATION"
    assert {t["label"]: t["role"] for t in api["themes"]} == {
        "TERMINATION": "primary",
        "META": "secondary",
    }

    # DB : 2 ClauseTheme, exactement 1 primaire ; le scalaire `theme` suit le primaire.
    tags = ClauseTheme.objects.filter(clause_id=cid)
    assert tags.count() == 2
    assert tags.filter(role="primary").count() == 1
    assert tags.get(role="primary").theme.code == "TERMINATION"
    assert set(
        tags.filter(role="secondary").values_list("theme__code", flat=True)
    ) == {"META"}
    assert Clause.objects.get(pk=cid).theme.code == "TERMINATION"


# ── 3. SOUMISSION de bout en bout : statut + audit + version + snapshot fidèle ──
def test_submit_end_to_end_no_data_loss_in_snapshot(auth, annotation, annotator):
    c = auth(annotator)
    # Clause mono complète.
    assert (
        _add(
            c,
            annotation.id,
            {
                "anchorIndex": 0,
                "theme": "META",
                "legalNature": "OBLIGATION",
                "evidenceSpan": "dated January 2026",
                "rationale": "métadonnées",
                "certainty": 1,
                "validated": True,
                "boundary": {"type": "hard", "support": 3},
                "triageLevel": "C1",
            },
        ).status_code
        == 201
    )
    # Clause multi-label avec triage.
    assert (
        _add(
            c,
            annotation.id,
            {
                "anchorIndex": 3,
                "themes": [
                    {"label": "TERMINATION", "role": "primary", "support": 0},
                    {"label": "META", "role": "secondary", "support": 0},
                ],
                "evidenceSpan": "may terminate",
                "rationale": "résiliation",
                "certainty": 3,
                "validated": True,
                "triageLevel": "C3",
            },
        ).status_code
        == 201
    )

    before = AnnotationVersion.objects.filter(annotation=annotation).count()
    r = c.post(f"{API}/annotations/{annotation.id}/submit")
    assert r.status_code == 200, r.content

    annotation.refresh_from_db()
    assert annotation.status == AnnotationStatus.SUBMITTED

    # Audit : un événement annotation.submitted ciblant CETTE annotation.
    assert ActivityEvent.objects.filter(
        verb="annotation.submitted", target_id=str(annotation.id)
    ).exists()

    # Une version de soumission immuable a été créée.
    assert (
        AnnotationVersion.objects.filter(annotation=annotation).count() == before + 1
    )
    snap = _latest_version(annotation).snapshot
    assert snap["status"] == "submitted"
    by_anchor = {cl["anchor_index"]: cl for cl in snap["clauses"]}

    # Mono : tous les champs préservés dans le snapshot figé.
    m = by_anchor[0]
    assert m["theme"] == "META"
    assert m["legal_nature"] == "OBLIGATION"
    assert m["evidence_span"] == "dated January 2026"
    assert m["rationale"] == "métadonnées"
    assert m["certainty"] == 1
    assert m["validated"] is True
    assert m["boundary"] == {"type": "hard", "support": 3}
    assert m["triage_level"] == "C1"

    # Multi-label : les SECONDAIRES ne sont PAS perdus au snapshot.
    ml = by_anchor[3]
    assert ml["theme"] == "TERMINATION"
    assert ml["triage_level"] == "C3"
    assert {t["label"]: t["role"] for t in ml["themes"]} == {
        "TERMINATION": "primary",
        "META": "secondary",
    }


# ── 4. Le snapshot figé == l'état DB vivant (aucune divergence) ─────────────────
def test_submitted_snapshot_matches_live_db(auth, annotation, annotator):
    c = auth(annotator)
    _add(
        c,
        annotation.id,
        {
            "anchorIndex": 1,
            "themes": [
                {"label": "TERMINATION", "role": "primary", "support": 0},
                {"label": "META", "role": "secondary", "support": 0},
            ],
            "certainty": 2,
            "validated": True,
            "boundary": {"type": "soft", "support": 2},
            "triageLevel": "C2",
        },
    )
    assert c.post(f"{API}/annotations/{annotation.id}/submit").status_code == 200
    annotation.refresh_from_db()

    # Aucune mutation post-soumission → le snapshot doit refléter exactement la DB.
    live = build_snapshot(annotation)
    assert _latest_version(annotation).snapshot["clauses"] == live["clauses"]


# ── 5. global_certainty : round-trip via PATCH annotation ───────────────────────
def test_global_certainty_roundtrip(auth, annotation, annotator):
    c = auth(annotator)
    r = c.patch(
        f"{API}/annotations/{annotation.id}", {"globalCertainty": 2}, format="json"
    )
    assert r.status_code == 200, r.content
    annotation.refresh_from_db()
    assert annotation.global_certainty == 2
    assert (
        c.get(f"{API}/annotations/{annotation.id}").json()["globalCertainty"] == 2
    )


# ── 6. Ordre contigu (pas de trou) sur des ajouts successifs ────────────────────
def test_order_is_contiguous_across_adds(auth, annotation, annotator):
    c = auth(annotator)
    for anchor in (0, 2, 4):
        assert (
            _add(
                c,
                annotation.id,
                {"anchorIndex": anchor, "theme": "META", "validated": True},
            ).status_code
            == 201
        )
    orders = sorted(
        Clause.objects.filter(annotation=annotation).values_list("order", flat=True)
    )
    assert orders == [0, 1, 2]


# ── 7. Soumission d'une annotation VIDE REFUSÉE (garde-fou serveur, point 1) ─────
def test_empty_annotation_submission_is_rejected(auth, annotation, annotator):
    """Filet de sécurité serveur : une annotation à 0 clause ne peut PAS être soumise
    (409). Aucune transition, aucun snapshot, statut inchangé."""
    c = auth(annotator)
    r = c.post(f"{API}/annotations/{annotation.id}/submit")
    assert r.status_code == 409, r.content
    annotation.refresh_from_db()
    assert annotation.status == AnnotationStatus.DRAFT
    assert annotation.versions.count() == 0
    assert annotation.locked is False

    # Même refus via PATCH status=submitted (l'autre chemin de soumission).
    r2 = c.patch(f"{API}/annotations/{annotation.id}", {"status": "submitted"}, format="json")
    assert r2.status_code == 409, r2.content
    annotation.refresh_from_db()
    assert annotation.status == AnnotationStatus.DRAFT

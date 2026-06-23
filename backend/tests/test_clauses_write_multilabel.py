"""Lot 2b-endpoints — écriture multi-label : add_clause/themes, batch, swap-primary, boundary."""

import pytest

from claire.annotations.models import Clause, ClauseTheme

pytestmark = pytest.mark.django_db


def _roles(resp_json):
    return {(t["label"], t["role"]) for t in resp_json["themes"]}


def test_add_clause_multilabel(annotation, annotator, auth):
    c = auth(annotator)
    r = c.post(
        f"/api/v1/annotations/{annotation.id}/clauses",
        {"anchorIndex": 0, "themes": [
            {"label": "TERMINATION", "role": "primary"},
            {"label": "META", "role": "secondary"},
        ]}, format="json",
    )
    assert r.status_code == 201, r.content
    body = r.json()
    assert body["theme"] == "TERMINATION"  # miroir du primaire
    assert _roles(body) == {("TERMINATION", "primary"), ("META", "secondary")}
    clause = Clause.objects.get(id=body["id"])
    assert clause.theme_tags.count() == 2


def test_add_clause_refuse_refuge_secondary(annotation, annotator, auth):
    c = auth(annotator)
    r = c.post(
        f"/api/v1/annotations/{annotation.id}/clauses",
        {"anchorIndex": 1, "theme": "TERMINATION", "themes": [
            {"label": "TERMINATION", "role": "primary"},
            {"label": "PREAMBLE_SCOPE", "role": "secondary"},  # refuge interdit
        ]}, format="json",
    )
    # DRF renvoie 400 pour une ValidationError d'invariant (refuge en secondaire).
    assert r.status_code == 400, r.content
    assert "refuge" in r.content.decode().lower()
    assert not Clause.objects.filter(annotation=annotation, anchor_sentence__index=1).exists()


def test_add_clause_mono_gets_primary_tag(annotation, annotator, auth):
    c = auth(annotator)
    r = c.post(
        f"/api/v1/annotations/{annotation.id}/clauses",
        {"anchorIndex": 2, "theme": "META"}, format="json",
    )
    assert r.status_code == 201
    clause = Clause.objects.get(id=r.json()["id"])
    tags = list(clause.theme_tags.all())
    assert len(tags) == 1 and tags[0].role == "primary" and tags[0].theme.code == "META"


def test_batch_accept_and_idempotent(annotation, annotator, auth):
    c = auth(annotator)
    payload = {"clauses": [
        {"anchorIndex": 0, "theme": "META", "clientOpId": "op-0", "triageLevel": "C1",
         "boundary": {"type": "hard", "support": 3}},
        {"anchorIndex": 1, "theme": "TERMINATION", "clientOpId": "op-1"},
    ]}
    r = c.post(f"/api/v1/annotations/{annotation.id}/clauses/batch", payload, format="json")
    assert r.status_code == 201, r.content
    assert len(r.json()["created"]) == 2
    assert annotation.clauses.count() == 2
    first = annotation.clauses.get(anchor_sentence__index=0)
    assert first.triage_level == "C1" and first.boundary_support == 3
    # idempotence : rejouer le même lot ne crée pas de doublon.
    r2 = c.post(f"/api/v1/annotations/{annotation.id}/clauses/batch", payload, format="json")
    assert r2.status_code == 201
    assert annotation.clauses.count() == 2


def test_batch_reports_inv2_conflict(annotation, annotator, auth):
    c = auth(annotator)
    c.post(f"/api/v1/annotations/{annotation.id}/clauses",
           {"anchorIndex": 0, "theme": "META"}, format="json")
    payload = {"clauses": [
        {"anchorIndex": 0, "theme": "TERMINATION"},  # déjà annotée → conflit
        {"anchorIndex": 3, "theme": "TERMINATION"},  # ok
    ]}
    r = c.post(f"/api/v1/annotations/{annotation.id}/clauses/batch", payload, format="json")
    assert r.status_code == 201
    body = r.json()
    assert len(body["created"]) == 1
    assert len(body["conflicts"]) == 1 and body["conflicts"][0]["anchorIndex"] == 0


def test_patch_themes_replaces_set(annotation, annotator, auth):
    c = auth(annotator)
    r = c.post(f"/api/v1/annotations/{annotation.id}/clauses",
               {"anchorIndex": 0, "theme": "META"}, format="json")
    cid = r.json()["id"]
    r2 = c.patch(f"/api/v1/clauses/{cid}", {"themes": [
        {"label": "LICENSE_IP" if False else "TERMINATION", "role": "primary"},
        {"label": "META", "role": "secondary"},
    ]}, format="json")
    assert r2.status_code == 200, r2.content
    assert _roles(r2.json()) == {("TERMINATION", "primary"), ("META", "secondary")}


def test_swap_primary(annotation, annotator, auth):
    c = auth(annotator)
    r = c.post(f"/api/v1/annotations/{annotation.id}/clauses",
               {"anchorIndex": 0, "theme": "TERMINATION", "themes": [
                   {"label": "TERMINATION", "role": "primary"},
                   {"label": "META", "role": "secondary"},
               ]}, format="json")
    cid = r.json()["id"]
    r2 = c.post(f"/api/v1/clauses/{cid}/swap-primary", {"label": "META"}, format="json")
    assert r2.status_code == 200, r2.content
    body = r2.json()
    assert body["theme"] == "META"  # miroir mis à jour
    assert _roles(body) == {("META", "primary"), ("TERMINATION", "secondary")}


def test_add_clause_conflict_without_upsert(annotation, annotator, auth):
    """Sans `upsert`, réannoter une phrase déjà couverte reste un 409 (INV-2)."""
    c = auth(annotator)
    c.post(f"/api/v1/annotations/{annotation.id}/clauses",
           {"anchorIndex": 0, "theme": "META"}, format="json")
    r = c.post(f"/api/v1/annotations/{annotation.id}/clauses",
               {"anchorIndex": 0, "theme": "TERMINATION"}, format="json")
    assert r.status_code == 409, r.content
    assert annotation.clauses.filter(anchor_sentence__index=0).count() == 1


def test_add_clause_upsert_updates_existing(annotation, annotator, auth):
    """Acceptation de triage : `upsert` MET À JOUR la clause existante (200), pas de 409,
    pas de doublon ; le set multi-label, la frontière, le niveau et validated sont posés."""
    c = auth(annotator)
    r0 = c.post(f"/api/v1/annotations/{annotation.id}/clauses",
                {"anchorIndex": 0, "theme": "META"}, format="json")
    cid = r0.json()["id"]
    r = c.post(
        f"/api/v1/annotations/{annotation.id}/clauses",
        {"anchorIndex": 0, "theme": "TERMINATION", "upsert": True, "validated": True,
         "triageLevel": "C2", "boundary": {"type": "soft", "support": 2},
         "themes": [
             {"label": "TERMINATION", "role": "primary"},
             {"label": "META", "role": "secondary"},
         ]},
        format="json",
    )
    assert r.status_code == 200, r.content
    body = r.json()
    assert body["id"] == cid  # MÊME clause, mise à jour (INV-2 préservé)
    assert annotation.clauses.filter(anchor_sentence__index=0).count() == 1
    assert body["theme"] == "TERMINATION"
    assert _roles(body) == {("TERMINATION", "primary"), ("META", "secondary")}
    assert body["boundary"] == {"type": "soft", "support": 2}
    assert body["triageLevel"] == "C2"
    assert body["validated"] is True


def test_batch_upsert_updates_existing(annotation, annotator, auth):
    """Lot C1 avec `upsert` : la phrase déjà annotée est mise à jour (aucun conflit)."""
    c = auth(annotator)
    c.post(f"/api/v1/annotations/{annotation.id}/clauses",
           {"anchorIndex": 0, "theme": "META"}, format="json")
    payload = {"upsert": True, "clauses": [
        {"anchorIndex": 0, "theme": "TERMINATION", "validated": True,
         "boundary": {"type": "hard", "support": 3}},  # déjà annotée → upsert
        {"anchorIndex": 3, "theme": "TERMINATION"},      # nouvelle
    ]}
    r = c.post(f"/api/v1/annotations/{annotation.id}/clauses/batch", payload, format="json")
    assert r.status_code == 201, r.content
    body = r.json()
    assert len(body["created"]) == 2 and not body["conflicts"]
    a0 = annotation.clauses.get(anchor_sentence__index=0)
    assert a0.theme.code == "TERMINATION" and a0.validated is True
    assert a0.boundary_support == 3
    # pas de doublon : 2 clauses au total (anchor 0 mise à jour + anchor 3 créée).
    assert annotation.clauses.count() == 2


def test_batch_upsert_updates_scalar_fields(annotation, annotator, auth):
    """#13 — parité : le batch upsert met aussi à jour rationale/certainty/evidence_span
    (comme add_clause unitaire), pas seulement theme/validated/frontière/niveau."""
    c = auth(annotator)
    c.post(f"/api/v1/annotations/{annotation.id}/clauses",
           {"anchorIndex": 0, "theme": "META"}, format="json")
    payload = {"upsert": True, "clauses": [
        {"anchorIndex": 0, "theme": "TERMINATION", "rationale": "motif",
         "certainty": 2, "evidenceSpan": "preuve"},
    ]}
    r = c.post(f"/api/v1/annotations/{annotation.id}/clauses/batch", payload, format="json")
    assert r.status_code == 201, r.content
    a0 = annotation.clauses.get(anchor_sentence__index=0)
    assert a0.theme.code == "TERMINATION"
    assert a0.rationale == "motif"
    assert a0.certainty == 2
    assert a0.evidence_span == "preuve"


def test_batch_upsert_keeps_order_contiguous(annotation, annotator, auth):
    """#15 — un item upserté ne consomme pas de slot d'ordre : la création conserve un
    `order` contigu (pas de trou)."""
    c = auth(annotator)
    c.post(f"/api/v1/annotations/{annotation.id}/clauses",
           {"anchorIndex": 0, "theme": "META"}, format="json")  # order 0
    payload = {"upsert": True, "clauses": [
        {"anchorIndex": 0, "theme": "TERMINATION"},  # upsert → pas d'ordre consommé
        {"anchorIndex": 3, "theme": "TERMINATION"},  # création
    ]}
    r = c.post(f"/api/v1/annotations/{annotation.id}/clauses/batch", payload, format="json")
    assert r.status_code == 201, r.content
    a3 = annotation.clauses.get(anchor_sentence__index=3)
    assert a3.order == 1  # contigu après l'existante (order 0), et non 2


def test_batch_invalid_certainty_reported_without_aborting(annotation, annotator, auth):
    """#13 (régression) — une certitude hors plage est rapportée en conflit d'item et NE
    fait PAS avorter le lot transactionnel ; les items valides sont bien créés."""
    c = auth(annotator)
    payload = {"clauses": [
        {"anchorIndex": 0, "theme": "META"},                       # valide
        {"anchorIndex": 1, "theme": "TERMINATION", "certainty": 5}, # certitude invalide
    ]}
    r = c.post(f"/api/v1/annotations/{annotation.id}/clauses/batch", payload, format="json")
    assert r.status_code == 201, r.content
    body = r.json()
    assert len(body["created"]) == 1
    assert any(cf["anchorIndex"] == 1 and "certitude" in cf["reason"] for cf in body["conflicts"])
    # L'item valide n'est PAS rollback ; l'item invalide n'a rien créé.
    assert annotation.clauses.filter(anchor_sentence__index=0).exists()
    assert not annotation.clauses.filter(anchor_sentence__index=1).exists()


def test_add_clause_op_id_reused_on_other_anchor_applies_decision(annotation, annotator, auth):
    """#14 — un client_op_id réutilisé pour une AUTRE ancre ne court-circuite pas sur la
    mauvaise clause : la décision est bien appliquée sur l'ancre demandée."""
    c = auth(annotator)
    r0 = c.post(f"/api/v1/annotations/{annotation.id}/clauses",
                {"anchorIndex": 0, "theme": "META", "clientOpId": "op-x"}, format="json")
    cid0 = r0.json()["id"]
    r = c.post(f"/api/v1/annotations/{annotation.id}/clauses",
               {"anchorIndex": 1, "theme": "TERMINATION", "clientOpId": "op-x"}, format="json")
    assert r.status_code == 201, r.content
    body = r.json()
    assert body["id"] != cid0
    assert body["anchorIndex"] == 1 and body["theme"] == "TERMINATION"
    assert annotation.clauses.filter(anchor_sentence__index=1).exists()


def test_add_clause_op_id_same_anchor_still_idempotent(annotation, annotator, auth):
    """#14 (non-régression) — même op_id + MÊME ancre = idempotent (retour de l'existante)."""
    c = auth(annotator)
    r0 = c.post(f"/api/v1/annotations/{annotation.id}/clauses",
                {"anchorIndex": 0, "theme": "META", "clientOpId": "op-y"}, format="json")
    r1 = c.post(f"/api/v1/annotations/{annotation.id}/clauses",
                {"anchorIndex": 0, "theme": "TERMINATION", "clientOpId": "op-y"}, format="json")
    assert r1.status_code == 200
    assert r1.json()["id"] == r0.json()["id"]
    assert annotation.clauses.filter(anchor_sentence__index=0).count() == 1


def test_boundary_set_soft_then_hard(annotation, annotator, auth):
    c = auth(annotator)
    r = c.post(f"/api/v1/annotations/{annotation.id}/clauses",
               {"anchorIndex": 0, "theme": "META"}, format="json")
    cid = r.json()["id"]
    r2 = c.post(f"/api/v1/clauses/{cid}/boundary", {"op": "set_soft"}, format="json")
    assert r2.status_code == 200 and r2.json()["boundary"]["type"] == "soft"
    r3 = c.post(f"/api/v1/clauses/{cid}/boundary", {"op": "set_hard", "validatedBy": "annotator_01"}, format="json")
    assert r3.json()["boundary"]["type"] == "hard"
    assert Clause.objects.get(id=cid).validated is True

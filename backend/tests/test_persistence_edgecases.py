"""Cas limites de persistance & idempotence — garantie « campagne sans perte ».

Objectif : verrouiller, AVANT une vraie campagne d'annotation, les chemins de
persistance les moins évidents (lot, idempotence d'op, défauts, unicode), où une
régression silencieuse FERAIT PERDRE des données sans lever d'erreur :

  1. BATCH : créer 3 clauses d'un coup → 201, les 3 en DB, ordre CONTIGU (0,1,2),
     et relecture intégrale par item (boundary / triage / themes).
  2. BATCH avec conflit INV-2 : une ancre déjà prise est RAPPORTÉE en conflit ET
     les non-conflictuelles sont quand même créées (le lot n'avorte pas).
  3. DELETE puis SUBMIT : le snapshot figé NE contient PLUS la clause supprimée,
     les autres restent présentes et leur `order` reste cohérent.
  4. Idempotence clientOpId : MÊME op_id + MÊME ancre rejoué → 1 SEULE clause en
     DB (200 au rejeu), aucun doublon, op_id PERSISTÉ (relecture DB directe).
  5. clientOpId réutilisé sur une AUTRE ancre → appliqué sur la nouvelle ancre
     (pas d'erreur, pas de doublon parasite).
  6. Champs vides/par défaut : clause mono minimale (theme seul) → relecture des
     DÉFAUTS en DB (boundary hard/1, triage '', certainty None, validated False,
     order 0) — aucun défaut « oublié ».
  7. Unicode/long dans evidenceSpan/rationale → relu INTACT (API ET DB), octet
     pour octet (pas de troncature, pas de mangling d'encodage).

Toutes les assertions critiques relisent la DB DIRECTEMENT (Model.objects.get),
pas seulement l'API, car le bug à craindre est « l'API renvoie bien mais la DB
ne stocke pas » (ou l'inverse).
"""

import pytest

from claire.annotations.models import (
    AnnotationStatus,
    AnnotationVersion,
    Clause,
    ClauseTheme,
)

pytestmark = pytest.mark.django_db

API = "/api/v1"


def _add(client, ann_id, payload):
    return client.post(f"{API}/annotations/{ann_id}/clauses", payload, format="json")


def _batch(client, ann_id, payload):
    return client.post(
        f"{API}/annotations/{ann_id}/clauses/batch", payload, format="json"
    )


def _detail(client, ann_id):
    return client.get(f"{API}/annotations/{ann_id}").json()


def _latest_snapshot(annotation):
    return (
        AnnotationVersion.objects.filter(annotation=annotation)
        .order_by("-number")
        .first()
        .snapshot
    )


# ── 1. BATCH : 3 clauses d'un coup, ordre contigu, relecture intégrale ──────────
def test_batch_creates_three_with_contiguous_order_and_full_readback(
    auth, annotation, annotator
):
    c = auth(annotator)
    payload = {
        "clauses": [
            {
                "anchorIndex": 0,
                "theme": "META",
                "boundary": {"type": "hard", "support": 3},
                "triageLevel": "C1",
            },
            {
                "anchorIndex": 1,
                "themes": [
                    {"label": "TERMINATION", "role": "primary", "support": 0},
                    {"label": "META", "role": "secondary", "support": 0},
                ],
                "boundary": {"type": "soft", "support": 2},
                "triageLevel": "C3",
            },
            {
                "anchorIndex": 2,
                "theme": "PREAMBLE_SCOPE",
                "boundary": {"type": "hard", "support": 1},
                "triageLevel": "C5",
            },
        ]
    }
    r = _batch(c, annotation.id, payload)
    assert r.status_code == 201, r.content
    body = r.json()
    assert len(body["created"]) == 3
    assert body["conflicts"] == []

    # DB : exactement 3 clauses, ordres CONTIGUS 0,1,2 (aucun trou ni collision).
    rows = list(
        Clause.objects.filter(annotation=annotation).order_by("anchor_sentence__index")
    )
    assert len(rows) == 3
    assert sorted(r.order for r in rows) == [0, 1, 2]
    # L'ordre suit l'ordre des items du lot (anchor 0 → order 0, etc.).
    by_anchor = {r.anchor_sentence.index: r for r in rows}
    assert by_anchor[0].order == 0
    assert by_anchor[1].order == 1
    assert by_anchor[2].order == 2

    # Relecture boundary / triage / themes de CHACUNE — directement en DB.
    assert by_anchor[0].boundary_type == "hard"
    assert by_anchor[0].boundary_support == 3
    assert by_anchor[0].triage_level == "C1"

    assert by_anchor[1].boundary_type == "soft"
    assert by_anchor[1].boundary_support == 2
    assert by_anchor[1].triage_level == "C3"
    # Le multi-label du 2e item est bien posé (1 primaire + 1 secondaire).
    tags1 = ClauseTheme.objects.filter(clause=by_anchor[1])
    assert tags1.count() == 2
    assert tags1.get(role="primary").theme.code == "TERMINATION"
    assert set(tags1.filter(role="secondary").values_list("theme__code", flat=True)) == {
        "META"
    }
    # Le miroir scalaire `theme` suit bien le primaire.
    assert by_anchor[1].theme.code == "TERMINATION"

    assert by_anchor[2].boundary_type == "hard"
    assert by_anchor[2].boundary_support == 1
    assert by_anchor[2].triage_level == "C5"
    assert by_anchor[2].theme.code == "PREAMBLE_SCOPE"


# ── 2. BATCH avec conflit INV-2 : rapporte le conflit ET crée les autres ────────
def test_batch_reports_conflict_and_still_creates_non_conflicting(
    auth, annotation, annotator
):
    c = auth(annotator)
    # Pré-existant : une clause sur l'ancre 1 (sans upsert → futur conflit).
    assert _add(c, annotation.id, {"anchorIndex": 1, "theme": "META"}).status_code == 201

    payload = {
        "clauses": [
            {"anchorIndex": 0, "theme": "META"},          # libre → créée
            {"anchorIndex": 1, "theme": "TERMINATION"},   # prise → conflit INV-2
            {"anchorIndex": 2, "theme": "TERMINATION"},   # libre → créée
        ]
    }
    r = _batch(c, annotation.id, payload)
    # Au moins une création → 201 global.
    assert r.status_code == 201, r.content
    body = r.json()

    # Les deux non-conflictuelles sont créées.
    created_anchors = {x["anchorIndex"] for x in body["created"]}
    assert created_anchors == {0, 2}
    # Le conflit INV-2 sur l'ancre 1 est rapporté.
    conflict_anchors = {x["anchorIndex"] for x in body["conflicts"]}
    assert conflict_anchors == {1}

    # DB : 3 clauses au total (1 préexistante + 2 nouvelles), l'ancre 1 PAS dupliquée.
    rows = Clause.objects.filter(annotation=annotation)
    assert rows.count() == 3
    assert rows.filter(anchor_sentence__index=1).count() == 1
    # La préexistante n'a pas été écrasée : son thème reste META (pas TERMINATION).
    assert rows.get(anchor_sentence__index=1).theme.code == "META"
    # Ordres toujours contigus (préexistante=0, puis +1 par CRÉATION : 0,1,2).
    assert sorted(rows.values_list("order", flat=True)) == [0, 1, 2]


# ── 3. DELETE puis SUBMIT : le snapshot ne contient plus la clause supprimée ────
def test_delete_then_submit_snapshot_drops_clause_and_keeps_order_coherent(
    auth, annotation, annotator
):
    c = auth(annotator)
    ids = {}
    for anchor, theme in ((0, "META"), (1, "TERMINATION"), (2, "PREAMBLE_SCOPE")):
        r = _add(c, annotation.id, {"anchorIndex": anchor, "theme": theme, "validated": True})
        assert r.status_code == 201, r.content
        ids[anchor] = r.json()["id"]

    # Suppression de la clause du milieu (ancre 1).
    d = c.delete(f"{API}/clauses/{ids[1]}")
    assert d.status_code == 204, d.content
    assert not Clause.objects.filter(pk=ids[1]).exists()

    # SUBMIT → snapshot figé.
    s = c.post(f"{API}/annotations/{annotation.id}/submit")
    assert s.status_code == 200, s.content
    annotation.refresh_from_db()
    assert annotation.status == AnnotationStatus.SUBMITTED

    snap = _latest_snapshot(annotation)
    anchors_in_snap = {cl["anchor_index"] for cl in snap["clauses"]}
    # La clause supprimée a DISPARU ; les deux autres sont présentes.
    assert 1 not in anchors_in_snap
    assert anchors_in_snap == {0, 2}

    # `order` reste cohérent (croissant, sans collision) pour les survivantes.
    orders = [cl["order"] for cl in sorted(snap["clauses"], key=lambda x: x["anchor_index"])]
    assert orders == sorted(orders)
    assert len(set(orders)) == len(orders)  # pas deux clauses au même order


# ── 4. Idempotence clientOpId : même op + même ancre → 1 clause, op_id persisté ──
def test_same_client_op_id_same_anchor_no_duplicate_and_persisted(
    auth, annotation, annotator
):
    c = auth(annotator)
    payload = {"anchorIndex": 2, "theme": "TERMINATION", "clientOpId": "op-dup-7"}

    r1 = _add(c, annotation.id, payload)
    assert r1.status_code == 201, r1.content
    cid = r1.json()["id"]

    # Rejeu EXACT (retry réseau) → 200, même clause, aucun doublon.
    r2 = _add(c, annotation.id, payload)
    assert r2.status_code == 200, r2.content
    assert r2.json()["id"] == cid

    # DB : exactement 1 clause sur l'ancre 2, op_id bien PERSISTÉ (jamais exposé par l'API).
    rows = Clause.objects.filter(annotation=annotation, anchor_sentence__index=2)
    assert rows.count() == 1
    assert Clause.objects.get(pk=cid).client_op_id == "op-dup-7"
    # Aucune autre clause parasite dans l'annotation.
    assert Clause.objects.filter(annotation=annotation).count() == 1


# ── 5. clientOpId réutilisé sur une AUTRE ancre → appliqué sur la nouvelle ancre ─
def test_client_op_id_reused_on_other_anchor_applies_to_new_anchor(
    auth, annotation, annotator
):
    c = auth(annotator)
    # 1ère création sur l'ancre 0 avec op-reuse.
    r1 = _add(c, annotation.id, {"anchorIndex": 0, "theme": "META", "clientOpId": "op-reuse"})
    assert r1.status_code == 201, r1.content
    first_id = r1.json()["id"]

    # MÊME op_id mais ancre DIFFÉRENTE (3) → ne doit PAS court-circuiter sur l'ancienne
    # clause ; la décision s'applique à la nouvelle ancre (pas d'erreur 4xx/5xx).
    r2 = _add(c, annotation.id, {"anchorIndex": 3, "theme": "TERMINATION", "clientOpId": "op-reuse"})
    assert r2.status_code in (200, 201), r2.content
    second_id = r2.json()["id"]

    # Une clause existe bien sur la nouvelle ancre 3 (la décision n'a pas été perdue).
    new = Clause.objects.get(annotation=annotation, anchor_sentence__index=3)
    assert new.theme.code == "TERMINATION"
    assert second_id == new.id
    # La clause d'origine (ancre 0) n'a pas été détruite.
    assert Clause.objects.filter(pk=first_id, anchor_sentence__index=0).exists()
    # Deux clauses distinctes : la réutilisation a appliqué, pas écrasé silencieusement.
    assert first_id != second_id
    assert Clause.objects.filter(annotation=annotation).count() == 2
    # Invariant DB : un client_op_id non vide reste unique par annotation.
    op_owners = list(
        Clause.objects.filter(annotation=annotation, client_op_id="op-reuse")
    )
    assert len(op_owners) <= 1


# ── 6. Champs vides/par défaut : clause mono minimale → défauts relus en DB ──────
def test_minimal_mono_clause_reads_back_defaults_in_db(auth, annotation, annotator):
    c = auth(annotator)
    # Charge MINIMALE : seulement anchor + theme. Tout le reste doit prendre ses défauts.
    r = _add(c, annotation.id, {"anchorIndex": 0, "theme": "META"})
    assert r.status_code == 201, r.content
    cid = r.json()["id"]

    row = Clause.objects.get(pk=cid)
    # Défauts modèle (sans aucune valeur fournie par le client).
    assert row.boundary_type == "hard"
    assert row.boundary_support == 1
    assert row.triage_level == ""
    assert row.certainty is None
    assert row.validated is False
    assert row.order == 0
    assert row.legal_nature is None
    assert row.evidence_span == ""
    assert row.rationale == ""
    assert row.client_op_id == ""

    # Et une clause mono porte exactement 1 tag primaire = son thème scalaire.
    tags = ClauseTheme.objects.filter(clause=row)
    assert tags.count() == 1
    assert tags.get().role == "primary"
    assert tags.get().theme.code == "META"

    # Cohérence API : triage_level vide est exposé None, boundary par défaut.
    api = next(x for x in _detail(c, annotation.id)["clauses"] if x["anchorIndex"] == 0)
    assert api["triageLevel"] is None
    assert api["boundary"] == {"type": "hard", "support": 1}
    assert api["certainty"] is None
    assert api["validated"] is False


# ── 7. Unicode/long dans evidenceSpan/rationale → relu INTACT (API + DB) ─────────
def test_unicode_and_long_text_roundtrip_intact_api_and_db(auth, annotation, annotator):
    c = auth(annotator)
    # Mélange : accents FR, caractères CJK, emoji, guillemets typographiques, RTL,
    # combining marks, et un bloc LONG pour exclure toute troncature.
    evidence = (
        "Résiliation « immédiate » — 解約 — مادة ١٢ — 🤝 contrat signé le 22/06/2026 "
        "été (combining) ‫טקסט בעברית‬"
    )
    # NB : DRF CharField applique trim_whitespace (les bords sont normalisés) — on
    # n'inclut donc PAS d'espace de bordure ici pour tester la fidélité du CONTENU
    # (le trim des bords est couvert explicitement par le test dédié plus bas).
    rationale = "Justification détaillée : " + ("clause critique — 条款 — ✅ " * 200).strip()
    assert len(rationale) > 3000  # bloc volontairement long

    r = _add(
        c,
        annotation.id,
        {
            "anchorIndex": 4,
            "theme": "TERMINATION",
            "evidenceSpan": evidence,
            "rationale": rationale,
        },
    )
    assert r.status_code == 201, r.content
    cid = r.json()["id"]

    # DB : relu OCTET POUR OCTET (égalité stricte des chaînes).
    row = Clause.objects.get(pk=cid)
    assert row.evidence_span == evidence
    assert row.rationale == rationale
    assert len(row.rationale) == len(rationale)

    # API : même fidélité après le pont camelCase.
    api = next(x for x in _detail(c, annotation.id)["clauses"] if x["anchorIndex"] == 4)
    assert api["evidenceSpan"] == evidence
    assert api["rationale"] == rationale

    # Le texte survit aussi au SNAPSHOT de soumission (export campagne).
    assert c.post(f"{API}/annotations/{annotation.id}/submit").status_code == 200
    annotation.refresh_from_db()
    snap = _latest_snapshot(annotation)
    snap_clause = next(cl for cl in snap["clauses"] if cl["anchor_index"] == 4)
    assert snap_clause["evidence_span"] == evidence
    assert snap_clause["rationale"] == rationale


# ── 7bis. Normalisation des bords : DRF trim les espaces de bordure, INTÉRIEUR intact
def test_edge_whitespace_is_trimmed_interior_preserved(auth, annotation, annotator):
    """Comportement attendu (DRF CharField trim_whitespace) : les espaces/tabs/retours
    en BORDURE d'evidenceSpan/rationale sont retirés à l'écriture ; le contenu interne
    (y compris les espaces internes) est préservé. Documenté ici pour la campagne :
    aucune perte de contenu signifiant, seulement une normalisation des bords."""
    c = auth(annotator)
    r = _add(
        c,
        annotation.id,
        {
            "anchorIndex": 1,
            "theme": "META",
            "evidenceSpan": "  bordure espace  ",
            "rationale": "\n\t justification\tinterne préservée \n",
        },
    )
    assert r.status_code == 201, r.content
    row = Clause.objects.get(pk=r.json()["id"])
    # Bords trimmés…
    assert row.evidence_span == "bordure espace"
    assert row.rationale == "justification\tinterne préservée"
    # …mais l'espace INTERNE (tab entre 'justification' et 'interne') est conservé.
    assert "\t" in row.rationale

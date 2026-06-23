"""Contraintes & validation à l'écriture : un rejet doit être PROPRE (4xx, pas 500)
et SANS écriture partielle (la DB reste intacte). Garantit qu'une saisie invalide
ne corrompt jamais silencieusement une session de campagne.

Cible les trous NON couverts par test_clauses_write_multilabel.py / test_clause_*:
rejet API de certainty hors-borne, themes 0/2 primaires via l'API, refuge en
PRIMAIRE accepté, déplacement PATCH sur ancre occupée (409), thème/nature hors schéma
(400 propre), et l'invariance de la DB après chaque rejet.
"""

import pytest

from claire.annotations.models import Clause, ClauseTheme

pytestmark = pytest.mark.django_db

API = "/api/v1"


def _add(client, ann_id, payload):
    return client.post(f"{API}/annotations/{ann_id}/clauses", payload, format="json")


def _count(annotation):
    return Clause.objects.filter(annotation=annotation).count()


# ── certainty : borne {0,1,2,3} appliquée à l'écriture (rejet propre, pas d'écriture)
@pytest.mark.parametrize("bad", [4, -1, 99])
def test_certainty_out_of_range_rejected_no_write(auth, annotation, annotator, bad):
    c = auth(annotator)
    before = _count(annotation)
    r = _add(c, annotation.id, {"anchorIndex": 0, "theme": "META", "certainty": bad})
    assert r.status_code == 400, r.content
    assert _count(annotation) == before  # aucune clause écrite


@pytest.mark.parametrize("ok", [0, 3])
def test_certainty_bounds_accepted_and_reread(auth, annotation, annotator, ok):
    c = auth(annotator)
    r = _add(c, annotation.id, {"anchorIndex": 1, "theme": "META", "certainty": ok})
    assert r.status_code == 201, r.content
    assert Clause.objects.get(pk=r.json()["id"]).certainty == ok


# ── multi-label : exactement 1 primaire — 0 ou 2 primaires rejetés via l'API ────
def test_themes_zero_primary_rejected_no_write(auth, annotation, annotator):
    c = auth(annotator)
    before = _count(annotation)
    r = _add(
        c,
        annotation.id,
        {
            "anchorIndex": 2,
            "themes": [
                {"label": "META", "role": "secondary", "support": 0},
                {"label": "TERMINATION", "role": "secondary", "support": 0},
            ],
        },
    )
    assert r.status_code == 400, r.content
    assert _count(annotation) == before


def test_themes_two_primaries_rejected_no_write(auth, annotation, annotator):
    c = auth(annotator)
    before = _count(annotation)
    r = _add(
        c,
        annotation.id,
        {
            "anchorIndex": 2,
            "themes": [
                {"label": "META", "role": "primary", "support": 0},
                {"label": "TERMINATION", "role": "primary", "support": 0},
            ],
        },
    )
    assert r.status_code == 400, r.content
    assert _count(annotation) == before


# ── refuge : interdit en SECONDAIRE, mais autorisé en PRIMAIRE ──────────────────
def test_refuge_as_secondary_rejected_but_primary_accepted(auth, annotation, annotator):
    c = auth(annotator)
    # PREAMBLE_SCOPE (refuge) en secondaire → rejeté.
    bad = _add(
        c,
        annotation.id,
        {
            "anchorIndex": 3,
            "themes": [
                {"label": "TERMINATION", "role": "primary", "support": 0},
                {"label": "PREAMBLE_SCOPE", "role": "secondary", "support": 0},
            ],
        },
    )
    assert bad.status_code == 400, bad.content
    assert _count(annotation) == 0

    # Le même refuge en PRIMAIRE (avec un secondaire non-refuge) → accepté.
    ok = _add(
        c,
        annotation.id,
        {
            "anchorIndex": 3,
            "themes": [
                {"label": "PREAMBLE_SCOPE", "role": "primary", "support": 0},
                {"label": "META", "role": "secondary", "support": 0},
            ],
        },
    )
    assert ok.status_code == 201, ok.content
    cid = ok.json()["id"]
    assert ClauseTheme.objects.get(clause_id=cid, role="primary").theme.code == "PREAMBLE_SCOPE"
    assert Clause.objects.get(pk=cid).theme.code == "PREAMBLE_SCOPE"


# ── thème / nature HORS schéma → 400 propre (jamais 500), aucune écriture ───────
def test_unknown_theme_code_clean_400(auth, annotation, annotator):
    c = auth(annotator)
    before = _count(annotation)
    r = _add(c, annotation.id, {"anchorIndex": 0, "theme": "NOPE_NOT_A_THEME"})
    assert r.status_code == 400, r.content  # pas un 500
    assert _count(annotation) == before


def test_unknown_legal_nature_clean_400(auth, annotation, annotator):
    c = auth(annotator)
    before = _count(annotation)
    r = _add(
        c,
        annotation.id,
        {"anchorIndex": 0, "theme": "META", "legalNature": "NOPE_NATURE"},
    )
    assert r.status_code == 400, r.content
    assert _count(annotation) == before


def test_anchor_out_of_document_clean_400(auth, annotation, annotator):
    c = auth(annotator)
    before = _count(annotation)
    r = _add(c, annotation.id, {"anchorIndex": 999, "theme": "META"})
    assert r.status_code == 400, r.content
    assert _count(annotation) == before


# ── PATCH déplaçant une clause sur une ancre DÉJÀ occupée → 409, DB intacte ─────
def test_patch_move_onto_occupied_anchor_conflict(auth, annotation, annotator):
    c = auth(annotator)
    a = _add(c, annotation.id, {"anchorIndex": 0, "theme": "META"})
    b = _add(c, annotation.id, {"anchorIndex": 1, "theme": "TERMINATION"})
    assert a.status_code == 201 and b.status_code == 201
    bid = b.json()["id"]

    # Tente de déplacer b sur l'ancre 0 (occupée par a) → INV-2 → 409.
    r = c.patch(f"{API}/clauses/{bid}", {"anchorIndex": 0}, format="json")
    assert r.status_code == 409, r.content

    # DB intacte : b reste sur l'ancre 1, a sur l'ancre 0, toujours 2 clauses.
    assert Clause.objects.get(pk=bid).anchor_sentence.index == 1
    assert _count(annotation) == 2


# ── PATCH multi-label : le set REMPLACE l'ancien (anciens secondaires supprimés) ─
def test_patch_themes_replaces_secondary_set_in_db(auth, annotation, annotator):
    c = auth(annotator)
    created = _add(
        c,
        annotation.id,
        {
            "anchorIndex": 2,
            "themes": [
                {"label": "TERMINATION", "role": "primary", "support": 0},
                {"label": "META", "role": "secondary", "support": 0},
            ],
        },
    )
    assert created.status_code == 201
    cid = created.json()["id"]
    assert set(
        ClauseTheme.objects.filter(clause_id=cid).values_list("theme__code", flat=True)
    ) == {"TERMINATION", "META"}

    # Nouveau set : primaire TERMINATION sans secondaire → META doit DISPARAÎTRE.
    r = c.patch(
        f"{API}/clauses/{cid}",
        {"themes": [{"label": "TERMINATION", "role": "primary", "support": 0}]},
        format="json",
    )
    assert r.status_code == 200, r.content
    tags = ClauseTheme.objects.filter(clause_id=cid)
    assert set(tags.values_list("theme__code", flat=True)) == {"TERMINATION"}
    assert tags.filter(role="secondary").count() == 0

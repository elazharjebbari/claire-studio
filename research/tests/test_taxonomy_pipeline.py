"""Pipeline multi-taxonomies — projection au CHARGEMENT, plis intacts, hold-out isolé.

Ces tests protègent les propriétés qui rendent les comparaisons inter-taxonomies valides :
les fichiers du dataset ne bougent pas, les plis non plus (donc l'appariement est gratuit),
les frontières sont RECALCULÉES après fusion, et la population de validation reste séparée.
"""

import json
from pathlib import Path

import pytest

from pactiva_lab.data import load_dataset, load_gold, load_votes
from pactiva_lab import taxonomy as tx


@pytest.fixture
def dataset_dir(tmp_path: Path) -> Path:
    """Dataset minimal en T20, avec les quatre sources de thèmes."""
    root = tmp_path / "ds"
    root.mkdir()
    (root / "manifest.json").write_text(json.dumps({
        "fingerprint": "test", "nDocuments": 2, "nSentences": 4,
    }), encoding="utf-8")
    (root / "splits.json").write_text(json.dumps({
        "scheme": "group_kfold_document", "k": 2, "seed": 42,
        "folds": [["DocA"], ["DocB"]],
    }), encoding="utf-8")
    (root / "labels.json").write_text(json.dumps([
        {"code": "LICENSE_IP"}, {"code": "USER_CONTENT"}, {"code": "FEES_PAYMENT"},
        {"code": "META"}, {"code": "PREAMBLE_SCOPE"},
    ]), encoding="utf-8")

    # DocA : deux phrases voisines qui FUSIONNENT en T11 (LICENSE_IP et USER_CONTENT
    # tombent toutes deux dans CONTENT_IP) → la frontière entre elles doit disparaître.
    sentences = [
        {"document": "DocA", "index": 0, "text": "a", "primary": "LICENSE_IP",
         "themes": ["LICENSE_IP"], "boundary": True},
        {"document": "DocA", "index": 1, "text": "b", "primary": "USER_CONTENT",
         "themes": ["USER_CONTENT"], "boundary": True},
        {"document": "DocA", "index": 2, "text": "c", "primary": "FEES_PAYMENT",
         "themes": ["FEES_PAYMENT"], "boundary": True},
        {"document": "DocB", "index": 0, "text": "d", "primary": "META",
         "themes": ["META", "LICENSE_IP"], "boundary": True},
    ]
    (root / "sentences.jsonl").write_text(
        "\n".join(json.dumps(s) for s in sentences), encoding="utf-8"
    )
    (root / "judges.jsonl").write_text(
        json.dumps({"document": "DocA", "index": 0, "judge": "fable", "theme": "DMCA"}),
        encoding="utf-8",
    )
    (root / "votes.jsonl").write_text("\n".join(json.dumps(v) for v in [
        {"document": "DocA", "index": 0, "annotator": "a1",
         "primary": "LICENSE_IP", "secondaries": ["USER_CONTENT", "FEES_PAYMENT"]},
        {"document": "DocB", "index": 0, "annotator": "a1",
         "primary": "META", "secondaries": []},
    ]), encoding="utf-8")
    (root / "gold.jsonl").write_text(json.dumps({
        "document": "DocA", "index": 0,
        "proposed_primary": "LICENSE_IP", "proposed_secondaries": ["USER_CONTENT"],
        "decided_primary": "USER_CONTENT", "decided_secondaries": ["DMCA"],
        "tally": {"LICENSE_IP": 2.0, "USER_CONTENT": 1.0, "FEES_PAYMENT": 1.0},
    }), encoding="utf-8")
    return root


def test_canonical_load_is_unchanged(dataset_dir):
    ds = load_dataset(dataset_dir)
    assert ds.taxonomy == "T20"
    assert [s.primary for s in ds.sentences] == [
        "LICENSE_IP", "USER_CONTENT", "FEES_PAYMENT", "META",
    ]
    assert ds.labels == ["LICENSE_IP", "USER_CONTENT", "FEES_PAYMENT", "META", "PREAMBLE_SCOPE"]


def test_projection_merges_themes_and_vocabulary(dataset_dir):
    ds = load_dataset(dataset_dir, taxonomy="T11")
    assert ds.taxonomy == "T11"
    assert [s.primary for s in ds.sentences] == [
        "CONTENT_IP", "CONTENT_IP", "FEES_PAYMENT", "FRAMEWORK",
    ]
    # Vocabulaire dédoublonné : LICENSE_IP et USER_CONTENT deviennent une seule classe.
    assert ds.labels == ["CONTENT_IP", "FEES_PAYMENT", "FRAMEWORK"]


def test_boundaries_are_recomputed_after_merge(dataset_dir):
    """⭐ Le piège le plus discret : deux phrases voisines fusionnées ne sont plus séparées
    par une frontière. Garder le drapeau d'origine mesurerait une segmentation disparue."""
    t20 = load_dataset(dataset_dir)
    assert [s.boundary for s in t20.sentences] == [True, True, True, True]

    t11 = load_dataset(dataset_dir, taxonomy="T11")
    # DocA#1 (USER_CONTENT → CONTENT_IP) suit DocA#0 (LICENSE_IP → CONTENT_IP) : même jeu.
    assert [s.boundary for s in t11.sentences] == [True, False, True, True]


def test_secondary_absorbed_by_primary_disappears(dataset_dir):
    """Un secondaire devenu identique au primaire après fusion ne doit PAS survivre."""
    ds = load_dataset(dataset_dir, taxonomy="T11")
    doc_b = ds.sentences[3]  # META + LICENSE_IP → FRAMEWORK + CONTENT_IP (distincts)
    assert doc_b.themes == ["FRAMEWORK", "CONTENT_IP"]

    votes = load_votes(dataset_dir, taxonomy="T11")
    # LICENSE_IP + [USER_CONTENT, FEES_PAYMENT] → CONTENT_IP + [FEES_PAYMENT] seulement.
    assert votes[0]["primary"] == "CONTENT_IP"
    assert votes[0]["secondaries"] == ["FEES_PAYMENT"]


def test_judges_are_projected_with_the_same_mapping(dataset_dir):
    """Un remap partiel (annotateurs projetés, juges non) fausserait la matrice d'accord."""
    ds = load_dataset(dataset_dir, taxonomy="T11")
    assert ds.judges[("DocA", 0)]["fable"] == "CONTENT_IP"


def test_gold_projection_covers_proposal_decision_and_tally(dataset_dir):
    """La proposition, la décision ET le décompte sont projetés — les masses s'additionnent."""
    rows = load_gold(dataset_dir, taxonomy="T11")
    row = rows[0]
    assert row["proposed_primary"] == "CONTENT_IP"
    assert row["proposed_secondaries"] == []  # USER_CONTENT absorbé par le primaire
    assert row["decided_primary"] == "CONTENT_IP"
    assert row["decided_secondaries"] == []   # DMCA absorbé lui aussi
    # LICENSE_IP (2,0) + USER_CONTENT (1,0) → CONTENT_IP 3,0 ; FEES_PAYMENT inchangé.
    assert row["tally"] == {"CONTENT_IP": 3.0, "FEES_PAYMENT": 1.0}


def test_folds_are_identical_across_taxonomies(dataset_dir):
    """⭐ Les plis ne bougent pas : toute comparaison inter-taxonomies est APPARIÉE."""
    folds = [load_dataset(dataset_dir, taxonomy=t).folds for t in ("T20", "T14", "T11", "T10")]
    assert all(f == folds[0] for f in folds)


def test_source_files_are_never_rewritten(dataset_dir):
    """Le dataset sur disque reste en T20 : la projection est un pur effet de lecture."""
    before = (dataset_dir / "sentences.jsonl").read_text(encoding="utf-8")
    load_dataset(dataset_dir, taxonomy="T10")
    load_votes(dataset_dir, taxonomy="T10")
    load_gold(dataset_dir, taxonomy="T10")
    assert (dataset_dir / "sentences.jsonl").read_text(encoding="utf-8") == before


# ── Populations ─────────────────────────────────────────────────────────────
def test_population_filter_isolates_the_holdout():
    rows = [{"document": "Skype"}, {"document": "9gag"}, {"document": "eBay"}]
    assert [r["document"] for r in tx.filter_population(rows, "holdout")] == ["Skype", "eBay"]
    assert [r["document"] for r in tx.filter_population(rows, "designSet")] == ["9gag"]
    assert tx.filter_population(rows, None) == rows


def test_config_helpers():
    assert tx.taxonomy_of({}) == "T20"
    assert tx.taxonomy_of({"data": {"taxonomy": "T11"}}) == "T11"
    assert tx.population_of({}) is None
    assert tx.population_of({"data": {"population": "holdout"}}) == "holdout"

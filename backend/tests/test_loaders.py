"""Tests for pre-annotation loaders (v9.2 & v9.4) and CLAUDETTE loader."""

import pytest

from claire.imports.loaders import (
    detect_schema_version,
    normalize_preannotation,
    normalize_v92,
    normalize_v94,
)
from claire.imports.theme_mapping import normalize_theme_code

pytestmark = pytest.mark.django_db


V94 = {
    "doc": "Demo",
    "judge": "claude",
    "version": "v9.4",
    "plan": {
        "clauses": [
            {"clause_id": 0, "theme": "META", "open_span": "posted", "anchor_id": 0},
            {"clause_id": 1, "theme": "THIRD_PARTY", "open_span": "svc",
             "anchor_id": 3},
        ]
    },
}

V92 = {
    "doc": "Demo",
    "judge": "claude",
    "version": "v9.2-nature-derived",
    "document_plan": {
        "segments": [
            {"start_id": 0, "theme": "MODIFICATION_OF_TERMS",
             "rationale": "notice", "evidence_span": "we revised"},
            {"start_id": 4, "theme": "META", "rationale": "date",
             "evidence_span": "posted"},
        ]
    },
}


def test_detect_schema_version():
    assert detect_schema_version(V94) == "v9.4"
    assert detect_schema_version(V92) == "v9.2"


def test_normalize_v94_maps_anchor_and_span():
    clauses = normalize_v94(V94)
    assert clauses[0] == {
        "anchor_index": 0, "theme": "META", "evidence_span": "posted",
        "rationale": "", "order": 0,
    }
    assert clauses[1]["anchor_index"] == 3
    assert clauses[1]["evidence_span"] == "svc"


def test_normalize_v92_maps_start_id_and_span():
    clauses = normalize_v92(V92)
    assert clauses[0]["anchor_index"] == 0
    assert clauses[0]["theme"] == "MODIFICATION_OF_TERMS"
    assert clauses[0]["evidence_span"] == "we revised"
    assert clauses[1]["anchor_index"] == 4


def test_normalize_dispatch():
    v, c94 = normalize_preannotation(V94)
    assert v == "v9.4" and len(c94) == 2
    v, c92 = normalize_preannotation(V92)
    assert v == "v9.2" and len(c92) == 2


def test_theme_alias_mapping():
    assert normalize_theme_code("THIRD_PARTY") == "THIRD_PARTY_SERVICES"
    assert normalize_theme_code("PAYMENT_BILLING") == "FEES_PAYMENT"
    assert normalize_theme_code("META") == "META"
    assert normalize_theme_code("totally_unknown") == "MISC_BOILERPLATE"


def test_claudette_loader_enforces_contiguity(tmp_path):
    from claire.corpora.loaders import load_claudette_document
    from claire.corpora.models import Corpus

    # Build a minimal CLAUDETTE-like tree.
    (tmp_path / "Sentences").mkdir()
    (tmp_path / "Sentences" / "Demo.txt").write_text(
        "first sentence .\nsecond -lrb- ok -rrb- .\nthird .\n", encoding="utf-8"
    )
    (tmp_path / "Labels_A").mkdir()
    (tmp_path / "Labels_A" / "Demo.txt").write_text("-1\n2\n-1\n", encoding="utf-8")

    corpus = Corpus.objects.create(slug="c", name="C")
    doc = load_claudette_document(corpus, tmp_path, "Demo")
    assert doc.n_sentences == 3
    indices = list(doc.sentences.values_list("index", flat=True))
    assert sorted(indices) == [0, 1, 2]  # INV-1 contiguity
    # detok produced clean text without -lrb-
    s1 = doc.sentences.get(index=1)
    assert "-lrb-" not in s1.clean_text
    # reference label level 2 at index 1
    assert doc.sentences.get(index=1).reference_labels.get(category="A").level == 2


def test_seed_annotation_from_preannotation_dedups_and_maps_theme(
    project, document_with_sentences, annotator
):
    from claire.imports.services import (
        ingest_preannotation,
        seed_annotation_from_preannotation,
    )

    # All anchors within document (5 sentences). Two clauses share anchor 0 ->
    # should be de-duped to satisfy INV-2.
    raw = {
        "doc": document_with_sentences.external_id,
        "judge": "claude",
        "version": "v9.4",
        "plan": {
            "clauses": [
                {"clause_id": 0, "theme": "META", "open_span": "a", "anchor_id": 0},
                {"clause_id": 1, "theme": "THIRD_PARTY", "open_span": "b",
                 "anchor_id": 0},
                {"clause_id": 2, "theme": "TERMINATION", "open_span": "c",
                 "anchor_id": 2},
            ]
        },
    }
    pre = ingest_preannotation(
        project, document_with_sentences, "claude", raw
    )
    ann = seed_annotation_from_preannotation(pre, annotator)
    # 2 distinct anchors -> 2 clauses.
    assert ann.clauses.count() == 2
    # THIRD_PARTY mapped to MISC (not in test scheme) since the test scheme only
    # has META/PREAMBLE_SCOPE/TERMINATION/MISC_BOILERPLATE.
    codes = set(ann.clauses.values_list("theme__code", flat=True))
    assert "META" in codes and "TERMINATION" in codes

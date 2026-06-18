"""Tests for pre-annotation loaders (v9.2 & v9.4) and CLAUDETTE loader."""

from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from claire.imports.loaders import (
    PreAnnotationFormatError,
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


def test_malformed_preannotation_raises_clear_error():
    # Neither 'plan' nor 'document_plan' -> clear format error, not a crash.
    with pytest.raises(PreAnnotationFormatError):
        normalize_preannotation({"doc": "X", "judge": "claude"})
    # Non-dict payload.
    with pytest.raises(PreAnnotationFormatError):
        detect_schema_version([1, 2, 3])


def test_malformed_v94_clause_anchor_raises():
    # Missing/invalid anchor_id and wrong container types must be reported, not
    # silently dropped or crash with a KeyError/TypeError.
    bad_anchor = {"plan": {"clauses": [{"theme": "META", "open_span": "x"}]}}
    with pytest.raises(PreAnnotationFormatError):
        normalize_v94(bad_anchor)

    not_a_list = {"plan": {"clauses": {"oops": True}}}
    with pytest.raises(PreAnnotationFormatError):
        normalize_v94(not_a_list)

    bad_segment = {"document_plan": {"segments": [{"theme": "META"}]}}
    with pytest.raises(PreAnnotationFormatError):
        normalize_v92(bad_segment)


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


def _write_mini_claudette(root):
    """Create a minimal CLAUDETTE tree with 2 documents under ``root``."""
    sentences = root / "Sentences"
    sentences.mkdir()
    (sentences / "DocOne.txt").write_text(
        "first sentence .\nsecond -lrb- ok -rrb- .\n", encoding="utf-8"
    )
    (sentences / "DocTwo.txt").write_text(
        "alpha .\nbeta .\ngamma .\n", encoding="utf-8"
    )
    labels_a = root / "Labels_A"
    labels_a.mkdir()
    (labels_a / "DocOne.txt").write_text("-1\n2\n", encoding="utf-8")
    (labels_a / "DocTwo.txt").write_text("1\n-1\n-1\n", encoding="utf-8")


def test_import_claudette_command_idempotent(tmp_path):
    from claire.corpora.models import Corpus, Document

    _write_mini_claudette(tmp_path)

    out = StringIO()
    call_command("import_claudette", "--source", str(tmp_path), stdout=out)
    corpus = Corpus.objects.get(slug="claudette-tos")
    assert Document.objects.filter(corpus=corpus).count() == 2
    doc1 = Document.objects.get(corpus=corpus, external_id="DocOne")
    assert doc1.n_sentences == 2
    assert doc1.sentences.get(index=1).reference_labels.get(category="A").level == 2

    # Re-running must not duplicate documents (idempotent).
    call_command("import_claudette", "--source", str(tmp_path), stdout=StringIO())
    assert Document.objects.filter(corpus=corpus).count() == 2


def test_import_claudette_missing_source_errors(tmp_path):
    missing = tmp_path / "nope"
    with pytest.raises(CommandError):
        call_command("import_claudette", "--source", str(missing), stdout=StringIO())

    # Directory exists but no Sentences/ subfolder -> clear error too.
    (tmp_path / "empty").mkdir()
    with pytest.raises(CommandError):
        call_command(
            "import_claudette", "--source", str(tmp_path / "empty"),
            stdout=StringIO(),
        )

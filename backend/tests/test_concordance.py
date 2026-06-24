"""Concordance humain ↔ LLM et LLM ↔ LLM (point 4)."""

import pytest

from claire.annotations.models import Annotation, AnnotationStatus, Clause
from claire.imports.models import PreAnnotation, PreClause
from claire.projects.concordance import project_concordance

pytestmark = pytest.mark.django_db


def _pre(project, document, judge, pairs):
    """Crée une pré-annotation d'un juge avec ses (anchor_index, theme_code)."""
    pre = PreAnnotation.objects.create(
        project=project, document=document, judge=judge,
        schema_version="v1", raw={},
    )
    for order, (idx, code) in enumerate(pairs):
        PreClause.objects.create(
            preannotation=pre, anchor_index=idx, theme_code=code, order=order
        )
    return pre


def test_concordance_human_vs_llm_and_llm_pairs(
    project, document_with_sentences, scheme_with_themes, annotator
):
    doc = document_with_sentences  # 5 phrases
    meta = scheme_with_themes.themes_map["META"]
    term = scheme_with_themes.themes_map["TERMINATION"]
    s = {i: doc.sentences.get(index=i) for i in range(5)}

    # Humain (exact per-sentence) : phrase 0 = META, phrase 3 = TERMINATION.
    ann = Annotation.objects.create(
        project=project, document=doc, annotator=annotator,
        status=AnnotationStatus.SUBMITTED,
    )
    Clause.objects.create(annotation=ann, anchor_sentence=s[0], theme=meta)
    Clause.objects.create(annotation=ann, anchor_sentence=s[3], theme=term)

    # Claude (forward-fill) : 0→META, 3→TERMINATION  ⇒ accord humain 2/2 = 100%.
    _pre(project, doc, "claude", [(0, "META"), (3, "TERMINATION")])
    # Codex (forward-fill) : 0→META, 3→MISC_BOILERPLATE ⇒ accord humain 1/2 = 50%.
    _pre(project, doc, "codex", [(0, "META"), (3, "MISC_BOILERPLATE")])

    rep = project_concordance(project, annotator)
    assert rep is not None
    assert rep["documents_compared"] == 1
    assert rep["human_covered"] == 2

    # Meilleur accord = Claude à 100%.
    assert rep["best_match"] == {"judge": "claude", "pct": 100.0}
    by_judge = {p["judge"]: p for p in rep["per_judge"]}
    assert by_judge["claude"]["pct"] == 100.0
    assert by_judge["claude"]["n"] == 2
    assert by_judge["codex"]["pct"] == 50.0
    # Classement décroissant : Claude avant Codex.
    assert [p["judge"] for p in rep["per_judge"]] == ["claude", "codex"]

    # LLM↔LLM : Claude vs Codex sur 5 phrases forward-fill (0,1,2=META ✓ ; 3,4 ✗) = 60%.
    assert len(rep["llm_pairs"]) == 1
    pair = rep["llm_pairs"][0]
    assert {pair["a"], pair["b"]} == {"claude", "codex"}
    assert pair["pct"] == 60.0
    assert rep["llm_mean_pct"] == 60.0


def test_concordance_none_without_preannotations(
    project, document_with_sentences, scheme_with_themes, annotator
):
    meta = scheme_with_themes.themes_map["META"]
    s0 = document_with_sentences.sentences.get(index=0)
    ann = Annotation.objects.create(
        project=project, document=document_with_sentences, annotator=annotator,
    )
    Clause.objects.create(annotation=ann, anchor_sentence=s0, theme=meta)
    # Aucun juge → rien à comparer.
    assert project_concordance(project, annotator) is None


def test_concordance_no_human_coverage_yields_null_pct(
    project, document_with_sentences, scheme_with_themes, annotator
):
    # L'annotateur a une session mais AUCUNE clause → couverture 0, pct null, best None.
    Annotation.objects.create(
        project=project, document=document_with_sentences, annotator=annotator,
    )
    _pre(project, document_with_sentences, "claude", [(0, "META")])
    rep = project_concordance(project, annotator)
    assert rep is not None
    assert rep["human_covered"] == 0
    assert rep["best_match"] is None
    assert rep["per_judge"][0]["pct"] is None

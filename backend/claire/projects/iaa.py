"""Inter-annotator agreement (feature 7) — Cohen's kappa.

We compute agreement on the per-sentence theme label: for each annotator we
build a vector of theme codes indexed by anchored sentence (segmentation is
monotone, so each clause-start labels the span until the next start). Sentences
not yet reached keep the previous clause's theme (forward fill).
"""

from __future__ import annotations

from collections import defaultdict

from claire.annotations.models import Annotation
from claire.corpora.models import Document


def _theme_vector(annotation: Annotation, n_sentences: int) -> list[str | None]:
    """Forward-fill theme codes across all sentences from clause anchors."""
    clauses = list(
        annotation.clauses.select_related("anchor_sentence", "theme").order_by(
            "anchor_sentence__index"
        )
    )
    vector: list[str | None] = [None] * n_sentences
    current: str | None = None
    starts = {c.anchor_sentence.index: c.theme.code for c in clauses}
    for i in range(n_sentences):
        if i in starts:
            current = starts[i]
        vector[i] = current
    return vector


def cohen_kappa(labels_a: list, labels_b: list) -> float:
    """Cohen's kappa for two equal-length label sequences.

    Returns 1.0 for perfect agreement; handles the degenerate single-category
    case by returning 1.0 when sequences are identical.
    """
    if len(labels_a) != len(labels_b):
        raise ValueError("label sequences must have equal length")
    n = len(labels_a)
    if n == 0:
        return 0.0

    agree = sum(1 for a, b in zip(labels_a, labels_b) if a == b)
    po = agree / n

    count_a: dict = defaultdict(int)
    count_b: dict = defaultdict(int)
    for a in labels_a:
        count_a[a] += 1
    for b in labels_b:
        count_b[b] += 1
    categories = set(count_a) | set(count_b)
    pe = sum((count_a[c] / n) * (count_b[c] / n) for c in categories)

    if pe == 1.0:
        return 1.0 if po == 1.0 else 0.0
    return (po - pe) / (1 - pe)


def pairwise_kappa_for_document(document: Document, project) -> list[dict]:
    """Compute kappa for every pair of submitted annotations of a document."""
    n = document.n_sentences
    anns = list(
        project.annotations.filter(
            document=document,
            status__in=["submitted", "in_review", "approved"],
        ).select_related("annotator")
    )
    vectors = {a.id: (a, _theme_vector(a, n)) for a in anns}
    results: list[dict] = []
    ids = list(vectors)
    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            a1, v1 = vectors[ids[i]]
            a2, v2 = vectors[ids[j]]
            results.append(
                {
                    "document": document.external_id,
                    "annotator_a": a1.annotator.username,
                    "annotator_b": a2.annotator.username,
                    "kappa": round(cohen_kappa(v1, v2), 4),
                    "n_sentences": n,
                }
            )
    return results


def project_iaa(project) -> dict:
    """Aggregate kappa across all documents with >= 2 annotators."""
    per_doc: list[dict] = []
    documents = (
        Document.objects.filter(annotations__project=project).distinct()
    )
    for doc in documents:
        per_doc.extend(pairwise_kappa_for_document(doc, project))
    if per_doc:
        mean_kappa = round(
            sum(d["kappa"] for d in per_doc) / len(per_doc), 4
        )
    else:
        mean_kappa = None
    return {"mean_kappa": mean_kappa, "pairs": per_doc}

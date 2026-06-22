"""Inter-annotator agreement (feature 7) — Cohen's kappa.

We compute agreement on the **per-sentence** theme label: for each annotator we
build a vector of theme codes indexed by sentence. Annotation is per-sentence
(C4) — sentence *i* takes the theme of the clause anchored exactly at *i*, or
``None`` if that sentence is unlabeled. No forward-fill: an unlabeled sentence
is genuinely unlabeled (``None``), not the previous clause's theme.
"""

from __future__ import annotations

from collections import defaultdict

from claire.annotations.models import Annotation
from claire.corpora.models import Document

from .masi import alpha_masi


def _theme_vector(annotation: Annotation, n_sentences: int) -> list[str | None]:
    """Per-sentence theme codes (C4) : sentence *i* = theme of the clause anchored
    at *i*, else ``None``. No forward-fill — annotation is per-sentence."""
    clauses = annotation.clauses.select_related("anchor_sentence", "theme")
    starts = {c.anchor_sentence.index: c.theme.code for c in clauses}
    return [starts.get(i) for i in range(n_sentences)]


def _theme_set_vector(annotation: Annotation, n_sentences: int) -> list[set[str]]:
    """Per-sentence theme SETS (multi-label, forward-fill) pour α MASI.

    Phrase *i* = ensemble des thèmes (primaire + secondaires via `theme_tags`) de la
    clause couvrant *i* (dernière ancre <= i). Ensemble vide avant la 1ʳᵉ clause.
    """
    clauses = list(
        annotation.clauses.select_related("anchor_sentence").prefetch_related("theme_tags__theme")
    )
    items = sorted(((c.anchor_sentence.index, c) for c in clauses), key=lambda x: x[0])
    vec: list[set[str]] = []
    cur: set[str] = set()
    k = 0
    for i in range(n_sentences):
        while k < len(items) and items[k][0] <= i:
            c = items[k][1]
            tags = list(c.theme_tags.all())
            cur = {t.theme.code for t in tags} if tags else {c.theme.code}
            k += 1
        vec.append(set(cur))
    return vec


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


def project_iaa_detail(project) -> dict | None:
    """Build the IaaDetail payload (CONTRACT) or None when < 2 annotators.

    - globalKappa : mean Cohen's kappa across all annotator pairs/documents.
    - annotatorPairs : number of compared (annotator, annotator) pairs.
    - boundaryKappa : agreement on clause-start boundaries (segmentation).
    - perTheme : per-theme kappa with support, plus a "__boundaries__" row.
    """
    statuses = ["submitted", "in_review", "approved"]
    documents = list(
        Document.objects.filter(
            annotations__project=project,
            annotations__status__in=statuses,
        ).distinct()
    )

    # Correction N≥3 (ADR‑001 §E) : on calcule κ PAR PAIRE puis on MOYENNE. L'ancienne
    # version concaténait les observations de toutes les paires (chaque phrase comptée
    # une fois par paire) → double‑comptage dès 3 annotateurs. Moyenner les κ par paire
    # donne une mesure non biaisée et cohérente avec `global_kappa`/`pairs`.
    theme_kappas: dict[str, list[float]] = defaultdict(list)
    theme_support: dict[str, int] = defaultdict(int)
    boundary_kappas: list[float] = []
    global_pairs: list[float] = []
    pair_count = 0
    # Unités pour l'α de Krippendorff-MASI (multi-label) : par phrase, la liste des
    # ENSEMBLES de thèmes des annotateurs (non vides) — agrégée sur tous les documents.
    masi_units: list[list[set[str]]] = []

    themes = {t.code: t.label for t in project.scheme.themes.all()}

    for doc in documents:
        n = doc.n_sentences
        anns = list(
            project.annotations.filter(
                document=doc, status__in=statuses
            ).select_related("annotator")
        )
        if len(anns) < 2:
            continue
        vectors = {a.id: _theme_vector(a, n) for a in anns}
        set_vectors = {a.id: _theme_set_vector(a, n) for a in anns}
        for i in range(n):
            unit = [set_vectors[a.id][i] for a in anns if set_vectors[a.id][i]]
            if len(unit) >= 2:
                masi_units.append(unit)
        starts = {
            a.id: set(
                a.clauses.values_list("anchor_sentence__index", flat=True)
            )
            for a in anns
        }
        ids = list(vectors)
        for i in range(len(ids)):
            for j in range(i + 1, len(ids)):
                v1, v2 = vectors[ids[i]], vectors[ids[j]]
                global_pairs.append(cohen_kappa(v1, v2))
                pair_count += 1
                # Frontières (segmentation) : κ par paire sur le vecteur "début de
                # clause à l'index ?" (booléen par phrase), moyenné ensuite.
                b1 = [idx in starts[ids[i]] for idx in range(n)]
                b2 = [idx in starts[ids[j]] for idx in range(n)]
                boundary_kappas.append(cohen_kappa(b1, b2))
                # Par thème (one‑vs‑rest) : κ par paire + support, moyenné ensuite.
                for code in set(v for v in v1 + v2 if v):
                    a_lab = [c == code for c in v1]
                    b_lab = [c == code for c in v2]
                    theme_kappas[code].append(cohen_kappa(a_lab, b_lab))
                    theme_support[code] += sum(a_lab) + sum(b_lab)

    if pair_count == 0:
        return None

    global_kappa = round(sum(global_pairs) / len(global_pairs), 4)
    boundary_kappa = round(sum(boundary_kappas) / len(boundary_kappas), 4)

    per_theme = []
    for code, kappas in sorted(theme_kappas.items()):
        if not kappas:
            continue
        per_theme.append(
            {
                "code": code,
                "label": themes.get(code, code),
                "kappa": round(sum(kappas) / len(kappas), 4),
                "support": theme_support[code],
            }
        )

    masi = alpha_masi(masi_units)

    return {
        "global_kappa": global_kappa,
        "annotator_pairs": pair_count,
        "boundary_kappa": boundary_kappa,
        # α Krippendorff-MASI (multi-label) : indicateur tête de gondole du protocole.
        "alpha_masi": round(masi, 4) if masi is not None else None,
        "per_theme": per_theme,
    }

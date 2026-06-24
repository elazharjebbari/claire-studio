"""Concordance humain ↔ LLM et LLM ↔ LLM (feature « point 4 »).

Agrège, pour un annotateur donné et sur l'ensemble de ses annotations d'une
campagne, l'accord entre SON annotation et chaque modèle LLM pré-annoté, ainsi
qu'entre les modèles eux-mêmes.

Modèles (cohérents avec `iaa.py` et le frontend) :
  - HUMAIN : per-sentence EXACT — la phrase *i* porte le thème de la clause ancrée
    exactement en *i*, sinon ``None`` (pas de forward-fill).
  - LLM : modèle de bloc — le thème forward-fill depuis l'ancre du juge.

Mesure = accord sur l'INTERSECTION : parmi les phrases co-couvertes par les deux
parties, la fraction qui porte le même thème. Le support (``n``) est explicite.
"""

from __future__ import annotations

from collections import defaultdict

from claire.imports.models import PreAnnotation

from .iaa import _theme_vector


def _judge_vector(preclauses, n_sentences: int) -> list[str | None]:
    """Vecteur par phrase d'un juge (forward-fill, modèle de bloc)."""
    items = sorted((c.anchor_index, c.theme_code) for c in preclauses)
    vec: list[str | None] = []
    cur: str | None = None
    k = 0
    for i in range(n_sentences):
        while k < len(items) and items[k][0] <= i:
            cur = items[k][1]
            k += 1
        vec.append(cur)
    return vec


def _intersection(a: list, b: list) -> tuple[int, int]:
    """(co-couvertes, accords) sur l'intersection de deux vecteurs alignés."""
    n = 0
    matches = 0
    for x, y in zip(a, b):
        if x is not None and y is not None:
            n += 1
            if x == y:
                matches += 1
    return n, matches


def _judge_vectors_for_document(project, document, n_sentences: int) -> dict[str, list]:
    """Vecteur forward-fill par juge pour un document (dernière version importée)."""
    pres = list(
        PreAnnotation.objects.filter(project=project, document=document)
        .order_by("imported_at")
        .prefetch_related("preclauses")
    )
    # Une seule entrée par juge : la PLUS RÉCENTE (order_by croissant → la dernière gagne).
    by_judge: dict[str, PreAnnotation] = {}
    for p in pres:
        by_judge[p.judge] = p
    return {
        judge: _judge_vector(p.preclauses.all(), n_sentences)
        for judge, p in by_judge.items()
    }


def project_concordance(project, user) -> dict:
    """Agrège la concordance de l'annotateur ``user`` sur ses annotations du projet.

    Renvoie ``per_judge`` (accord humain↔juge, trié décroissant), ``best_match``
    (juge le plus concordant), ``llm_pairs`` + ``llm_mean_pct`` (LLM↔LLM), et le
    nombre de documents comparés. ``None`` si rien à comparer (ni annotation, ni juge).
    """
    annotations = list(
        project.annotations.filter(annotator=user).select_related("document")
    )

    # Accumulateurs humain↔juge et juge↔juge (sur l'ensemble des documents).
    hj_n: dict[str, int] = defaultdict(int)
    hj_m: dict[str, int] = defaultdict(int)
    jj_n: dict[tuple[str, str], int] = defaultdict(int)
    jj_m: dict[tuple[str, str], int] = defaultdict(int)
    documents_compared = 0
    human_covered = 0

    for ann in annotations:
        doc = ann.document
        n = doc.n_sentences
        if not n:
            continue
        judge_vecs = _judge_vectors_for_document(project, doc, n)
        if not judge_vecs:
            continue
        human = _theme_vector(ann, n)
        human_covered += sum(1 for t in human if t is not None)
        documents_compared += 1

        for judge, vec in judge_vecs.items():
            n_co, m = _intersection(human, vec)
            hj_n[judge] += n_co
            hj_m[judge] += m

        judges = sorted(judge_vecs)
        for i in range(len(judges)):
            for j in range(i + 1, len(judges)):
                a, b = judges[i], judges[j]
                n_co, m = _intersection(judge_vecs[a], judge_vecs[b])
                jj_n[(a, b)] += n_co
                jj_m[(a, b)] += m

    if documents_compared == 0:
        return None

    per_judge = []
    for judge in hj_n:
        n_co = hj_n[judge]
        pct = round((hj_m[judge] / n_co) * 100, 1) if n_co else None
        per_judge.append({"judge": judge, "pct": pct, "n": n_co, "matches": hj_m[judge]})
    # Tri : meilleurs accords d'abord, juges sans support (pct None) en fin.
    per_judge.sort(key=lambda p: (p["pct"] is None, -(p["pct"] or 0)))

    with_support = [p for p in per_judge if p["pct"] is not None]
    best_match = (
        {"judge": with_support[0]["judge"], "pct": with_support[0]["pct"]}
        if with_support
        else None
    )

    llm_pairs = []
    for (a, b), n_co in jj_n.items():
        pct = round((jj_m[(a, b)] / n_co) * 100, 1) if n_co else None
        llm_pairs.append({"a": a, "b": b, "pct": pct, "n": n_co})
    pcts = [p["pct"] for p in llm_pairs if p["pct"] is not None]
    llm_mean_pct = round(sum(pcts) / len(pcts), 1) if pcts else None

    return {
        "per_judge": per_judge,
        "best_match": best_match,
        "llm_pairs": llm_pairs,
        "llm_mean_pct": llm_mean_pct,
        "documents_compared": documents_compared,
        "human_covered": human_covered,
    }

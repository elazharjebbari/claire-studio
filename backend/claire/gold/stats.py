"""Statistiques de concordance GOLD — réutilise iaa/concordance + le gold décidé.

- A↔GOLD : pour chaque annotateur, accord avec le gold sur les phrases co-couvertes ET
  décidées → classement « qui est le plus proche du gold ».
- LLM↔GOLD : idem pour chaque juge (modèle de bloc forward-fill).
- A↔A : on réutilise `project_iaa` (κ moyen + paires) côté endpoint.

Accord = fraction d'accord sur l'INTERSECTION (même modèle que `concordance`).
"""

from __future__ import annotations

from collections import defaultdict

from claire.annotations.models import Annotation
from claire.common.identity import display_name, user_color
from claire.projects.concordance import _intersection, _judge_vectors_for_document
from claire.projects.iaa import _theme_vector

from .config import annotation_statuses
from .models import GoldResolution


def gold_vector(resolution: GoldResolution, n_sentences: int) -> list[str | None]:
    """Vecteur par phrase du gold DÉCIDÉ (code de thème), ``None`` si non décidée."""
    decided = {
        gs.index: gs.primary_theme.code
        for gs in resolution.sentences.select_related("primary_theme")
        if gs.decided and gs.primary_theme_id
    }
    return [decided.get(i) for i in range(n_sentences)]


def gold_stats(project) -> dict:
    """Concordance A↔GOLD et LLM↔GOLD agrégée sur les documents résolus du projet."""
    statuses = annotation_statuses(project)
    resolutions = list(
        GoldResolution.objects.filter(project=project).select_related("document")
    )

    ag_n: dict[str, int] = defaultdict(int)
    ag_m: dict[str, int] = defaultdict(int)
    jg_n: dict[str, int] = defaultdict(int)
    jg_m: dict[str, int] = defaultdict(int)
    users: dict[str, object] = {}
    documents_compared = 0
    gold_covered = 0

    for res in resolutions:
        doc = res.document
        n = doc.n_sentences
        if not n:
            continue
        gold = gold_vector(res, n)
        covered = sum(1 for g in gold if g is not None)
        if covered == 0:
            continue
        documents_compared += 1
        gold_covered += covered

        anns = (
            Annotation.objects.filter(project=project, document=doc, status__in=statuses)
            .select_related("annotator")
        )
        for ann in anns:
            human = _theme_vector(ann, n)
            n_co, m = _intersection(human, gold)
            key = ann.annotator.username
            ag_n[key] += n_co
            ag_m[key] += m
            users[key] = ann.annotator

        for judge, vec in _judge_vectors_for_document(project, doc, n).items():
            n_co, m = _intersection(vec, gold)
            jg_n[judge] += n_co
            jg_m[judge] += m

    def _row_user(key: str) -> dict:
        n_co = ag_n[key]
        u = users.get(key)
        return {
            "username": key,
            "display_name": display_name(u) if u else key,
            "color": user_color(getattr(u, "id", key)),
            "pct": round(ag_m[key] / n_co * 100, 1) if n_co else None,
            "n": n_co,
            "matches": ag_m[key],
        }

    annotators = [_row_user(k) for k in ag_n]
    annotators.sort(key=lambda r: (r["pct"] is None, -(r["pct"] or 0)))

    judges = [
        {
            "judge": j,
            "pct": round(jg_m[j] / jg_n[j] * 100, 1) if jg_n[j] else None,
            "n": jg_n[j],
            "matches": jg_m[j],
        }
        for j in jg_n
    ]
    judges.sort(key=lambda r: (r["pct"] is None, -(r["pct"] or 0)))

    closest = annotators[0] if annotators and annotators[0]["pct"] is not None else None
    return {
        "annotators": annotators,
        "judges": judges,
        "closest_to_gold": (
            {"username": closest["username"], "display_name": closest["display_name"], "pct": closest["pct"]}
            if closest
            else None
        ),
        "documents_compared": documents_compared,
        "gold_covered": gold_covered,
    }

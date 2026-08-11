"""Accord inter-annotateurs et matrice humains × LLM — module PUR.

Complète `claire.projects.masi` (α de Krippendorff / distance MASI, déjà écrit et testé)
en l'appliquant au `payload` d'un snapshot, et en produisant les deux tableaux dont
l'article a besoin :

1. **α-MASI ET α nominal côte à côte.** C'est leur ÉCART qui porte le résultat, pas la
   valeur absolue : 0,635 contre 0,701 sur le même matériau signifie que le passage au
   multi-label fait *perdre* de la fiabilité et franchir le seuil d'acceptabilité vers
   le bas. Rapporter α-MASI seul cacherait le résultat.

2. **La matrice d'accord 7×7** (3 annotateurs + 4 juges LLM). Elle établit que
   l'humain↔humain (~80 % brut) domine largement l'humain↔LLM (48–60 %), et que les LLM
   eux-mêmes ne s'accordent qu'à 34–81 % : le « mur du κ » est une limite des modèles,
   pas de la tâche.
"""

from __future__ import annotations

from collections import defaultdict
from itertools import combinations

from claire.projects.masi import alpha_masi, krippendorff_alpha, nominal_distance

from .quality import ALPHA_ACCEPTABLE, ALPHA_RELIABLE, theme_sets_by_sentence


def _primary_by_sentence(clauses: list[dict], n_sentences: int) -> list[str | None]:
    """Thème primaire de chaque phrase (projection par bloc)."""
    by_anchor = {row["anchorIndex"]: row for row in clauses}
    out: list[str | None] = []
    current: dict | None = None
    for index in range(n_sentences):
        current = by_anchor.get(index, current)
        out.append(current["primaryTheme"] if current else None)
    return out


def alpha_masi_report(payload: dict) -> dict:
    """α-MASI multi-label, α nominal de contrôle, et le détail par thème."""
    documents = {row["id"]: row for row in payload.get("documents", [])}
    by_document: dict[int, list[list[frozenset[str]]]] = defaultdict(list)
    for annotation in payload.get("annotations", []):
        doc = documents.get(annotation["documentId"])
        if not doc:
            continue
        by_document[annotation["documentId"]].append(
            theme_sets_by_sentence(annotation.get("clauses", []), doc.get("nSentences", 0))
        )

    masi_units: list[list[set[str]]] = []
    mono_units: list[list[set[str]]] = []
    # Unités par thème, en un-contre-tous : permet un α par étiquette, indispensable
    # pour montrer que ce sont les thèmes rares qui s'effondrent.
    per_theme_units: dict[str, list[list[set[str]]]] = defaultdict(list)
    all_themes: set[str] = set()

    for document_id, vectors in by_document.items():
        if len(vectors) < 2:
            continue
        n = documents[document_id].get("nSentences", 0)
        for index in range(n):
            unit = [set(v[index]) for v in vectors if v[index]]
            if len(unit) < 2:
                continue
            masi_units.append(unit)
            # Contrôle mono-label : on ne garde qu'une étiquette par juge. Le choix du
            # min() est arbitraire mais DÉTERMINISTE — il ne s'agit pas de mesurer le
            # primaire mais d'obtenir une référence nominale sur le même échantillon.
            mono_units.append([{min(s)} for s in unit])
            for theme in set().union(*unit):
                all_themes.add(theme)
                per_theme_units[theme].append(
                    [({theme} if theme in s else set()) for s in unit]
                )

    alpha_multi = alpha_masi(masi_units)
    alpha_mono = krippendorff_alpha(mono_units, nominal_distance)

    per_theme = []
    for theme in sorted(all_themes):
        units = per_theme_units[theme]
        value = alpha_masi(units)
        per_theme.append(
            {
                "code": theme,
                "alpha": round(value, 4) if value is not None else None,
                "support": len(units),
            }
        )
    per_theme.sort(key=lambda r: -r["support"])

    def band(value: float | None) -> str:
        if value is None:
            return "unknown"
        if value >= ALPHA_RELIABLE:
            return "reliable"
        if value >= ALPHA_ACCEPTABLE:
            return "acceptable"
        return "below_threshold"

    cost = None
    if alpha_multi is not None and alpha_mono is not None:
        cost = round(alpha_mono - alpha_multi, 4)

    return {
        "alphaMasi": round(alpha_multi, 4) if alpha_multi is not None else None,
        "alphaNominal": round(alpha_mono, 4) if alpha_mono is not None else None,
        # Le résultat R1 de l'article : ce que coûte l'autorisation du multi-label.
        "multiLabelCost": cost,
        "band": band(alpha_multi),
        "thresholds": {"acceptable": ALPHA_ACCEPTABLE, "reliable": ALPHA_RELIABLE},
        "units": len(masi_units),
        "perTheme": per_theme,
        "warnings": ["insufficient_support"] if len(masi_units) < 20 else [],
    }


def human_llm_matrix(payload: dict, judge_order: list[str] | None = None) -> dict:
    """Matrice d'accord brut entre tous les acteurs (humains et juges LLM).

    `judge_order` doit provenir de la source unique de nomenclature des juges — jamais
    d'une liste écrite ici (le projet a une garde de test contre les listes de juges en
    dur, et c'est cette duplication qui avait fait manquer Mistral par le passé).
    """
    documents = {row["id"]: row for row in payload.get("documents", [])}
    vectors: dict[str, dict[int, list[str | None]]] = defaultdict(dict)
    kinds: dict[str, str] = {}

    for annotation in payload.get("annotations", []):
        doc = documents.get(annotation["documentId"])
        if not doc:
            continue
        key = annotation["actorKey"]
        kinds[key] = "human"
        vectors[key][annotation["documentId"]] = _primary_by_sentence(
            annotation.get("clauses", []), doc.get("nSentences", 0)
        )

    for llm in payload.get("llmAnnotations", []):
        doc = documents.get(llm["documentId"])
        if not doc:
            continue
        key = f"llm:{llm['judge']}"
        kinds[key] = "llm"
        vectors[key][llm["documentId"]] = _primary_by_sentence(
            llm.get("clauses", []), doc.get("nSentences", 0)
        )

    def sort_key(actor: str) -> tuple:
        if kinds[actor] == "human":
            return (0, actor)
        judge = actor.removeprefix("llm:")
        if judge_order and judge in judge_order:
            return (1, judge_order.index(judge))
        return (2, judge)

    actors = sorted(vectors, key=sort_key)
    cells = []
    intra_human, intra_llm, cross = [], [], []
    for a, b in combinations(actors, 2):
        shared = set(vectors[a]) & set(vectors[b])
        agree = total = 0
        for document_id in shared:
            va, vb = vectors[a][document_id], vectors[b][document_id]
            for x, y in zip(va, vb):
                if x is None or y is None:
                    continue
                total += 1
                agree += x == y
        if total == 0:
            continue
        rate = agree / total
        cells.append(
            {
                "a": a,
                "b": b,
                "agreement": round(rate, 4),
                "n": total,
                "kind": f"{kinds[a]}_{kinds[b]}",
            }
        )
        if kinds[a] == kinds[b] == "human":
            intra_human.append(rate)
        elif kinds[a] == kinds[b] == "llm":
            intra_llm.append(rate)
        else:
            cross.append(rate)

    def mean(values: list[float]) -> float | None:
        return round(sum(values) / len(values), 4) if values else None

    return {
        "actors": [{"key": key, "kind": kinds[key]} for key in actors],
        "cells": cells,
        "humanMean": mean(intra_human),
        "llmMean": mean(intra_llm),
        "crossMean": mean(cross),
        # Le résultat R2 : de combien les humains dominent-ils le meilleur LLM ?
        "humanAdvantage": (
            round(mean(intra_human) - mean(cross), 4)
            if intra_human and cross
            else None
        ),
        "warnings": ["insufficient_support"] if not intra_human else [],
    }


def annotator_audit(payload: dict) -> dict:
    """Profil de chaque annotateur : volume, validation, biais thématique.

    `themeBias` compare l'emploi d'un thème par un annotateur à la moyenne de ses pairs.
    Sert à détecter un biais systématique (un annotateur qui sur-emploie un refuge, par
    exemple) — à des fins d'audit, jamais de classement affiché aux annotateurs.
    """
    documents = {row["id"]: row for row in payload.get("documents", [])}
    per_actor: dict[str, dict] = defaultdict(
        lambda: {"clauses": 0, "validated": 0, "documents": set(), "themes": defaultdict(int)}
    )
    global_themes: dict[str, int] = defaultdict(int)
    total_clauses = 0

    for annotation in payload.get("annotations", []):
        key = annotation["actorKey"]
        stats = per_actor[key]
        stats["documents"].add(annotation["documentId"])
        for clause in annotation.get("clauses", []):
            stats["clauses"] += 1
            total_clauses += 1
            stats["validated"] += bool(clause.get("validated"))
            stats["themes"][clause["primaryTheme"]] += 1
            global_themes[clause["primaryTheme"]] += 1

    rows = []
    for key, stats in sorted(per_actor.items()):
        n = stats["clauses"]
        bias = []
        for theme, count in sorted(stats["themes"].items()):
            actor_share = count / n if n else 0.0
            global_share = global_themes[theme] / total_clauses if total_clauses else 0.0
            if global_share > 0:
                bias.append(
                    {
                        "code": theme,
                        "actorShare": round(actor_share, 4),
                        "globalShare": round(global_share, 4),
                        "ratio": round(actor_share / global_share, 3),
                    }
                )
        bias.sort(key=lambda r: -abs(r["ratio"] - 1))
        rows.append(
            {
                "actorKey": key,
                "clauses": n,
                "documents": len(stats["documents"]),
                "validated": stats["validated"],
                "validationRate": round(stats["validated"] / n, 4) if n else None,
                "themeBias": bias[:5],
            }
        )

    n_docs = len(documents) or 1
    return {
        "actors": rows,
        "totalClauses": total_clauses,
        # Une charge très déséquilibrée (90 % par une personne au 11/08) doit apparaître :
        # elle conditionne la lecture de tous les accords.
        "workloadImbalance": (
            round(max(r["clauses"] for r in rows) / total_clauses, 4) if rows else None
        ),
        "documentsCovered": len(
            {a["documentId"] for a in payload.get("annotations", [])}
        ) / n_docs,
        "warnings": ["restricted_metric"],
    }


def gold_progress(payload: dict) -> dict:
    """Avancement de la cascade de résolution (auto_1click / auto / manual)."""
    from collections import Counter

    rows = payload.get("goldSentences", [])
    auto = Counter(row.get("autoLevel") or "unknown" for row in rows)
    agreement = Counter(row.get("agreementClass") or "unknown" for row in rows)
    risk = Counter(row.get("riskBand") or "unknown" for row in rows)
    decided = sum(1 for row in rows if row.get("decided"))
    backlog = [
        {"documentId": row["documentId"], "index": row["index"], "riskBand": row.get("riskBand")}
        for row in rows
        if row.get("autoLevel") == "manual" and not row.get("decided")
    ]
    # Le tri met les divergences fortes en tête : c'est l'ordre d'arbitrage recommandé.
    order = {"high": 0, "medium": 1, "low": 2}
    backlog.sort(key=lambda r: order.get(r["riskBand"], 3))

    return {
        "sentences": len(rows),
        "decided": decided,
        "pctDecided": round(decided / len(rows), 4) if rows else None,
        "byAutoLevel": dict(sorted(auto.items())),
        "byAgreementClass": dict(sorted(agreement.items())),
        "byRiskBand": dict(sorted(risk.items())),
        "arbitrationBacklog": backlog[:100],
        "backlogSize": len(backlog),
        "documents": len({row["documentId"] for row in rows}),
        "warnings": ["insufficient_support"] if not rows else [],
    }

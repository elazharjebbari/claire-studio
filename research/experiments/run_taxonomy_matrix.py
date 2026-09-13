"""Matrice expérimentale des taxonomies — produit les tableaux publiables du papier.

Exécute les MÊMES mesures pour T20/T14/T11/T10 sur trois populations (corpus complet,
33 documents de conception, 17 documents de validation) et trois sources d'étiquettes
(annotations brutes, consensus, gold), à partir d'un export daté du Lab.

Trois propriétés rendent ces chiffres exploitables :

* **Appariement gratuit** — la projection est faite au CHARGEMENT sur le MÊME dataset :
  documents et plis identiques d'une taxonomie à l'autre, donc les différences se testent
  en apparié sans construction supplémentaire.
* **Traçabilité** — chaque cellule cite l'empreinte du dataset, celle de la spécification
  de taxonomie, la population et la source. Un chiffre du papier est rejouable tel quel.
* **Séparation des populations** — conception et validation ne sont jamais mélangées, et
  le corpus complet est rapporté comme tel, jamais comme une validation.

Usage : python -m research.experiments.run_taxonomy_matrix <dossier-dataset> [sortie.json]
"""

from __future__ import annotations

import json
import math
import sys
from collections import Counter, defaultdict
from itertools import combinations
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "research"))

from pactiva_lab import taxonomy as tx  # noqa: E402
from pactiva_lab.data import load_gold, load_votes  # noqa: E402
from pactiva_lab.evaluation.agreement import (  # noqa: E402
    _AlphaPool,
    _rng_ints,
    alpha_masi_vs_nominal,
    gwet_ac1_binary,
    krippendorff_alpha_set,
    masi_distance,
    nominal_set_distance,
)

TAXONOMIES = ["T20", "T14", "T11", "T10"]
POPULATIONS = [("all", None), ("designSet", "designSet"), ("holdout", "holdout")]
N_RESAMPLES = 1000
SEED = 42


# ── Chargements projetés ────────────────────────────────────────────────────
def votes_by_sentence(root: Path, taxonomy: str, population: str | None) -> dict:
    """(document, index) → [(annotateur, primaire, jeu de thèmes)] — projeté et filtré."""
    rows = tx.filter_population(load_votes(root, taxonomy=taxonomy), population)
    out: dict = defaultdict(list)
    for r in rows:
        themes = frozenset([r["primary"], *r["secondaries"]])
        out[(r["document"], r["index"])].append((r["annotator"], r["primary"], themes))
    return out


def sentences_rows(root: Path, taxonomy: str, population: str | None) -> list:
    """Phrases consensus projetées (sans passer par load_dataset : pas de plis requis)."""
    rows = []
    with (root / "sentences.jsonl").open(encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            row = json.loads(line)
            primary, secondaries = tx.project_primary_and_secondaries(
                row["primary"], [t for t in row["themes"] if t != row["primary"]], taxonomy
            )
            rows.append({
                "document": row["document"], "index": row["index"],
                "primary": primary, "themes": [primary, *secondaries],
                "unfair": row.get("unfair", []),
            })
    return tx.filter_population(rows, population)


def unfair_index(root: Path) -> dict:
    """(document, index) → catégories d'abusivité CLAUDETTE (référence, jamais projetée)."""
    index: dict = defaultdict(set)
    path = root / "reference.jsonl"
    if path.exists():
        with path.open(encoding="utf-8") as handle:
            for line in handle:
                if line.strip():
                    r = json.loads(line)
                    index[(r["document"], r["index"])].add(r["category"])
    return index


# ── Mesures ─────────────────────────────────────────────────────────────────
def agreement_block(by_sentence: dict) -> dict:
    """α-MASI, α nominal, Δ apparié, désaccords, α et AC1 par classe."""
    masi_units: dict = defaultdict(list)
    nominal_units: dict = defaultdict(list)
    all_units: list = []
    agree = disagree = 0
    for (document, _index), items in sorted(by_sentence.items()):
        if len(items) < 2:
            continue
        sets = [s for _, _, s in items]
        primaries = [p for _, p, _ in items]
        masi_units[document].append(sets)
        nominal_units[document].append([frozenset([p]) for p in primaries])
        all_units.append(sets)
        for a, b in combinations(primaries, 2):
            if a == b:
                agree += 1
            else:
                disagree += 1

    if not masi_units:
        return {"n_units": 0}

    paired = alpha_masi_vs_nominal(
        masi_units, nominal_units, n_resamples=N_RESAMPLES, seed=SEED
    )
    classes = sorted({c for unit in all_units for s in unit for c in s})
    per_class = {}
    for code in classes:
        units = [[code in s for s in unit] for unit in all_units]
        binary = [
            [frozenset(["1"]) if b else frozenset(["0"]) for b in u] for u in units
        ]
        alpha = krippendorff_alpha_set(binary, distance=nominal_set_distance)
        per_class[code] = {
            "alpha": round(alpha, 4) if alpha is not None else None,
            "ac1": round(gwet_ac1_binary(units), 4) if gwet_ac1_binary(units) is not None else None,
            "support_units": sum(1 for unit in all_units if any(code in s for s in unit)),
        }

    return {
        "n_units": len(all_units),
        "n_documents": len(masi_units),
        "alpha_masi": paired["alphaMasi"],
        "alpha_masi_ci": None,
        "alpha_nominal": paired["alphaNominal"],
        "multilabel_cost": paired["diff"],
        "multilabel_cost_ci": [paired["diffLow"], paired["diffHigh"]],
        "sign_stability": round(1 - (paired["pDirection"] or 0), 4),
        "pairs": agree + disagree,
        "disagreements": disagree,
        "disagreement_rate": round(disagree / (agree + disagree), 4) if (agree + disagree) else None,
        "n_classes": len(classes),
        "per_class": per_class,
        "min_class_alpha": min(
            ((c, v["alpha"]) for c, v in per_class.items() if v["alpha"] is not None),
            key=lambda kv: kv[1], default=(None, None),
        ),
    }


def paired_delta_vs_canonical(root: Path, population: str | None, taxonomy: str) -> dict:
    """Δ d'α-MASI contre T20, sur les MÊMES tirages bootstrap de documents.

    C'est le test qui compte : les deux α sont recalculés sur chaque rééchantillon, donc
    l'IC porte sur la DIFFÉRENCE — pas sur deux intervalles comparés à l'œil."""
    pools = {}
    for tid in ("T20", taxonomy):
        by_sentence = votes_by_sentence(root, tid, population)
        units: dict = defaultdict(list)
        for (document, _index), items in sorted(by_sentence.items()):
            if len(items) >= 2:
                units[document].append([s for _, _, s in items])
        pools[tid] = _AlphaPool(units, masi_distance)

    documents = pools["T20"].documents
    point = pools[taxonomy].alpha(documents) - pools["T20"].alpha(documents)
    deltas, flips = [], 0
    for draw in _rng_ints(SEED, f"taxo-{taxonomy}-{population}", len(documents), N_RESAMPLES):
        sample = [documents[i] for i in draw]
        a, b = pools[taxonomy].alpha(sample), pools["T20"].alpha(sample)
        if a is None or b is None:
            continue
        deltas.append(a - b)
        flips += (a - b) <= 0
    deltas.sort()
    return {
        "delta": round(point, 4),
        "ci": [round(deltas[int(0.025 * len(deltas))], 4),
               round(deltas[min(len(deltas) - 1, int(0.975 * len(deltas)))], 4)],
        "sign_stability": round(1 - flips / len(deltas), 4),
        "n_resamples": len(deltas),
        "n_documents": len(documents),
    }


def mutual_information(pairs) -> float:
    joint = Counter(pairs)
    total = sum(joint.values())
    px, py = Counter(), Counter()
    for (x, y), c in joint.items():
        px[x] += c
        py[y] += c
    return sum(
        (c / total) * math.log((c / total) / ((px[x] / total) * (py[y] / total)))
        for (x, y), c in joint.items()
    )


def average_precision(scored) -> float | None:
    scored = sorted(scored, key=lambda x: -x[0])
    n_pos = sum(1 for _, y in scored if y)
    if not n_pos:
        return None
    tp = 0
    total = 0.0
    for rank, (_score, y) in enumerate(scored, start=1):
        if y:
            tp += 1
            total += tp / rank
    return total / n_pos


def unfairness_block(rows: list, unfair: dict) -> dict:
    """Signal d'abusivité porté par le thème et par la combinaison (validation LODO).

    `unfair` est la référence CLAUDETTE : elle n'est JAMAIS projetée — c'est la cible."""
    labelled = [(r, bool(unfair.get((r["document"], r["index"])))) for r in rows]
    if not labelled:
        return {}
    base = sum(1 for _, y in labelled if y) / len(labelled)

    def lodo(key_of):
        stats: dict = defaultdict(lambda: [0, 0])
        per_doc: dict = defaultdict(lambda: defaultdict(lambda: [0, 0]))
        for r, y in labelled:
            key = key_of(r)
            stats[key][0] += 1
            stats[key][1] += int(y)
            per_doc[r["document"]][key][0] += 1
            per_doc[r["document"]][key][1] += int(y)
        scored = []
        for r, y in labelled:
            key = key_of(r)
            n = stats[key][0] - per_doc[r["document"]][key][0]
            pos = stats[key][1] - per_doc[r["document"]][key][1]
            scored.append(((pos + base) / (n + 1), y))
        return average_precision(scored)

    per_class = defaultdict(lambda: [0, 0])
    for r, y in labelled:
        per_class[r["primary"]][0] += 1
        per_class[r["primary"]][1] += int(y)

    return {
        "n": len(labelled),
        "base_rate": round(base, 4),
        "mi_primary": round(mutual_information([(r["primary"], y) for r, y in labelled]), 4),
        "mi_combo": round(
            mutual_information([(frozenset(r["themes"]), y) for r, y in labelled]), 4
        ),
        "ap_primary": round(lodo(lambda r: r["primary"]), 4),
        "ap_combo": round(lodo(lambda r: frozenset(r["themes"])), 4),
        "lift_by_class": {
            code: round((v[1] / v[0]) / base, 2)
            for code, v in sorted(per_class.items(), key=lambda kv: -kv[1][1])
            if v[0] >= 20
        },
    }


def gold_block(root: Path, taxonomy: str, population: str | None, unfair: dict) -> dict:
    """Le GOLD projeté : distribution, cascade, et signal d'abusivité de la décision."""
    rows = tx.filter_population(load_gold(root, taxonomy=taxonomy), population)
    if not rows:
        return {}
    decided = [r for r in rows if r.get("decided")]
    as_sentences = [
        {"document": r["document"], "index": r["index"],
         "primary": r["decided_primary"] or r["proposed_primary"],
         "themes": [r["decided_primary"] or r["proposed_primary"],
                    *(r["decided_secondaries"] or r["proposed_secondaries"] or [])]}
        for r in rows
        if (r["decided_primary"] or r["proposed_primary"])
    ]
    return {
        "n_sentences": len(rows),
        "n_decided": len(decided),
        "auto_levels": dict(Counter(r.get("auto_level") for r in rows)),
        "agreement_classes": dict(Counter(r.get("agreement_class") for r in rows)),
        "distribution": dict(Counter(
            r["decided_primary"] or r["proposed_primary"] for r in rows
            if (r["decided_primary"] or r["proposed_primary"])
        ).most_common()),
        "multilabel_rate": round(
            sum(1 for s in as_sentences if len(s["themes"]) > 1) / len(as_sentences), 4
        ) if as_sentences else None,
        "unfairness": unfairness_block(as_sentences, unfair),
    }


# ── Pilote ──────────────────────────────────────────────────────────────────
def main(root: Path, out_path: Path) -> dict:
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    unfair = unfair_index(root)

    results: dict = {
        "provenance": {
            "dataset_fingerprint": manifest.get("fingerprint"),
            "dataset_documents": manifest.get("nDocuments"),
            "dataset_sentences": manifest.get("nSentences"),
            "taxonomy_spec_version": tx.load_spec()["specVersion"],
            "taxonomy_spec_fingerprint": tx.spec_fingerprint(),
            "n_resamples": N_RESAMPLES,
            "seed": SEED,
        },
        "cells": [],
    }

    for population_label, population in POPULATIONS:
        for taxonomy in TAXONOMIES:
            by_sentence = votes_by_sentence(root, taxonomy, population)
            rows = sentences_rows(root, taxonomy, population)
            cell = {
                "taxonomy": taxonomy,
                "population": population_label,
                "n_classes": len(tx.category_codes(taxonomy)),
                # 1. Annotations BRUTES (accord entre annotateurs)
                "raw": agreement_block(by_sentence),
                # 2. CONSENSUS (distribution et signal d'abusivité)
                "consensus": {
                    "n": len(rows),
                    "supports": dict(Counter(r["primary"] for r in rows).most_common()),
                    "multilabel_rate": round(
                        sum(1 for r in rows if len(r["themes"]) > 1) / len(rows), 4
                    ) if rows else None,
                    "unfairness": unfairness_block(rows, unfair),
                },
                # 3. GOLD (décision arbitrée/auto-résolue)
                "gold": gold_block(root, taxonomy, population, unfair),
            }
            if taxonomy != "T20":
                cell["vs_canonical"] = paired_delta_vs_canonical(root, population, taxonomy)
            results["cells"].append(cell)
            raw = cell["raw"]
            print(
                f"[{population_label:10s}] {taxonomy}  "
                f"α-MASI {raw.get('alpha_masi')}  α nom {raw.get('alpha_nominal')}  "
                f"désaccords {raw.get('disagreement_rate')}  "
                f"AP combo {cell['consensus']['unfairness'].get('ap_combo')}"
                + (f"  Δ vs T20 {cell['vs_canonical']['delta']} "
                   f"{cell['vs_canonical']['ci']}" if taxonomy != "T20" else "")
            )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nÉcrit : {out_path}")
    return results


if __name__ == "__main__":
    dataset = Path(sys.argv[1])
    output = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("taxonomy_matrix.json")
    main(dataset, output)

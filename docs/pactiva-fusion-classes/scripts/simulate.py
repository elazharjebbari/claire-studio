"""Simulation des schémas de fusion de classes — effets mesurés SANS entraînement.

Pour chaque schéma (T20 statu quo, T14 fiabilité, T10 fonctionnel, T11 variante) :
  1. α-MASI et α nominal (primaire) + IC bootstrap par document, sur les votes remappés ;
  2. résorption des désaccords primaires (paires d'annotateurs) ;
  3. profil de supports (min, ratio de déséquilibre, entropie, classes < 300) ;
  4. préservation du signal d'abusivité : MI(thème;abusif), MI(combo;abusif),
     average precision leave-one-document-out de P(abusif|thème) et P(abusif|combo) ;
  5. accord humain↔juge (exactitude primaire) sous le schéma.
"""
from __future__ import annotations

import json
import math
import sys
from collections import Counter, defaultdict
from itertools import combinations
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "research"))

from pactiva_lab.evaluation.agreement import (  # noqa: E402
    alpha_set_ci,
    gwet_ac1_binary,
    krippendorff_alpha_set,
    masi_distance,
    nominal_set_distance,
)

BASE = Path(sys.argv[1])  # dossier d'export du Lab (manifest.json, votes.jsonl, ...)


def load_jsonl(name):
    return [json.loads(line) for line in (BASE / name).read_text().splitlines() if line.strip()]


sentences = load_jsonl("sentences.jsonl")
votes = load_jsonl("votes.jsonl")
reference = load_jsonl("reference.jsonl")
judges = load_jsonl("judges.jsonl")

from schemes import SCHEMES, remap, remap_set  # noqa: E402


# ---------------------------------------------------------------- préparation
by_sentence = defaultdict(list)
for r in votes:
    s = frozenset([r["primary"], *r["secondaries"]])
    by_sentence[(r["document"], r["index"])].append((r["annotator"], r["primary"], s))

ref_index = defaultdict(set)
for r in reference:
    ref_index[(r["document"], r["index"])].add(r["category"])

judge_index = defaultdict(dict)
for r in judges:
    judge_index[(r["document"], r["index"])][r["judge"]] = r["theme"]


def average_precision(scored):
    """AP (average precision) — scored = [(score, is_positive)], sans sklearn."""
    scored = sorted(scored, key=lambda x: -x[0])
    n_pos = sum(1 for _, y in scored if y)
    if n_pos == 0:
        return None
    tp, ap = 0, 0.0
    for i, (_, y) in enumerate(scored, start=1):
        if y:
            tp += 1
            ap += tp / i
    return ap / n_pos


def lodo_ap(key_fn, mapping):
    """AP leave-one-document-out de P(abusif | clé), clé = thème primaire ou combo."""
    rows = [
        (
            r["document"],
            key_fn(r, mapping),
            bool(ref_index.get((r["document"], r["index"]))),
        )
        for r in sentences
    ]
    stats = defaultdict(lambda: [0, 0])   # clé -> [n, n_pos] global
    per_doc = defaultdict(lambda: defaultdict(lambda: [0, 0]))
    for doc, key, y in rows:
        stats[key][0] += 1
        stats[key][1] += int(y)
        per_doc[doc][key][0] += 1
        per_doc[doc][key][1] += int(y)
    global_rate = sum(v[1] for v in stats.values()) / sum(v[0] for v in stats.values())
    scored = []
    for doc, key, y in rows:
        n = stats[key][0] - per_doc[doc][key][0]
        pos = stats[key][1] - per_doc[doc][key][1]
        # lissage de Laplace vers le taux de base (clé inédite hors document -> base)
        p = (pos + global_rate) / (n + 1)
        scored.append((p, y))
    return average_precision(scored), global_rate


def mutual_information(pairs):
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


results = {}
for name, mapping in SCHEMES.items():
    units_by_doc_sets = defaultdict(list)
    units_by_doc_prim = defaultdict(list)
    agree = 0
    disagree = 0
    all_units = []  # toutes les unités multi-annotées (jeux remappés)
    for (doc, idx), items in sorted(by_sentence.items()):
        if len(items) < 2:
            continue
        sets = [remap_set(s, mapping) for _, _, s in items]
        prims = [remap(p, mapping) for _, p, _ in items]
        units_by_doc_sets[doc].append(sets)
        units_by_doc_prim[doc].append([frozenset([p]) for p in prims])
        all_units.append(sets)
        for p1, p2 in combinations(prims, 2):
            if p1 == p2:
                agree += 1
            else:
                disagree += 1
    # α binaire un-contre-tous par classe, sur TOUTES les unités (y compris
    # les accords sur « absent ») — même définition que dans explore.py.
    all_classes = sorted({c for unit in all_units for s in unit for c in s})
    per_class_bin = {
        t: [[t in s for s in unit] for unit in all_units] for t in all_classes
    }

    ci_masi = alpha_set_ci(
        units_by_doc_sets, distance=masi_distance, n_resamples=1000,
        seed=42, tag=f"fusion-{name}-masi",
    )
    ci_nominal = alpha_set_ci(
        units_by_doc_prim, distance=nominal_set_distance, n_resamples=1000,
        seed=42, tag=f"fusion-{name}-nominal",
    )

    per_class = {}
    for t, units in per_class_bin.items():
        d_units = [
            [frozenset(["1"]) if b else frozenset(["0"]) for b in u]
            for u in units if len(u) >= 2
        ]
        a = krippendorff_alpha_set(d_units, distance=nominal_set_distance)
        ac1 = gwet_ac1_binary([u for u in units if len(u) >= 2])
        per_class[t] = {
            "alpha": round(a, 4) if a is not None else None,
            "ac1": round(ac1, 4) if ac1 is not None else None,
        }

    # supports agrégés sous le schéma
    prim = Counter(remap(r["primary"], mapping) for r in sentences)
    n = sum(prim.values())
    shares = sorted((v / n for v in prim.values()), reverse=True)
    ent = -sum(p * math.log(p) for p in shares if p > 0) / math.log(len(prim))

    # multi-label (votes) sous le schéma
    n_multi = sum(
        1 for r in votes
        if len(remap_set(frozenset([r["primary"], *r["secondaries"]]), mapping)) > 1
    )

    # abusivité
    mi_prim = mutual_information(
        [(remap(r["primary"], mapping), bool(ref_index.get((r["document"], r["index"]))))
         for r in sentences]
    )
    mi_combo = mutual_information(
        [(remap_set(frozenset(r["themes"]), mapping),
          bool(ref_index.get((r["document"], r["index"]))))
         for r in sentences]
    )
    ap_prim, base = lodo_ap(lambda r, m: remap(r["primary"], m), mapping)
    ap_combo, _ = lodo_ap(lambda r, m: remap_set(frozenset(r["themes"]), m), mapping)

    # accord humain↔juge (exactitude primaire agrégée)
    jh_total, jh_agree = 0, 0
    for r in sentences:
        for judge, jt in judge_index.get((r["document"], r["index"]), {}).items():
            jh_total += 1
            if remap(r["primary"], mapping) == remap(jt, mapping):
                jh_agree += 1

    results[name] = {
        "n_classes": len(prim),
        "alpha_masi": ci_masi,
        "alpha_nominal_primary": ci_nominal,
        "disagree_pairs": disagree,
        "agree_pairs": agree,
        "disagree_rate": round(disagree / (agree + disagree), 4),
        "per_class_alpha": {
            t: per_class[t] for t in sorted(per_class, key=lambda t: per_class[t]["alpha"] or 0)
        },
        "min_alpha_class": min(
            ((t, v["alpha"]) for t, v in per_class.items() if v["alpha"] is not None),
            key=lambda kv: kv[1],
        ),
        "supports": dict(prim.most_common()),
        "min_support": min(prim.values()),
        "imbalance_ratio": round(max(prim.values()) / min(prim.values()), 1),
        "entropy_normalized": round(ent, 4),
        "classes_under_300": sorted(t for t, c in prim.items() if c < 300),
        "multi_label_rate_votes": round(n_multi / len(votes), 4),
        "mi_primary_unfair": round(mi_prim, 4),
        "mi_combo_unfair": round(mi_combo, 4),
        "ap_lodo_primary": round(ap_prim, 4),
        "ap_lodo_combo": round(ap_combo, 4),
        "base_rate": round(base, 4),
        "judge_human_primary_acc": round(jh_agree / jh_total, 4),
    }
    print(f"[{name}] classes={len(prim)} α-MASI={ci_masi['point']} "
          f"[{ci_masi['low']};{ci_masi['high']}] désaccord={results[name]['disagree_rate']} "
          f"AP_combo={results[name]['ap_lodo_combo']}")

(Path(__file__).parent / "resultats" / "simulate_results.json").write_text(
    json.dumps(results, indent=1, ensure_ascii=False)
)
print("OK -> simulate_results.json")

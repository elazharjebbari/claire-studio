"""Exploration statistique pour l'analyse de fusion de classes.

Lit l'export daté 89622b95 (50 docs soumis, prod 24/08) et produit un JSON de
statistiques factuelles : supports, déséquilibre, co-occurrences, confusions
inter-annotateurs, accords par thème, lien thème→abusivité CLAUDETTE.
Lecture seule — aucune écriture hors du JSON de sortie.
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
    gwet_ac1_binary,
    krippendorff_alpha_set,
    masi_distance,
    nominal_set_distance,
)

BASE = Path(sys.argv[1])  # dossier d'export du Lab (manifest.json, votes.jsonl, ...)


def load_jsonl(name):
    return [json.loads(line) for line in (BASE / name).read_text().splitlines() if line.strip()]


manifest = json.loads((BASE / "manifest.json").read_text())
sentences = load_jsonl("sentences.jsonl")
votes = load_jsonl("votes.jsonl")
reference = load_jsonl("reference.jsonl")
judges = load_jsonl("judges.jsonl")

out: dict = {"fingerprint": manifest["fingerprint"], "criteria": manifest["criteria"]}

# ---------------------------------------------------------------- A. supports
prim_agg = Counter(r["primary"] for r in sentences)
all_agg = Counter(t for r in sentences for t in r["themes"])
prim_votes = Counter(r["primary"] for r in votes)
all_votes = Counter(t for r in votes for t in [r["primary"], *r["secondaries"]])

n = sum(prim_agg.values())
shares = {k: v / n for k, v in prim_agg.items()}
sorted_share = sorted(shares.values(), reverse=True)
entropy = -sum(p * math.log(p) for p in sorted_share if p > 0)
k_themes = len(prim_agg)
vals = sorted(prim_agg.values())
gini = sum((2 * (i + 1) - len(vals) - 1) * v for i, v in enumerate(vals)) / (
    len(vals) * sum(vals)
)

out["supports"] = {
    "n_sentences": n,
    "n_documents": manifest["nDocuments"],
    "n_votes": len(votes),
    "primary_aggregated": dict(prim_agg.most_common()),
    "all_aggregated": dict(all_agg.most_common()),
    "primary_votes": dict(prim_votes.most_common()),
    "all_votes": dict(all_votes.most_common()),
    "imbalance_ratio": max(prim_agg.values()) / max(1, min(prim_agg.values())),
    "entropy_normalized": entropy / math.log(k_themes),
    "gini": gini,
    "top5_share": sum(sorted_share[:5]),
    "themes_under_50": [t for t, c in prim_agg.items() if c < 50],
    "themes_under_100": [t for t, c in prim_agg.items() if c < 100],
    "themes_under_300": [t for t, c in prim_agg.items() if c < 300],
    "multi_label_rate_agg": manifest["multiLabelRate"],
}

card_votes = Counter(1 + len(r["secondaries"]) for r in votes)
out["supports"]["cardinality_votes"] = dict(sorted(card_votes.items()))
out["supports"]["multi_label_rate_votes"] = 1 - card_votes[1] / len(votes)

# Segments (jeux de thèmes contigus) sur l'agrégé + combos
segments = []
for r in sentences:
    if r["boundary"]:
        segments.append(frozenset(r["themes"]))
combo = Counter(segments)
out["segments"] = {
    "n_segments": len(segments),
    "n_combos": len(combo),
    "hapax": sum(1 for c in combo.values() if c == 1),
    "top_combos": [[sorted(k), v] for k, v in combo.most_common(15)],
}

# ------------------------------------------------- B. multi-annoté / confusions
by_sentence: dict = defaultdict(list)  # (doc, idx) -> [(annotator, primary, set)]
for r in votes:
    s = frozenset([r["primary"], *r["secondaries"]])
    by_sentence[(r["document"], r["index"])].append((r["annotator"], r["primary"], s))

docs_by_count = Counter()
doc_annotators = defaultdict(set)
for r in votes:
    doc_annotators[r["document"]].add(r["annotator"])
for d, anns in doc_annotators.items():
    docs_by_count[len(anns)] += 1
out["coverage"] = {
    "docs_by_n_annotators": dict(sorted(docs_by_count.items())),
    "votes_by_annotator": dict(Counter(r["annotator"] for r in votes).most_common()),
}

conf = Counter()          # paires primaires non ordonnées, désaccord
agree_diag = Counter()    # accords primaires par thème
partial_sets = Counter()  # paires où les jeux se chevauchent sans être égaux
multi_units = []          # unités multi-annotées (jeux) pour alpha
multi_units_prim = []     # unités primaires (singletons)
units_by_doc = defaultdict(list)
for (doc, idx), items in by_sentence.items():
    if len(items) < 2:
        continue
    sets = [s for _, _, s in items]
    prims = [p for _, p, _ in items]
    multi_units.append(sets)
    multi_units_prim.append([frozenset([p]) for p in prims])
    units_by_doc[doc].append(sets)
    for (a1, p1, s1), (a2, p2, s2) in combinations(items, 2):
        if p1 == p2:
            agree_diag[p1] += 1
        else:
            conf[frozenset([p1, p2])] += 1
        if s1 != s2 and s1 & s2:
            partial_sets[frozenset([p1, p2])] += 1

n_multi_sent = len(multi_units)
out["confusion"] = {
    "n_multi_annotated_sentences": n_multi_sent,
    "n_multi_annotated_docs": len(units_by_doc),
    "agree_pairs_by_theme": dict(agree_diag.most_common()),
    "disagree_pairs": [[sorted(k), v] for k, v in conf.most_common(60)],
    "partial_overlap_pairs": [[sorted(k), v] for k, v in partial_sets.most_common(30)],
    "total_pairs": sum(agree_diag.values()) + sum(conf.values()),
    "total_disagree": sum(conf.values()),
}

# Confusabilité normalisée : C(i,j) = D(i,j) / (A(i)+A(j)+D(i,j))
# où D = paires en désaccord {i,j}, A(t) = paires en accord sur t.
confusability = {}
for pair, d in conf.items():
    ts = sorted(pair)
    if len(ts) != 2:
        continue
    i, j = ts
    denom = agree_diag.get(i, 0) + agree_diag.get(j, 0) + d
    confusability[f"{i}|{j}"] = {"disagree": d, "index": d / denom if denom else None}
out["confusion"]["confusability_index"] = dict(
    sorted(confusability.items(), key=lambda kv: -(kv[1]["index"] or 0))[:40]
)

# α global (point) MASI + nominal (primaire)
out["alpha"] = {
    "alpha_masi_sets": krippendorff_alpha_set(multi_units, distance=masi_distance),
    "alpha_nominal_primary": krippendorff_alpha_set(
        multi_units_prim, distance=nominal_set_distance
    ),
}

# Par thème : α binaire un-contre-tous (présence dans le jeu) + AC1 + support
per_theme = {}
themes_all = sorted(all_votes)
for t in themes_all:
    units_bin = [[t in s for s in unit] for unit in multi_units]
    units_bin = [u for u in units_bin if len(u) >= 2]
    d_units = [
        [frozenset(["1"]) if b else frozenset(["0"]) for b in u] for u in units_bin
    ]
    alpha_t = krippendorff_alpha_set(d_units, distance=nominal_set_distance)
    ac1_t = gwet_ac1_binary(units_bin)
    support_multi = sum(1 for unit in multi_units if any(t in s for s in unit))
    per_theme[t] = {
        "alpha_binary": round(alpha_t, 4) if alpha_t is not None else None,
        "gwet_ac1": round(ac1_t, 4) if ac1_t is not None else None,
        "support_multi_sentences": support_multi,
        "support_votes": all_votes.get(t, 0),
        "support_agg_primary": prim_agg.get(t, 0),
    }
out["per_theme"] = per_theme

# ------------------------------------------------------------- C. juges
judge_index = defaultdict(dict)  # (doc, idx) -> {judge: theme}
for r in judges:
    judge_index[(r["document"], r["index"])][r["judge"]] = r["theme"]

hj_conf = Counter()  # (humain_agg_primary, judge_theme)
for r in sentences:
    key = (r["document"], r["index"])
    for judge, jt in judge_index.get(key, {}).items():
        hj_conf[(r["primary"], jt)] += 1
out["judge_confusion"] = {
    "pairs": [[h, j, c] for (h, j), c in hj_conf.most_common(80)],
    "n": sum(hj_conf.values()),
}

# ------------------------------------------------------------- D. CLAUDETTE
ref_index = defaultdict(set)
for r in reference:
    ref_index[(r["document"], r["index"])].add(r["category"])

theme_unfair = defaultdict(lambda: [0, 0])   # theme -> [n, n_unfair]
theme_cat = Counter()                          # (theme, cat)
for r in sentences:
    key = (r["document"], r["index"])
    cats = ref_index.get(key, set())
    for t in set(r["themes"]):
        theme_unfair[t][0] += 1
        if cats:
            theme_unfair[t][1] += 1
        for c in cats:
            theme_cat[(t, c)] += 1

n_unfair_total = sum(1 for r in sentences if ref_index.get((r["document"], r["index"])))
base_rate = n_unfair_total / n
out["claudette"] = {
    "n_unfair_sentences": n_unfair_total,
    "base_rate": base_rate,
    "per_theme": {
        t: {
            "n": v[0],
            "n_unfair": v[1],
            "p_unfair": round(v[1] / v[0], 4) if v[0] else None,
            "lift": round((v[1] / v[0]) / base_rate, 2) if v[0] else None,
        }
        for t, v in sorted(theme_unfair.items(), key=lambda kv: -kv[1][1])
    },
    "theme_x_category": [
        [t, c, v] for (t, c), v in theme_cat.most_common(60)
    ],
}

# Information mutuelle I(thème_primaire ; abusif) — signal d'abusivité porté par le thème
def mutual_information(pairs):
    joint = Counter(pairs)
    total = sum(joint.values())
    px = Counter()
    py = Counter()
    for (x, y), c in joint.items():
        px[x] += c
        py[y] += c
    mi = 0.0
    for (x, y), c in joint.items():
        p = c / total
        mi += p * math.log(p / ((px[x] / total) * (py[y] / total)))
    return mi


pairs_theme = [
    (r["primary"], bool(ref_index.get((r["document"], r["index"])))) for r in sentences
]
pairs_combo = [
    (frozenset(r["themes"]), bool(ref_index.get((r["document"], r["index"]))))
    for r in sentences
]
h_unfair = -(base_rate * math.log(base_rate) + (1 - base_rate) * math.log(1 - base_rate))
out["claudette"]["mi_primary_unfair"] = mutual_information(pairs_theme)
out["claudette"]["mi_combo_unfair"] = mutual_information(pairs_combo)
out["claudette"]["h_unfair"] = h_unfair

(Path(__file__).parent / "resultats" / "explore_stats.json").write_text(
    json.dumps(out, indent=1, ensure_ascii=False)
)
print("OK ->", Path(__file__).parent / "resultats" / "explore_stats.json")
print("sentences:", n, "docs:", manifest["nDocuments"], "votes:", len(votes))
print("multi-annotated sentences:", n_multi_sent, "docs:", len(units_by_doc))
print("alpha_masi:", out["alpha"]["alpha_masi_sets"])
print("alpha_nominal_primary:", out["alpha"]["alpha_nominal_primary"])

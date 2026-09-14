#!/usr/bin/env python3
"""Profilage reproductible de l'export CLAUDETTE + couche thématique (Data Understanding).

Entrée  : data/processed/{sentences,reference,votes,judges,gold}.jsonl + labels.json, manifest.json,
          splits.json (export Lab `7116e627…`, 50 ToS, 9 414 phrases).
Sortie  : data/profiling/*.csv|json + docs/DATA_PROFILE.md (tableaux régénérés à chaque exécution).

Bibliothèque standard uniquement (aucune dépendance), pour que le profil soit rejouable hors
de la plateforme. Les coefficients d'accord (α de Krippendorff nominal / MASI par paires,
κ de Cohen) sont réimplémentés ici en quelques lignes ; leur parité avec `pactiva_lab`
est vérifiée dans tests/test_profiling_parity.py.

Usage : python src/profiling/profile_dataset.py [--root legal-kg] [--taxonomy-spec path]
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import statistics
from collections import Counter, defaultdict
from itertools import combinations
from pathlib import Path

# ----------------------------------------------------------------------------- utilitaires

def read_jsonl(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as fh:
        return [json.loads(line) for line in fh if line.strip()]


def write_csv(path: Path, rows: list[dict], fields: list[str] | None = None) -> None:
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    fields = fields or list(rows[0].keys())
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in fields})


def write_json(path: Path, obj) -> None:
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=1, sort_keys=False), encoding="utf-8")


def r4(x):
    return None if x is None else round(x, 4)


# ----------------------------------------------------------------------------- accord

def masi(a: frozenset, b: frozenset) -> float:
    """Distance MASI (Passonneau 2006) : 1 − J·M, M ∈ {1, 2/3, 1/3, 0}."""
    if not a and not b:
        return 0.0
    inter, union = len(a & b), len(a | b)
    if union == 0:
        return 0.0
    j = inter / union
    if a == b:
        m = 1.0
    elif a < b or b < a:
        m = 2 / 3
    elif inter:
        m = 1 / 3
    else:
        m = 0.0
    return 1.0 - j * m


def nominal(a, b) -> float:
    return 0.0 if a == b else 1.0


def alpha_pairwise(units: list[list], distance) -> float | None:
    """α de Krippendorff en forme par paires : 1 − Do/De, Do = distance moyenne intra-unité,
    De = distance moyenne sur toutes les paires de jugements (toutes unités confondues)."""
    items = [u for u in units if len(u) >= 2]
    if not items:
        return None
    obs = [distance(x, y) for u in items for x, y in combinations(u, 2)]
    if not obs:
        return None
    d_o = sum(obs) / len(obs)
    # De : regrouper les jugements identiques pour rester O(k²) sur les valeurs distinctes
    counts = Counter(v for u in items for v in u)
    values = list(counts)
    total = sum(counts.values())
    exp_sum = 0.0
    for i, x in enumerate(values):
        cx = counts[x]
        exp_sum += cx * (cx - 1) * distance(x, x)  # 0 par construction, gardé pour lisibilité
        for y in values[i + 1:]:
            exp_sum += 2 * cx * counts[y] * distance(x, y)
    pairs = total * (total - 1)
    if pairs == 0:
        return None
    d_e = exp_sum / pairs
    if d_e == 0:
        return 1.0
    return 1.0 - d_o / d_e


def cohen_kappa(a: list, b: list) -> float | None:
    n = len(a)
    if n == 0:
        return None
    po = sum(1 for x, y in zip(a, b) if x == y) / n
    ca, cb = Counter(a), Counter(b)
    pe = sum((ca[c] / n) * (cb[c] / n) for c in set(ca) | set(cb))
    if pe >= 1.0:
        return 1.0 if po >= 1.0 else 0.0
    return (po - pe) / (1 - pe)


def entropy(counter: Counter) -> float:
    n = sum(counter.values())
    return -sum((c / n) * math.log2(c / n) for c in counter.values() if c) if n else 0.0


# ----------------------------------------------------------------------------- profil

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=str(Path(__file__).resolve().parents[2]))
    ap.add_argument("--taxonomy-spec", default=None,
                    help="frontend/src/lib/taxonomy/taxonomies.json (populations conception/validation)")
    args = ap.parse_args()
    root = Path(args.root)
    dp = root / "data" / "processed"
    out = root / "data" / "profiling"
    out.mkdir(parents=True, exist_ok=True)

    sentences = read_jsonl(dp / "sentences.jsonl")
    reference = read_jsonl(dp / "reference.jsonl")
    votes = read_jsonl(dp / "votes.jsonl")
    judges = read_jsonl(dp / "judges.jsonl")
    gold = read_jsonl(dp / "gold.jsonl")
    manifest = json.loads((dp / "manifest.json").read_text(encoding="utf-8"))
    labels = json.loads((dp / "labels.json").read_text(encoding="utf-8"))

    populations = {}
    spec_path = Path(args.taxonomy_spec) if args.taxonomy_spec else root.parent / "frontend/src/lib/taxonomy/taxonomies.json"
    if spec_path.exists():
        spec = json.loads(spec_path.read_text(encoding="utf-8"))
        populations = {k: set(v["documents"]) for k, v in spec.get("populations", {}).items()}

    themes = [l["code"] for l in labels]
    key = lambda r: (r["document"], r["index"])
    by_key = {key(s): s for s in sentences}
    docs = sorted({s["document"] for s in sentences})

    # ---- 1. vue d'ensemble -------------------------------------------------------------
    n_tokens = [len(s["text"].split()) for s in sentences]
    ref_by_key: dict[tuple, set] = defaultdict(set)
    for r in reference:
        ref_by_key[key(r)].add(r["category"])
    unfair_keys = set(ref_by_key)
    overview = {
        "fingerprint_manifest": manifest.get("fingerprint") or manifest.get("criteria"),
        "n_documents": len(docs), "n_sentences": len(sentences),
        "n_annotations": manifest.get("nAnnotations"), "n_votes": len(votes),
        "n_judge_predictions": len(judges), "n_reference_labels": len(reference),
        "n_unfair_sentences": len(unfair_keys), "base_rate_unfair": r4(len(unfair_keys) / len(sentences)),
        "sentence_tokens": {"min": min(n_tokens), "median": statistics.median(n_tokens),
                            "mean": r4(statistics.mean(n_tokens)), "p90": sorted(n_tokens)[int(0.9 * len(n_tokens))],
                            "max": max(n_tokens)},
        "multi_label_rate_consensus": r4(sum(1 for s in sentences if len(s.get("themes", [])) > 1) / len(sentences)),
        "populations": {k: len(v) for k, v in populations.items()},
        "severity_levels_present": sorted({r.get("level") for r in reference}),
    }
    sev_path = root / "data" / "annotations" / "claudette_severity.jsonl"
    if sev_path.exists():
        sev = read_jsonl(sev_path)
        by_cat = defaultdict(Counter)
        for r in sev:
            if r.get("in_reference"):
                by_cat[r["category"]][r["level"]] += 1
        overview["severity_reimported"] = {"coverage_of_reference": r4(sum(1 for r in sev if r.get("in_reference")) / len(reference)),
                                           "by_category": {c: dict(sorted(v.items())) for c, v in sorted(by_cat.items())},
                                           "source": "data/claudette_tos/OriginalTaggedDocuments (src/graph/import_claudette_original.py)"}

    # ---- 2. documents ----------------------------------------------------------------
    cats = sorted({r["category"] for r in reference})
    doc_rows = []
    for d in docs:
        ss = [s for s in sentences if s["document"] == d]
        keys_d = {key(s) for s in ss}
        unf = [k for k in keys_d if k in unfair_keys]
        row = {"document": d, "population": next((p for p, v in populations.items() if d in v and p != "all"), ""),
               "n_sentences": len(ss),
               "n_clauses": sum(1 for s in ss if s.get("boundary")),
               "n_unfair_sentences": len(unf), "unfair_rate": r4(len(unf) / len(ss)),
               "median_tokens": statistics.median(len(s["text"].split()) for s in ss),
               "n_themes_used": len({s["primary"] for s in ss}),
               "dominant_theme": Counter(s["primary"] for s in ss).most_common(1)[0][0]}
        for c in cats:
            row[f"cat_{c}"] = sum(1 for k in unf if c in ref_by_key[k])
        doc_rows.append(row)
    write_csv(out / "documents.csv", doc_rows)

    # ---- 3. thèmes : supports, strates, fiabilité binaire ---------------------------------
    votes_by_key: dict[tuple, list[dict]] = defaultdict(list)
    for v in votes:
        votes_by_key[key(v)].append(v)
    annotators = sorted({v["annotator"] for v in votes})

    theme_rows = []
    base = len(unfair_keys) / len(sentences)
    for t in themes:
        prim = [s for s in sentences if s["primary"] == t]
        alls = [s for s in sentences if t in s.get("themes", [])]
        n_docs = len({s["document"] for s in alls})
        unf = sum(1 for s in alls if key(s) in unfair_keys)
        p_unf = unf / len(alls) if alls else 0.0
        # α binaire (présence du thème dans le jeu de chaque annotateur), unités = phrases multi-annotées
        units = []
        for k, vs in votes_by_key.items():
            if len(vs) >= 2:
                units.append([1 if (v["primary"] == t or t in v.get("secondaries", [])) else 0 for v in vs])
        a_bin = alpha_pairwise(units, nominal)
        cat_counter = Counter(c for s in alls for c in ref_by_key.get(key(s), ()))
        theme_rows.append({"theme": t, "support_primary": len(prim), "support_any": len(alls),
                           "support_votes": sum(1 for v in votes if v["primary"] == t or t in v.get("secondaries", [])),
                           "n_documents": n_docs, "unfair_sentences": unf, "p_unfair": r4(p_unf),
                           "lift": r4(p_unf / base) if base else None,
                           "stratum": "high" if base and p_unf / base >= 3 else ("low" if base and p_unf / base <= 1 else "mid"),
                           "alpha_binary": r4(a_bin),
                           "top_categories": ";".join(f"{c}:{n}" for c, n in cat_counter.most_common(3))})
    write_csv(out / "themes.csv", theme_rows)

    # ---- 4. catégories CLAUDETTE --------------------------------------------------------
    cat_rows = []
    for c in cats:
        ks = [k for k, cs in ref_by_key.items() if c in cs]
        theme_counter = Counter(by_key[k]["primary"] for k in ks if k in by_key)
        cat_rows.append({"category": c, "n_sentences": len(ks), "n_documents": len({k[0] for k in ks}),
                         "share_of_labels": r4(len(ks) / len(reference)),
                         "top_themes": ";".join(f"{t}:{n}" for t, n in theme_counter.most_common(4)),
                         "concentration_top1": r4(theme_counter.most_common(1)[0][1] / len(ks)) if ks else None})
    write_csv(out / "categories.csv", cat_rows)

    # multi-catégories par phrase
    multi_cat = Counter(len(cs) for cs in ref_by_key.values())
    cat_pairs = Counter(tuple(sorted(p)) for cs in ref_by_key.values() if len(cs) > 1 for p in combinations(sorted(cs), 2))

    # ---- 5. thème × catégorie -----------------------------------------------------------
    tx = []
    for t in themes:
        row = {"theme": t}
        for c in cats:
            row[c] = sum(1 for s in sentences if s["primary"] == t and c in ref_by_key.get(key(s), ()))
        tx.append(row)
    write_csv(out / "theme_x_category.csv", tx, ["theme", *cats])

    # ---- 6. co-occurrences de thèmes (votes bruts, primaire + secondaires) ------------------
    co = Counter()
    for v in votes:
        ts = sorted({v["primary"], *v.get("secondaries", [])})
        for a, b in combinations(ts, 2):
            co[(a, b)] += 1
    co_rows = [{"theme_a": a, "theme_b": b, "n_votes": n} for (a, b), n in co.most_common(40)]
    write_csv(out / "theme_cooccurrence.csv", co_rows)

    # ---- 7. annotateurs : confusion, accord, style -----------------------------------------
    pair_stats = {}
    confusion = Counter()
    for k, vs in votes_by_key.items():
        prim = {v["annotator"]: v["primary"] for v in vs}
        for a, b in combinations(sorted(prim), 2):
            pair_stats.setdefault((a, b), {"agree": 0, "n": 0, "ya": [], "yb": []})
            ps = pair_stats[(a, b)]
            ps["n"] += 1
            ps["ya"].append(prim[a]); ps["yb"].append(prim[b])
            if prim[a] == prim[b]:
                ps["agree"] += 1
            else:
                confusion[tuple(sorted((prim[a], prim[b])))] += 1
    pair_rows = [{"annotator_a": a, "annotator_b": b, "n_sentences": ps["n"],
                  "raw_agreement": r4(ps["agree"] / ps["n"]), "kappa": r4(cohen_kappa(ps["ya"], ps["yb"]))}
                 for (a, b), ps in sorted(pair_stats.items())]
    write_csv(out / "annotator_pairs.csv", pair_rows)
    conf_rows = [{"theme_a": a, "theme_b": b, "n_disagreements": n} for (a, b), n in confusion.most_common(40)]
    write_csv(out / "annotator_confusion.csv", conf_rows)

    style_rows = []
    for a in annotators:
        va = [v for v in votes if v["annotator"] == a]
        style_rows.append({"annotator": a, "n_votes": len(va),
                           "multi_label_rate": r4(sum(1 for v in va if v.get("secondaries")) / len(va)),
                           "n_secondary_labels": sum(len(v.get("secondaries", [])) for v in va),
                           "entropy_primary_bits": r4(entropy(Counter(v["primary"] for v in va))),
                           "top_theme": Counter(v["primary"] for v in va).most_common(1)[0][0]})
    write_csv(out / "annotator_style.csv", style_rows)

    units_sets = [[frozenset({v["primary"], *v.get("secondaries", [])}) for v in vs] for vs in votes_by_key.values() if len(vs) >= 2]
    units_prim = [[v["primary"] for v in vs] for vs in votes_by_key.values() if len(vs) >= 2]
    alpha_masi = alpha_pairwise(units_sets, masi)
    alpha_nom = alpha_pairwise(units_prim, nominal)
    # α par document (distribution)
    per_doc_alpha = []
    for d in docs:
        u = [[v["primary"] for v in vs] for k, vs in votes_by_key.items() if k[0] == d and len(vs) >= 2]
        a = alpha_pairwise(u, nominal)
        per_doc_alpha.append({"document": d, "alpha_nominal_primary": r4(a)})
    write_csv(out / "agreement_by_document.csv", per_doc_alpha)
    agreement = {"alpha_masi_sets": r4(alpha_masi), "alpha_nominal_primary": r4(alpha_nom),
                 "multi_label_cost": r4(alpha_nom - alpha_masi) if alpha_nom is not None and alpha_masi is not None else None,
                 "n_units": len(units_prim), "pairs": pair_rows,
                 "alpha_by_document": {"min": min(x["alpha_nominal_primary"] for x in per_doc_alpha),
                                        "median": statistics.median(x["alpha_nominal_primary"] for x in per_doc_alpha),
                                        "max": max(x["alpha_nominal_primary"] for x in per_doc_alpha)},
                 "unanimous_rate": r4(sum(1 for u in units_prim if len(set(u)) == 1) / len(units_prim)),
                 "three_way_split_rate": r4(sum(1 for u in units_prim if len(u) == 3 and len(set(u)) == 3) / len(units_prim))}
    write_json(out / "agreement.json", agreement)

    # ---- 8. juges LLM --------------------------------------------------------------------
    jb: dict[str, dict[tuple, str]] = defaultdict(dict)
    for j in judges:
        jb[j["judge"]][key(j)] = j["theme"]
    judge_rows = []
    cons = {key(s): s["primary"] for s in sentences}
    for jname, preds in sorted(jb.items()):
        ks = [k for k in cons if k in preds]
        yt = [cons[k] for k in ks]; yp = [preds[k] for k in ks]
        acc = sum(1 for a, b in zip(yt, yp) if a == b) / len(ks)
        per_ann = {}
        for a in annotators:
            ka = [k for k in ks if any(v["annotator"] == a for v in votes_by_key.get(k, []))]
            va = {k: next(v["primary"] for v in votes_by_key[k] if v["annotator"] == a) for k in ka}
            per_ann[a] = r4(cohen_kappa([va[k] for k in ka], [preds[k] for k in ka]))
        starts = sum(1 for j in judges if j["judge"] == jname and j.get("is_segment_start"))
        judge_rows.append({"judge": jname, "n": len(ks), "accuracy_vs_consensus": r4(acc),
                           "kappa_vs_consensus": r4(cohen_kappa(yt, yp)),
                           **{f"kappa_vs_{a.split('.')[0]}": per_ann[a] for a in annotators},
                           "n_segment_starts": starts,
                           "top_theme": Counter(yp).most_common(1)[0][0],
                           "share_top_theme": r4(Counter(yp).most_common(1)[0][1] / len(yp))})
    write_csv(out / "judges.csv", judge_rows)
    jj = []
    for a, b in combinations(sorted(jb), 2):
        ks = [k for k in jb[a] if k in jb[b]]
        jj.append({"judge_a": a, "judge_b": b, "kappa": r4(cohen_kappa([jb[a][k] for k in ks], [jb[b][k] for k in ks]))})
    write_csv(out / "judge_pairs.csv", jj)

    # ---- 9. gold (cascade) -----------------------------------------------------------------
    gold_stats = {"n": len(gold),
                  "agreement_class": dict(Counter(g["agreement_class"] for g in gold)),
                  "auto_level": dict(Counter(g["auto_level"] for g in gold)),
                  "risk_band": dict(Counter(g.get("risk_band") for g in gold)),
                  "decided": sum(1 for g in gold if g.get("decided")),
                  "finalized": sum(1 for g in gold if g.get("finalized")),
                  "confidence": {"mean": r4(statistics.mean(g["confidence"] for g in gold)),
                                 "share_lt_0.67": r4(sum(1 for g in gold if g["confidence"] < 0.67) / len(gold))},
                  "changed_vs_consensus": sum(1 for g in gold if cons.get(key(g)) and g.get("decided_primary") and g["decided_primary"] != cons[key(g)])}
    write_json(out / "gold_cascade.json", gold_stats)

    # ---- 10. outliers, cas limites, incohérences potentielles --------------------------------
    long_sent = sorted(sentences, key=lambda s: -len(s["text"].split()))[:15]
    # clauses (plages de même jeu de thèmes)
    clause_lengths = []
    for d in docs:
        ss = sorted((s for s in sentences if s["document"] == d), key=lambda s: s["index"])
        run = 0; prev = None
        for s in ss:
            sig = tuple(sorted(s.get("themes", [s["primary"]])))
            if sig == prev:
                run += 1
            else:
                if run:
                    clause_lengths.append((d, prev, run))
                run = 1; prev = sig
        if run:
            clause_lengths.append((d, prev, run))
    long_clauses = sorted(clause_lengths, key=lambda x: -x[2])[:15]
    zero_strata = {t["theme"] for t in theme_rows if (t["lift"] or 0) <= 0.1}
    unfair_in_zero = [k for k in unfair_keys if by_key[k]["primary"] in zero_strata]
    unanimous_rare = []  # phrases unanimes sur un thème rare (α faible) : cas à vérifier
    low_alpha = {t["theme"] for t in theme_rows if t["alpha_binary"] is not None and t["alpha_binary"] < 0.4}
    for k, vs in votes_by_key.items():
        prims = {v["primary"] for v in vs}
        if len(vs) == 3 and len(prims) == 1 and next(iter(prims)) in low_alpha:
            unanimous_rare.append(k)
    doc_rates = sorted(doc_rows, key=lambda r: r["unfair_rate"])
    outliers = {
        "longest_sentences": [{"document": s["document"], "index": s["index"], "tokens": len(s["text"].split()),
                               "primary": s["primary"], "excerpt": s["text"][:120]} for s in long_sent],
        "longest_clauses": [{"document": d, "themes": list(t), "n_sentences": n} for d, t, n in long_clauses],
        "clause_length": {"n_clauses": len(clause_lengths),
                          "median": statistics.median(n for _, _, n in clause_lengths),
                          "p90": sorted(n for _, _, n in clause_lengths)[int(0.9 * len(clause_lengths))],
                          "max": max(n for _, _, n in clause_lengths)},
        "docs_lowest_unfair_rate": [(r["document"], r["unfair_rate"]) for r in doc_rates[:5]],
        "docs_highest_unfair_rate": [(r["document"], r["unfair_rate"]) for r in doc_rates[-5:]],
        "unfair_sentences_in_zero_strata_themes": {"n": len(unfair_in_zero), "themes": sorted(zero_strata),
                                                   "examples": [{"document": k[0], "index": k[1], "primary": by_key[k]["primary"],
                                                                 "categories": sorted(ref_by_key[k]), "excerpt": by_key[k]["text"][:120]}
                                                                for k in unfair_in_zero[:10]]},
        "unanimous_on_low_alpha_theme": {"n": len(unanimous_rare), "themes": sorted(low_alpha)},
        "multi_category_sentences": dict(multi_cat),
        "category_pairs": [{"pair": "+".join(p), "n": n} for p, n in cat_pairs.most_common(10)],
        "sentences_under_4_tokens": sum(1 for n in n_tokens if n < 4),
        "duplicate_texts": sum(n - 1 for n in Counter(s["text"].strip().lower() for s in sentences).values() if n > 1),
    }
    write_json(out / "outliers.json", outliers)
    write_json(out / "overview.json", overview)

    # ---- 11. rapport markdown ----------------------------------------------------------------
    md = []
    md.append("# DATA_PROFILE — export `7116e627…` (généré par `src/profiling/profile_dataset.py`)\n")
    md.append("> Régénéré automatiquement ; ne pas éditer à la main. Chiffres calculés sur `data/processed/`.\n")
    md.append("## 1. Vue d'ensemble\n")
    md.append("| Mesure | Valeur |\n|---|---|")
    for k, v in overview.items():
        md.append(f"| {k} | {v} |")
    md.append("\n## 2. Catégories CLAUDETTE (référence d'abusivité)\n")
    md.append("| Catégorie | Phrases | Documents | Part | Thèmes dominants | Concentration top-1 |\n|---|---|---|---|---|---|")
    for r in cat_rows:
        md.append(f"| {r['category']} | {r['n_sentences']} | {r['n_documents']} | {r['share_of_labels']} | {r['top_themes']} | {r['concentration_top1']} |")
    md.append(f"\nPhrases portant plusieurs catégories : {dict(multi_cat)} ; paires les plus fréquentes : "
              + ", ".join(f"{'+'.join(p)} ({n})" for p, n in cat_pairs.most_common(5)) + ".")
    md.append("\n## 3. Thèmes (couche thématique) : supports, strates d'abusivité, fiabilité binaire\n")
    md.append("| Thème | Primaire | Tout | Votes | Docs | Abusives | P(abusif) | Lift | Strate | α binaire | Catégories |\n|---|---|---|---|---|---|---|---|---|---|---|")
    for r in sorted(theme_rows, key=lambda x: -(x["lift"] or 0)):
        md.append(f"| {r['theme']} | {r['support_primary']} | {r['support_any']} | {r['support_votes']} | {r['n_documents']} | {r['unfair_sentences']} | {r['p_unfair']} | {r['lift']} | {r['stratum']} | {r['alpha_binary']} | {r['top_categories']} |")
    md.append("\n## 4. Accord inter-annotateurs\n")
    md.append(f"- α-MASI (jeux de thèmes) : **{agreement['alpha_masi_sets']}** ; α nominal (primaire) : **{agreement['alpha_nominal_primary']}** ; coût du multi-label : {agreement['multi_label_cost']}")
    md.append(f"- Unanimité (3/3) : {agreement['unanimous_rate']} ; désaccord total (1-1-1) : {agreement['three_way_split_rate']} ; α nominal par document : min {agreement['alpha_by_document']['min']}, médiane {agreement['alpha_by_document']['median']}, max {agreement['alpha_by_document']['max']}")
    md.append("\n| Paire | Phrases | Accord brut | κ |\n|---|---|---|---|")
    for r in pair_rows:
        md.append(f"| {r['annotator_a']} ↔ {r['annotator_b']} | {r['n_sentences']} | {r['raw_agreement']} | {r['kappa']} |")
    md.append("\nConfusions primaires les plus fréquentes : " + ", ".join(f"{a}↔{b} ({n})" for (a, b), n in confusion.most_common(8)) + ".")
    md.append("\n| Annotateur | Votes | Taux multi-label | Secondaires posés | Entropie primaire (bits) | Thème le plus posé |\n|---|---|---|---|---|---|")
    for r in style_rows:
        md.append(f"| {r['annotator']} | {r['n_votes']} | {r['multi_label_rate']} | {r['n_secondary_labels']} | {r['entropy_primary_bits']} | {r['top_theme']} |")
    md.append("\n## 5. Juges LLM (pré-annotations, même vocabulaire)\n")
    if judge_rows:
        heads = list(judge_rows[0].keys())
        md.append("| " + " | ".join(heads) + " |\n|" + "---|" * len(heads))
        for r in judge_rows:
            md.append("| " + " | ".join(str(r[h]) for h in heads) + " |")
        md.append("\nκ juge ↔ juge : " + ", ".join(f"{r['judge_a']}↔{r['judge_b']} {r['kappa']}" for r in jj) + ".")
    md.append("\n## 6. Gold (cascade de résolution)\n")
    md.append("```json\n" + json.dumps(gold_stats, ensure_ascii=False, indent=1) + "\n```")
    md.append("\n## 7. Cas limites, outliers, incohérences potentielles\n")
    md.append(f"- Clauses (plages de même jeu de thèmes) : {outliers['clause_length']}")
    md.append(f"- Phrases < 4 tokens : {outliers['sentences_under_4_tokens']} ; textes dupliqués : {outliers['duplicate_texts']}")
    md.append(f"- Documents les moins/plus abusifs : {outliers['docs_lowest_unfair_rate']} / {outliers['docs_highest_unfair_rate']}")
    md.append(f"- Phrases abusives dont le thème est de strate nulle {outliers['unfair_sentences_in_zero_strata_themes']['themes']} : **{outliers['unfair_sentences_in_zero_strata_themes']['n']}** (à auditer : erreur de thème ou de label ?)")
    md.append(f"- Phrases unanimes (3/3) sur un thème peu fiable {outliers['unanimous_on_low_alpha_theme']['themes']} : {outliers['unanimous_on_low_alpha_theme']['n']}")
    md.append("- Clauses les plus longues : " + ", ".join(f"{c['document']} ({c['n_sentences']} phr., {'+'.join(c['themes'])})" for c in outliers["longest_clauses"][:5]))
    md.append("\n## 8. Fichiers produits\n")
    md.append("`documents.csv`, `themes.csv`, `categories.csv`, `theme_x_category.csv`, `theme_cooccurrence.csv`, "
              "`annotator_pairs.csv`, `annotator_confusion.csv`, `annotator_style.csv`, `agreement.json`, "
              "`agreement_by_document.csv`, `judges.csv`, `judge_pairs.csv`, `gold_cascade.json`, `outliers.json`, `overview.json`.")
    (root / "docs" / "DATA_PROFILE.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print(json.dumps({"ok": True, "out": str(out), "alpha_masi": agreement["alpha_masi_sets"],
                      "alpha_nominal": agreement["alpha_nominal_primary"], "n_clauses": outliers["clause_length"]["n_clauses"]}))


if __name__ == "__main__":
    main()

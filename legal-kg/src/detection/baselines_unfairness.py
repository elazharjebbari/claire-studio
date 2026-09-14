#!/usr/bin/env python3
"""Baselines de détection d'abusivité (EXPERIMENTAL_PROTOCOL §2) — B0 majorité, B0' thème seul, B1 TF-IDF + LR.

Cible : les 8 catégories CLAUDETTE par phrase (multi-label, un classifieur un-contre-tous par catégorie).
Deux découpes : `design_holdout` (33 → 17 documents, la découpe des règles pré-enregistrées) et
`group_kfold_document` (5 plis de splits.json). Seuils choisis sur des scores HORS-ÉCHANTILLON de l'entraînement (validation croisée interne à 4 plis par
document, max F1) ; jamais sur le test, jamais sur des scores in-sample (qui sur-ajustent le seuil).
Métriques : P/R/F1 par catégorie au seuil, PR-AUC (average precision), macro-F1 ; IC 95 % bootstrap par
document (1 000 tirages) sur la macro-F1. Enregistrement du run (REPRODUCIBILITY.md §1).

Usage : python src/detection/baselines_unfairness.py [--split design_holdout|group_kfold_document|both] [--context 1]
Dépendances : scikit-learn, numpy (env conda `claire`).
"""
from __future__ import annotations

import argparse
import json
import random
import subprocess
import uuid
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, precision_recall_fscore_support
from sklearn.model_selection import GroupKFold

ROOT = Path(__file__).resolve().parents[2]
CATS = ["A", "CH", "CR", "J", "LAW", "LTD", "TER", "USE"]
SEED = 42


def read_jsonl(p):
    return [json.loads(l) for l in p.open(encoding="utf-8") if l.strip()]


def best_threshold(y, s):
    """Seuil maximisant F1 sur l'entraînement (grille sur les scores observés)."""
    if y.sum() == 0:
        return 0.5
    cands = np.unique(np.quantile(s, np.linspace(0.5, 0.999, 60)))
    best, bt = -1.0, 0.5
    for t in cands:
        p, r, f, _ = precision_recall_fscore_support(y, (s >= t).astype(int), average="binary", zero_division=0)
        if f > best:
            best, bt = f, t
    return float(bt)


def evaluate(y_true: np.ndarray, scores: np.ndarray, thresholds: list[float], docs: list[str], rng: random.Random, n_boot=1000):
    per_cat, f1s = [], []
    for k, c in enumerate(CATS):
        y, s, t = y_true[:, k], scores[:, k], thresholds[k]
        p, r, f, _ = precision_recall_fscore_support(y, (s >= t).astype(int), average="binary", zero_division=0)
        ap = average_precision_score(y, s) if y.sum() else None
        per_cat.append({"category": c, "n_pos": int(y.sum()), "precision": round(float(p), 4), "recall": round(float(r), 4),
                        "f1": round(float(f), 4), "pr_auc": None if ap is None else round(float(ap), 4), "threshold": round(t, 4)})
        f1s.append(f)
    macro = float(np.mean(f1s))
    # bootstrap par document
    by_doc = defaultdict(list)
    for i, d in enumerate(docs):
        by_doc[d].append(i)
    doc_ids = list(by_doc)
    boots = []
    for _ in range(n_boot):
        idx = np.concatenate([by_doc[d] for d in rng.choices(doc_ids, k=len(doc_ids))])
        fs = []
        for k in range(len(CATS)):
            y, s = y_true[idx, k], scores[idx, k]
            if y.sum() == 0:
                continue
            _, _, f, _ = precision_recall_fscore_support(y, (s >= thresholds[k]).astype(int), average="binary", zero_division=0)
            fs.append(f)
        boots.append(np.mean(fs) if fs else 0.0)
    lo, hi = np.percentile(boots, [2.5, 97.5])
    # Agrégat binaire « phrase abusive » (comparable à la tâche Lab U1_unfair) : positif si au moins une
    # catégorie dépasse son seuil ; score = max des scores normalisés par le seuil (1.0 = frontière de décision).
    thr_arr = np.array(thresholds, dtype=float)
    y_any = (y_true.sum(axis=1) > 0).astype(int)
    score_any = (scores / np.where(thr_arr > 0, thr_arr, 1.0)).max(axis=1)
    pred_any = (score_any >= 1.0).astype(int)
    p_a, r_a, f_a, _ = precision_recall_fscore_support(y_any, pred_any, average="binary", zero_division=0)
    ap_any = average_precision_score(y_any, score_any) if y_any.sum() else None
    boots_any = []
    for _ in range(n_boot):
        idx = np.concatenate([by_doc[d] for d in rng.choices(doc_ids, k=len(doc_ids))])
        if y_any[idx].sum() == 0:
            continue
        boots_any.append(precision_recall_fscore_support(y_any[idx], pred_any[idx], average="binary", zero_division=0)[2])
    lo_a, hi_a = np.percentile(boots_any, [2.5, 97.5]) if boots_any else (0.0, 0.0)
    unfair_any = {"n_pos": int(y_any.sum()), "n": int(len(y_any)), "precision": round(float(p_a), 4), "recall": round(float(r_a), 4),
                  "f1": round(float(f_a), 4), "f1_ci95": [round(float(lo_a), 4), round(float(hi_a), 4)],
                  "pr_auc": None if ap_any is None else round(float(ap_any), 4)}
    return {"macro_f1": round(macro, 4), "macro_f1_ci95": [round(float(lo), 4), round(float(hi), 4)],
            "unfair_any": unfair_any,
            "micro_f1": round(float(precision_recall_fscore_support(y_true.ravel(), (scores >= np.array(thresholds)).astype(int).ravel(), average="binary", zero_division=0)[2]), 4),
            "per_category": per_cat}


def texts_with_context(sents, ctx):
    by_doc = defaultdict(dict)
    for s in sents:
        by_doc[s["document"]][s["index"]] = s.get("text_detok") or s["text"]
    out = []
    for s in sents:
        d, i = s["document"], s["index"]
        parts = [by_doc[d].get(j, "") for j in range(i - ctx, i + ctx + 1)]
        out.append(" ".join(p for p in parts if p))
    return out


def run_split(train, test, ctx, rng):
    y_tr = np.array([[1 if c in s["_cats"] else 0 for c in CATS] for s in train])
    y_te = np.array([[1 if c in s["_cats"] else 0 for c in CATS] for s in test])
    docs_te = [s["document"] for s in test]
    results = {}

    # B0 — majorité (aucune phrase abusive) : scores nuls
    zeros = np.zeros_like(y_te, dtype=float)
    results["B0_majority"] = evaluate(y_te, zeros, [0.5] * len(CATS), docs_te, rng, n_boot=200)

    # B0' — thème seul : P(cat | thème T11) estimé sur train (lissage de Laplace), seuil sur train
    counts, tot = defaultdict(Counter), Counter()
    for s, y in zip(train, y_tr):
        tot[s["_theme"]] += 1
        for k, c in enumerate(CATS):
            counts[s["_theme"]][c] += int(y[k])
    def theme_scores(sents):
        return np.array([[(counts[s["_theme"]][c] + 1) / (tot[s["_theme"]] + 2) for c in CATS] for s in sents])
    s_te = theme_scores(test)
    # seuils sur scores hors-échantillon (les probabilités par thème sont ré-estimées sur 3/4 des documents)
    groups_tr = [s["document"] for s in train]
    s_oof = np.zeros(y_tr.shape)
    for tr_i, va_i in GroupKFold(n_splits=4).split(train, groups=groups_tr):
        c2, t2 = defaultdict(Counter), Counter()
        for i in tr_i:
            t2[train[i]["_theme"]] += 1
            for k, c in enumerate(CATS):
                c2[train[i]["_theme"]][c] += int(y_tr[i, k])
        for i in va_i:
            th = train[i]["_theme"]
            s_oof[i] = [(c2[th][c] + 1) / (t2[th] + 2) for c in CATS]
    thr = [best_threshold(y_tr[:, k], s_oof[:, k]) for k in range(len(CATS))]
    results["B0prime_theme_only"] = evaluate(y_te, s_te, thr, docs_te, rng)

    # B1 — TF-IDF (mots 1–2 + caractères 3–5) + régression logistique équilibrée, un-contre-tous
    x_tr_txt, x_te_txt = texts_with_context(train, ctx), texts_with_context(test, ctx)
    vec_w = TfidfVectorizer(ngram_range=(1, 2), min_df=2, sublinear_tf=True, max_features=200000)
    vec_c = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), min_df=3, sublinear_tf=True, max_features=200000)
    from scipy.sparse import hstack
    X_tr = hstack([vec_w.fit_transform(x_tr_txt), vec_c.fit_transform(x_tr_txt)]).tocsr()
    X_te = hstack([vec_w.transform(x_te_txt), vec_c.transform(x_te_txt)]).tocsr()
    s_oof = np.zeros(y_tr.shape); s_te = np.zeros(y_te.shape)
    folds = list(GroupKFold(n_splits=4).split(train, groups=groups_tr))
    for k, c in enumerate(CATS):
        if y_tr[:, k].sum() < 2:
            continue
        # scores hors-échantillon sur l'entraînement (pour le seuil), puis modèle final sur tout l'entraînement
        for tr_i, va_i in folds:
            if y_tr[tr_i, k].sum() < 1:
                continue
            m = LogisticRegression(max_iter=2000, C=4.0, class_weight="balanced", random_state=SEED)
            m.fit(X_tr[tr_i], y_tr[tr_i, k])
            s_oof[va_i, k] = m.predict_proba(X_tr[va_i])[:, 1]
        clf = LogisticRegression(max_iter=2000, C=4.0, class_weight="balanced", random_state=SEED)
        clf.fit(X_tr, y_tr[:, k])
        s_te[:, k] = clf.predict_proba(X_te)[:, 1]
    thr = [best_threshold(y_tr[:, k], s_oof[:, k]) for k in range(len(CATS))]
    results[f"B1_tfidf_lr_ctx{ctx}"] = evaluate(y_te, s_te, thr, docs_te, rng)
    return results


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--split", default="both", choices=["design_holdout", "group_kfold_document", "both"])
    ap.add_argument("--context", type=int, default=1)
    args = ap.parse_args()
    rng = random.Random(SEED)
    dp = ROOT / "data" / "processed"
    sents = read_jsonl(dp / "sentences.jsonl")
    ref = read_jsonl(dp / "reference.jsonl")
    cats_by = defaultdict(set)
    for r in ref:
        cats_by[(r["document"], r["index"])].add(r["category"])
    spec = json.loads((ROOT.parent / "frontend/src/lib/taxonomy/taxonomies.json").read_text(encoding="utf-8"))
    t11 = next(t for t in spec["taxonomies"] if t["id"] == "T11")
    to_t11 = {m: c["code"] for c in t11["categories"] for m in c.get("members", [])}
    pops = {d: p for p, v in spec["populations"].items() for d in v["documents"]}
    for s in sents:
        s["_cats"] = cats_by.get((s["document"], s["index"]), set())
        s["_theme"] = to_t11.get(s["primary"], s["primary"])
    splits = json.loads((dp / "splits.json").read_text(encoding="utf-8"))

    run_id = str(uuid.uuid4())
    out = ROOT / "results" / "baselines" / run_id
    out.mkdir(parents=True, exist_ok=True)
    all_results = {}
    if args.split in ("design_holdout", "both"):
        tr = [s for s in sents if pops.get(s["document"]) == "designSet"]
        te = [s for s in sents if pops.get(s["document"]) == "holdout"]
        all_results["design_holdout"] = run_split(tr, te, args.context, rng)
    if args.split in ("group_kfold_document", "both"):
        agg = defaultdict(list)
        fold_res = []
        for k, fold in enumerate(splits["folds"]):
            te = [s for s in sents if s["document"] in set(fold)]
            tr = [s for s in sents if s["document"] not in set(fold)]
            r = run_split(tr, te, args.context, rng)
            fold_res.append(r)
        # agrégation : moyenne des macro-F1 par pli (écart-type) + moyenne des PR-AUC par catégorie
        summary = {}
        for name in fold_res[0]:
            m = [r[name]["macro_f1"] for r in fold_res]
            per_cat = []
            for k, c in enumerate(CATS):
                aps = [r[name]["per_category"][k]["pr_auc"] for r in fold_res if r[name]["per_category"][k]["pr_auc"] is not None]
                f1s = [r[name]["per_category"][k]["f1"] for r in fold_res]
                per_cat.append({"category": c, "f1_mean": round(float(np.mean(f1s)), 4), "pr_auc_mean": round(float(np.mean(aps)), 4) if aps else None})
            summary[name] = {"macro_f1_mean": round(float(np.mean(m)), 4), "macro_f1_sd": round(float(np.std(m)), 4), "folds": m, "per_category": per_cat}
        all_results["group_kfold_document"] = {"summary": summary, "folds": fold_res}
    try:
        code_version = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    except Exception:  # noqa: BLE001
        code_version = "unknown"
    record = {"run_id": run_id, "kind": "classification", "baselines": ["B0_majority", "B0prime_theme_only", f"B1_tfidf_lr_ctx{args.context}"],
              "dataset": json.loads((dp / "manifest.json").read_text())["fingerprint"], "taxonomy_for_theme_baseline": "T11",
              "target": "CLAUDETTE categories (multi-label, one-vs-rest)", "context_sentences": args.context, "seed": SEED,
              "threshold_policy": "max F1 on out-of-fold training scores (inner GroupKFold k=4 by document)", "bootstrap": {"unit": "document", "n": 1000},
              "code_version": code_version, "started_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "results": all_results}
    (out / "run.json").write_text(json.dumps(record, indent=1, ensure_ascii=False), encoding="utf-8")
    brief = {}
    for split, res in all_results.items():
        if split == "design_holdout":
            brief[split] = {n: {"macro_f1": r["macro_f1"], "ci": r["macro_f1_ci95"]} for n, r in res.items()}
        else:
            brief[split] = {n: {"macro_f1_mean": r["macro_f1_mean"], "sd": r["macro_f1_sd"]} for n, r in res["summary"].items()}
    print(json.dumps({"run_id": run_id, "out": str(out), **brief}, ensure_ascii=False))


if __name__ == "__main__":
    main()

"""Tests statistiques pré-enregistrés (EXPERIMENTAL_PROTOCOL.md § règles 1–7) — Python pur, graine fixe.

- `paired_permutation_by_document` : différence de F1 (ou d'une autre métrique agrégée) entre deux systèmes, permutation
  appariée par DOCUMENT (on échange les deux systèmes document par document), 10 000 tirages par défaut, p bilatéral.
- `holm` : correction de Holm sur une famille de p-valeurs (items).
- `wilson` : IC de Wilson pour une proportion (taux d'audit, part de FP « référence absente »).
- `noninferiority` : borne inférieure de l'IC bootstrap de (F1_règles − F1_texte) comparée à −δ (δ = 0,05 déclaré).

Entrées : les `E2.json` de evaluate_matches.py (par document ? non : il faut les phrases) → ce module travaille sur des
listes de tuples (document, y_true, y_A, y_B) fournies par `evaluate_matches.py --dump-sentences` ou reconstruites ici.
"""
from __future__ import annotations

import json
import math
import random
from collections import defaultdict


def _prf(tp, fp, fn):
    p = tp / (tp + fp) if tp + fp else 0.0
    r = tp / (tp + fn) if tp + fn else 0.0
    return p, r, (2 * p * r / (p + r) if p + r else 0.0)


def f1_from_rows(rows, col: str) -> float:
    tp = sum(1 for r in rows if r["y_true"] and r[col]); fp = sum(1 for r in rows if not r["y_true"] and r[col])
    fn = sum(1 for r in rows if r["y_true"] and not r[col])
    return _prf(tp, fp, fn)[2]


def _doc_counts(rows: list[dict], col: str) -> dict:
    out = {}
    for r in rows:
        c = out.setdefault(r["document"], [0, 0, 0])
        if r["y_true"] and r[col]: c[0] += 1
        elif r[col]: c[1] += 1
        elif r["y_true"]: c[2] += 1
    return out


def _f1_sum(counts: dict, docs, weights=None) -> float:
    tp = fp = fn = 0
    for d in docs:
        w = 1 if weights is None else weights[d]
        t, x, y = counts[d]; tp += w * t; fp += w * x; fn += w * y
    return _prf(tp, fp, fn)[2]


def paired_permutation_by_document(rows: list[dict], a: str, b: str, *, n: int = 10000, seed: int = 42, metric=None) -> dict:
    """rows : {document, y_true, <a>: bool, <b>: bool}. H0 : les deux systèmes sont échangeables document par document.
    Implémentation sur comptes (tp, fp, fn) par document : O(documents) par permutation."""
    ca, cb = _doc_counts(rows, a), _doc_counts(rows, b)
    docs = sorted(set(ca) | set(cb))
    for d in docs:
        ca.setdefault(d, [0, 0, 0]); cb.setdefault(d, [0, 0, 0])
    observed = _f1_sum(ca, docs) - _f1_sum(cb, docs)
    rng = random.Random(seed); count = 0
    for _ in range(n):
        sa, sb = {}, {}
        for d in docs:
            if rng.random() < 0.5:
                sa[d], sb[d] = cb[d], ca[d]
            else:
                sa[d], sb[d] = ca[d], cb[d]
        diff = _f1_sum(sa, docs) - _f1_sum(sb, docs)
        if abs(diff) >= abs(observed) - 1e-12:
            count += 1
    return {"a": a, "b": b, "observed_diff": round(observed, 4), "p_value": round((count + 1) / (n + 1), 5), "n_permutations": n, "n_documents": len(docs)}


def holm(pvalues: dict[str, float], alpha: float = 0.05) -> dict:
    items = sorted(pvalues.items(), key=lambda kv: kv[1])
    m = len(items); out = {}; rejected_so_far = True
    for i, (k, p) in enumerate(items):
        adj = min(1.0, (m - i) * p)
        reject = rejected_so_far and adj <= alpha
        rejected_so_far = reject
        out[k] = {"p": p, "p_holm": round(adj, 5), "reject_at_0.05": reject}
    return out


def wilson(k: int, n: int, z: float = 1.959964) -> dict:
    if n == 0:
        return {"point": None, "low": None, "high": None, "n": 0}
    p = k / n; denom = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / denom
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
    return {"point": round(p, 4), "low": round(centre - half, 4), "high": round(centre + half, 4), "n": n, "k": k}


def noninferiority(rows: list[dict], a: str, b: str, *, delta: float = 0.05, n_boot: int = 1000, seed: int = 42) -> dict:
    """A (règles) est non inférieur à B (texte) si la borne basse de l'IC bootstrap-document de F1_A − F1_B > −δ."""
    ca, cb = _doc_counts(rows, a), _doc_counts(rows, b)
    docs = sorted(set(ca) | set(cb))
    for d in docs:
        ca.setdefault(d, [0, 0, 0]); cb.setdefault(d, [0, 0, 0])
    rng = random.Random(seed); diffs = []
    for _ in range(n_boot):
        sample = rng.choices(docs, k=len(docs))
        w = {d: 0 for d in docs}
        for d in sample:
            w[d] += 1
        diffs.append(_f1_sum(ca, docs, w) - _f1_sum(cb, docs, w))
    diffs.sort()
    low = diffs[int(0.025 * n_boot)]; high = diffs[min(n_boot - 1, int(0.975 * n_boot))]
    return {"a": a, "b": b, "delta": delta, "diff_point": round(_f1_sum(ca, docs) - _f1_sum(cb, docs), 4),
            "ci95": [round(low, 4), round(high, 4)], "noninferior": low > -delta}


if __name__ == "__main__":
    # démonstration sur données synthétiques (pas un résultat)
    rng = random.Random(1)
    rows = [{"document": f"d{i % 12}", "y_true": rng.random() < 0.12} for i in range(2000)]
    for r in rows:
        r["A"] = r["y_true"] and rng.random() < 0.6 or (not r["y_true"] and rng.random() < 0.03)
        r["B"] = r["y_true"] and rng.random() < 0.7 or (not r["y_true"] and rng.random() < 0.04)
    print(json.dumps({"perm": paired_permutation_by_document(rows, "A", "B", n=2000), "noninf": noninferiority(rows, "A", "B", n_boot=300),
                      "holm": holm({"g": 0.01, "j": 0.03, "k": 0.2}), "wilson": wilson(12, 50)}, indent=1))

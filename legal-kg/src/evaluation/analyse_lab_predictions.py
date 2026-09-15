"""Analyse d'erreurs des baselines texte-seul (Lab U1_unfair) sur le hold-out : où l'encodeur échoue.

Entrées : predictions.jsonl d'un ou deux runs Lab (B1, B2) + data/annotations/clauses_all.jsonl (thème T11 consensus par
phrase). Sorties : ANALYSIS.json + ANALYSIS.md dans le dossier du run principal. Aucun réentraînement, aucune décision :
lecture seule des prédictions déjà produites (les catégories CLAUDETTE servent ici de grille d'analyse, pas d'entrée).
"""
from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CATS = ["A", "CH", "CR", "J", "LAW", "LTD", "TER", "USE"]


def read_jsonl(p: Path):
    return [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines() if l.strip()]


def prf(tp, fp, fn):
    p = tp / (tp + fp) if tp + fp else 0.0
    r = tp / (tp + fn) if tp + fn else 0.0
    f = 2 * p * r / (p + r) if p + r else 0.0
    return round(p, 3), round(r, 3), round(f, 3)


def analyse(rows: list[dict], theme_of: dict) -> dict:
    out = {}
    pos = [r for r in rows if r["y_true"] == "unfair"]
    out["n"] = len(rows); out["n_unfair"] = len(pos)
    # rappel par catégorie CLAUDETTE (une phrase compte pour chacune de ses catégories)
    by_cat = {}
    for c in CATS:
        sub = [r for r in pos if c in r["unfair"]]
        caught = sum(1 for r in sub if r["y_pred"] == "unfair")
        by_cat[c] = {"n": len(sub), "recall": round(caught / len(sub), 3) if sub else None}
    out["recall_by_category"] = by_cat
    # par thème T11
    by_theme = defaultdict(lambda: Counter())
    for r in rows:
        t = theme_of.get((r["document"], r["index"]), "?")
        k = ("tp" if r["y_true"] == "unfair" else "fp") if r["y_pred"] == "unfair" else ("fn" if r["y_true"] == "unfair" else "tn")
        by_theme[t][k] += 1
    theme_rows = []
    for t, c in by_theme.items():
        p, rcl, f = prf(c["tp"], c["fp"], c["fn"])
        theme_rows.append({"theme": t, "n": sum(c.values()), "n_unfair": c["tp"] + c["fn"], "base_rate": round((c["tp"] + c["fn"]) / sum(c.values()), 3),
                           "precision": p, "recall": rcl, "f1": f, "fp": c["fp"], "fn": c["fn"]})
    out["by_theme_T11"] = sorted(theme_rows, key=lambda x: -x["n_unfair"])
    # classes d'accord (thématique) : le modèle échoue-t-il là où les humains divergeaient sur le thème ?
    by_agr = defaultdict(lambda: [0, 0, 0])
    for r in rows:
        b = by_agr[r.get("agreement") or "unknown"]
        b[0] += 1; b[1] += r["y_true"] != r["y_pred"]; b[2] += r["y_true"] == "unfair"
    out["error_rate_by_agreement"] = {k: {"n": v[0], "error_rate": round(v[1] / v[0], 3), "unfair_rate": round(v[2] / v[0], 3)} for k, v in sorted(by_agr.items())}
    # erreurs confiantes : faux négatifs avec score « unfair » < 0,1 ; faux positifs avec score > 0,9
    fn_conf = [r["scores"].get("unfair", 0.0) for r in pos if r["y_pred"] == "fair"]
    fp_conf = [r["scores"].get("unfair", 0.0) for r in rows if r["y_true"] == "fair" and r["y_pred"] == "unfair"]
    out["confident_errors"] = {"false_negatives": len(fn_conf), "fn_score_lt_0.1": sum(1 for s in fn_conf if s < 0.1),
                               "fn_score_ge_0.4": sum(1 for s in fn_conf if s >= 0.4), "false_positives": len(fp_conf),
                               "fp_score_gt_0.9": sum(1 for s in fp_conf if s > 0.9)}
    # par document : F1 min / médiane / max
    by_doc = defaultdict(Counter)
    for r in rows:
        k = ("tp" if r["y_true"] == "unfair" else "fp") if r["y_pred"] == "unfair" else ("fn" if r["y_true"] == "unfair" else "tn")
        by_doc[r["document"]][k] += 1
    f1s = sorted((prf(c["tp"], c["fp"], c["fn"])[2], d) for d, c in by_doc.items() if c["tp"] + c["fn"] > 0)
    out["f1_by_document"] = {"min": f1s[0], "median": f1s[len(f1s) // 2], "max": f1s[-1], "n_documents": len(f1s)}
    # multi-catégories : les phrases à 2+ catégories sont-elles mieux détectées ?
    multi = [r for r in pos if len(r["unfair"]) >= 2]
    out["multi_category"] = {"n": len(multi), "recall": round(sum(1 for r in multi if r["y_pred"] == "unfair") / len(multi), 3) if multi else None}
    return out


def overlap(a: list[dict], b: list[dict]) -> dict:
    key = lambda r: (r["document"], r["index"])
    pa = {key(r) for r in a if r["y_true"] == "unfair" and r["y_pred"] == "unfair"}
    pb = {key(r) for r in b if r["y_true"] == "unfair" and r["y_pred"] == "unfair"}
    pos = {key(r) for r in a if r["y_true"] == "unfair"}
    return {"n_unfair": len(pos), "both": len(pa & pb), "only_first": len(pa - pb), "only_second": len(pb - pa), "neither": len(pos - pa - pb)}


def to_md(name: str, an: dict, ov: dict | None, other_name: str | None) -> str:
    L = [f"# Analyse d'erreurs — {name} (hold-out, {an['n']} phrases, {an['n_unfair']} abusives)", ""]
    L += ["## Rappel par catégorie CLAUDETTE", "", "| Catégorie | n | rappel |", "|---|---|---|"]
    L += [f"| {c} | {v['n']} | {v['recall']} |" for c, v in an["recall_by_category"].items()]
    L += ["", "## Par thème T11 (consensus)", "", "| Thème | n | abusives | taux | P | R | F1 | FP | FN |", "|---|---|---|---|---|---|---|---|---|"]
    L += [f"| {t['theme']} | {t['n']} | {t['n_unfair']} | {t['base_rate']} | {t['precision']} | {t['recall']} | {t['f1']} | {t['fp']} | {t['fn']} |" for t in an["by_theme_T11"]]
    L += ["", "## Classe d'accord thématique (humains) et taux d'erreur", "", "| Classe | n | taux d'erreur | taux d'abusives |", "|---|---|---|---|"]
    L += [f"| {k} | {v['n']} | {v['error_rate']} | {v['unfair_rate']} |" for k, v in an["error_rate_by_agreement"].items()]
    ce = an["confident_errors"]
    L += ["", "## Erreurs confiantes", "", f"- Faux négatifs : {ce['false_negatives']}, dont {ce['fn_score_lt_0.1']} avec un score « abusif » < 0,1 (le modèle ne voit rien) et {ce['fn_score_ge_0.4']} ≥ 0,4 (proches de la frontière).",
          f"- Faux positifs : {ce['false_positives']}, dont {ce['fp_score_gt_0.9']} avec un score > 0,9."]
    fd = an["f1_by_document"]
    L += ["", f"## Par document : F1 min {fd['min'][0]} ({fd['min'][1]}), médiane {fd['median'][0]} ({fd['median'][1]}), max {fd['max'][0]} ({fd['max'][1]}) sur {fd['n_documents']} documents."]
    mc = an["multi_category"]
    L += ["", f"## Phrases multi-catégories : {mc['n']} phrases à ≥ 2 catégories, rappel {mc['recall']}."]
    if ov:
        L += ["", f"## Recouvrement avec {other_name} (phrases abusives détectées)", "", f"- Détectées par les deux : {ov['both']} ; par {name} seul : {ov['only_second']} ; par {other_name} seul : {ov['only_first']} ; par aucun : {ov['neither']} (sur {ov['n_unfair']})."]
    return "\n".join(L) + "\n"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--predictions", type=Path, required=True, help="predictions.jsonl du run principal (ex. B2)")
    ap.add_argument("--name", default="B2 Legal-BERT")
    ap.add_argument("--compare", type=Path, default=None, help="predictions.jsonl d'un second run (ex. B1)")
    ap.add_argument("--compare-name", default="B1 TF-IDF")
    ap.add_argument("--clauses", type=Path, default=ROOT / "data" / "annotations" / "clauses_all.jsonl")
    a = ap.parse_args(argv)
    theme_of = {}
    for c in read_jsonl(a.clauses):
        for s in c["sentences"]:
            theme_of[(c["document"], s["index"])] = c["theme_T11"]
    main_rows = read_jsonl(a.predictions)
    result = {"name": a.name, "analysis": analyse(main_rows, theme_of)}
    ov = None
    if a.compare:
        cmp_rows = read_jsonl(a.compare)
        result["compare"] = {"name": a.compare_name, "analysis": analyse(cmp_rows, theme_of)}
        ov = overlap(cmp_rows, main_rows)
        result["overlap"] = ov
    out_dir = a.predictions.parent
    (out_dir / "ANALYSIS.json").write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    md = to_md(a.name, result["analysis"], ov, a.compare_name if a.compare else None)
    if a.compare:
        md += "\n---\n\n" + to_md(a.compare_name, result["compare"]["analysis"], None, None)
    (out_dir / "ANALYSIS.md").write_text(md, encoding="utf-8")
    print(md)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

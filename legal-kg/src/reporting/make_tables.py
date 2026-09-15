"""Tableaux LaTeX du papier 157 générés depuis les JSON de résultats (jamais saisis à la main).

  --table queries  : T3 — par requête / item sur le hold-out (E2.json)
  --table cost     : T4 — coût de l'interprétabilité : B0', B1, B2, règles ∪ (E2.json + results/baselines/*.json)
  --table audit    : T6 — audit expert (AUDIT.json de audit_sheet.py merge)
Sortie : fichiers .tex (booktabs, \\footnotesize) dans --out ; à \\input depuis jurix2026-long-paper/.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def fmt(x, nd=2):
    return "---" if x is None else f"{x:.{nd}f}"


def ci(b):
    if not b or b.get("low") is None:
        return ""
    return f" [{b['low']:.2f};{b['high']:.2f}]"


def table_queries(e2: dict, caption: str, label: str) -> str:
    L = [r"\begin{table}[t]", rf"\caption{{{caption}}}", rf"\label{{{label}}}", r"\centering", r"\footnotesize\setlength{\tabcolsep}{3.5pt}",
         r"\begin{tabular}{@{}llrrrrrr@{}}", r"\toprule",
         r"Query & Item (ref.) & $n_+$ & Flagged & P & R & $F_1$ [95\% CI] & $\Delta F_1$ vs theme \\", r"\midrule"]
    items = {b["item"]: b for b in e2["items"]}
    for r in e2["rules"]:
        if "note" in r:
            L.append(rf"{r['rule']} & ({','.join(r['items'])}) & --- & {r['n_flagged']} & \multicolumn{{4}}{{l}}{{audit only (no reference category)}} \\"); continue
        L.append(rf"{r['rule']} & ({','.join(r['items'])}) {','.join(sorted({c for i in r['items'] for c in items.get(i, {}).get('categories', [])}))} & {r['n_pos']} & {r['n_flagged']} & {fmt(r['precision'])} & {fmt(r['recall'])} & {fmt(r['f1'])}{ci(r['f1_ci95'])} & \\")
    L += [r"\midrule"]
    for b in e2["items"]:
        L.append(rf"\emph{{item ({b['item']})}} & {','.join(b['categories'])} & {b['n_pos']} & {b['n_flagged']} & {fmt(b['precision'])} & {fmt(b['recall'])} & {fmt(b['f1'])}{ci(b['f1_ci95'])} & {b['delta_f1_vs_theme_only']:+.2f}{ci(b['delta_f1_ci95'])} \\")
    ag = e2["aggregate_structural"]
    L += [r"\midrule", rf"\textbf{{Structural items ({ag['n_items']})}} & & & & {fmt(ag['micro_precision'])} & {fmt(ag['micro_recall'])} & {fmt(ag['micro_f1'])} (macro {fmt(ag['macro_f1'])}) & {ag['macro_delta_f1_vs_theme_only']:+.2f} \\",
          r"\bottomrule", r"\end{tabular}", r"\end{table}"]
    return "\n".join(L) + "\n"


def table_cost(e2: dict, baselines: dict, caption: str, label: str) -> str:
    """baselines : {"B0' theme only": {...}, "B1 TF-IDF": {...}, "B2 Legal-BERT": {...}} avec f1, precision, recall, f1_ci95 {low, high}, auc_pr."""
    L = [r"\begin{table}[t]", rf"\caption{{{caption}}}", rf"\label{{{label}}}", r"\centering", r"\footnotesize\setlength{\tabcolsep}{4pt}",
         r"\begin{tabular}{@{}lrrrrl@{}}", r"\toprule", r"System & P & R & $F_1$ [95\% CI] & AUC-PR & Decision cites a legal ground \\", r"\midrule"]
    # Cohérence avec STATS : les comparateurs sont ceux d'E2.json (thème seul LODO, B1/B2 = prédictions du Lab
    # sur la même population) ; `baselines` ne fournit que l'AUC-PR (et sert de repli si E2.json n'a pas la ligne).
    ru = e2["binary"]["rules_union"]
    rows = {"B0$'$ theme only (LODO)": ru.get("theme_only"), "B1 TF-IDF + LR": e2["binary"].get("B1"), "B2 Legal-BERT (fine-tuned)": e2["binary"].get("B2")}
    aucs = {k: v.get("auc_pr") for k, v in baselines.items()}
    for name, b in rows.items():
        key = name[:2]
        if b is None:
            b = next((v for k, v in baselines.items() if k.startswith(key)), None)
        if b is None:
            continue
        auc = b.get("auc_pr") or next((v for k, v in aucs.items() if k.startswith(key)), None)
        L.append(rf"{name} & {fmt(b['precision'])} & {fmt(b['recall'])} & {fmt(b['f1'])}{ci(b.get('f1_ci95'))} & {fmt(auc) if auc is not None else '---'} & no \\")
    L.append(rf"\textbf{{Frozen queries (union)}} & {fmt(ru['precision'])} & {fmt(ru['recall'])} & {fmt(ru['f1'])}{ci(ru['f1_ci95'])} & --- & \textbf{{yes}} (item + template) \\")
    L += [r"\bottomrule", r"\end{tabular}", r"\end{table}"]
    return "\n".join(L) + "\n"


def table_audit(audit: dict, caption: str, label: str) -> str:
    L = [r"\begin{table}[t]", rf"\caption{{{caption}}}", rf"\label{{{label}}}", r"\centering", r"\footnotesize",
         r"\begin{tabular}{@{}lrrrr@{}}", r"\toprule", r"Query & Correct & Arguable & Wrong & Flags \\", r"\midrule"]
    for rule, c in sorted(audit.get("by_rule", {}).items()):
        n = sum(c.values()); L.append(rf"{rule} & {c.get('correct', 0)} & {c.get('arguable', 0)} & {c.get('wrong', 0)} & {n} \\")
    L += [r"\midrule"]
    for v in ("correct", "arguable", "wrong"):
        w = audit.get(f"rate_{v}", {})
        L.append(rf"\emph{{Share {v}}} & \multicolumn{{4}}{{l}}{{{fmt(w.get('point'))} [{fmt(w.get('low'))};{fmt(w.get('high'))}], $n$={w.get('n')}}} \\")
    rm = audit.get("reference_missing_share_of_wrong", {})
    L.append(rf"\emph{{Wrong flags where the reference label is missing}} & \multicolumn{{4}}{{l}}{{{fmt(rm.get('point'))} [{fmt(rm.get('low'))};{fmt(rm.get('high'))}]}} \\")
    s = audit.get("sufficiency", {}).get("sufficient", {})
    L.append(rf"\emph{{Explanation judged sufficient}} & \multicolumn{{4}}{{l}}{{{fmt(s.get('point'))} [{fmt(s.get('low'))};{fmt(s.get('high'))}]}} \\")
    if audit.get("kappa_verdict") is not None:
        L.append(rf"\emph{{Inter-expert $\kappa$ (verdict, $n$={audit.get('n_common')})}} & \multicolumn{{4}}{{l}}{{{fmt(audit['kappa_verdict'])}}} \\")
    L += [r"\bottomrule", r"\end{tabular}", r"\end{table}"]
    return "\n".join(L) + "\n"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--table", choices=["queries", "cost", "audit"], required=True)
    ap.add_argument("--e2", type=Path, default=None); ap.add_argument("--audit", type=Path, default=None)
    ap.add_argument("--baselines-json", type=Path, default=None, help="JSON {name: {precision, recall, f1, f1_ci95, auc_pr}}")
    ap.add_argument("--caption", default=""); ap.add_argument("--label", default="")
    ap.add_argument("--out", type=Path, required=True)
    a = ap.parse_args(argv)
    if a.table == "queries":
        tex = table_queries(json.loads(a.e2.read_text()), a.caption or "Held-out evaluation of the frozen queries against CLAUDETTE labels.", a.label or "tab:queries")
    elif a.table == "cost":
        tex = table_cost(json.loads(a.e2.read_text()), json.loads(a.baselines_json.read_text()), a.caption or "The price of interpretability (held-out, sentence level, any unfairness label).", a.label or "tab:cost")
    else:
        tex = table_audit(json.loads(a.audit.read_text()), a.caption or "Expert audit of flagged sentences.", a.label or "tab:audit")
    a.out.parent.mkdir(parents=True, exist_ok=True); a.out.write_text(tex, encoding="utf-8"); print(tex); return 0


if __name__ == "__main__":
    raise SystemExit(main())

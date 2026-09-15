"""Tableaux T3 et T4 du papier 157, générés depuis UNE seule source : artifacts/evaluation/E2.json
(copie figée de legal-kg/results/evaluation/holdout-v02-pass0/E2.json, commit 0fb08e4 ; voir artifacts/MANIFEST.md).

Aucun chiffre n'est saisi à la main. T4 prend thème seul, B1, B2 et union dans le même bloc `binary`, donc les
écarts affichés sont exactement ceux que teste run_stats.py. Usage :
    make tables          (équivaut à : python3 tables/make_paper_tables.py artifacts/evaluation/E2.json)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
QUERY_LABEL = {"Q-g": "Q(g)", "Q-f-asymmetry": "Q(f)", "Q-j": "Q(j)", "Q-j-strict": "Q(j$'$)", "Q-j-absence": "Q(j)$_\\emptyset$",
               "Q-k": "Q(k)", "Q-l": "Q(l)", "Q-ab": "Q(a/b)", "Q-q": "Q(q)", "Q-i": "Q(i)"}


def f2(x):
    return "---" if x is None else f"{x:.2f}".replace("-", "$-$")


def ci(b):
    return "" if not b or b.get("low") is None else f" [{f2(b['low'])}; {f2(b['high'])}]"


def signed(x):
    return "---" if x is None else f"{x:+.2f}".replace("-", "$-$")


def t3(e2: dict) -> str:
    items = e2["items"]
    rows = []
    order = ["a", "b", "f", "g", "i", "j", "k", "l", "q"]
    by_code = {x["item"]: x for x in items} if isinstance(items, list) else items
    for code in order:
        it = by_code[code]
        th = it.get("theme_only") or {}
        ref = ",".join(it.get("categories", []))
        rows.append(f"({code}) & {ref} & {it['n_pos']} & {it['n_flagged']} & {f2(it['precision'])} & {f2(it['recall'])} & "
                    f"{f2(it['f1'])}{ci(it.get('f1_ci95'))} & {f2(th.get('f1'))} & {signed(it.get('delta_f1_vs_theme_only'))}{ci(it.get('delta_f1_ci95'))} \\\\")
    agg = e2["aggregate_structural"]
    unmapped = e2["items_unmapped"]
    um = unmapped if isinstance(unmapped, dict) else {x["item"]: x for x in unmapped}
    audit = "; ".join(f"({c}) {um[c]['n_flagged']}" for c in sorted(um))
    return "\n".join([
        r"\begin{table}[t]",
        r"\caption{Held-out retrieval per grey-list item (17 contracts, 4,078 sentences). $n_+$: sentences carrying a mapped \corpus{} label; P, R, $F_1$ at sentence level with document-level bootstrap 95\,\% CI; theme only: $\mathrm{P}(\text{label} \mid \text{theme})$ estimated leave-one-document-out; $\Delta F_1$: queries minus theme only. Items without a \corpus{} counterpart (flags: " + audit + r") are not scored. Last row: micro-average over the structural items, which excludes the procedural proxy (i); macro-$F_1$ in parentheses.}",
        r"\label{tab:queries}",
        r"\centering",
        r"\footnotesize\setlength{\tabcolsep}{2.1pt}%",
        r"\begin{tabular}{@{}llrrrrlrl@{}}",
        r"\toprule",
        r"Item & Ref. & $n_+$ & Flagged & P & R & $F_1$ [95\,\% CI] & Theme & $\Delta F_1$ [95\,\% CI] \\",
        r"\midrule",
        *rows,
        r"\midrule",
        f"Structural ({agg.get('n_items')}) & & & & {f2(agg.get('micro_precision'))} & {f2(agg.get('micro_recall'))} & {f2(agg.get('micro_f1'))} (macro {f2(agg.get('macro_f1'))}) & & {signed(agg.get('macro_delta_f1_vs_theme_only'))} \\\\",
        r"\bottomrule",
        r"\end{tabular}",
        r"\end{table}",
    ]) + "\n"


def t4(e2: dict) -> str:
    b = e2["binary"]
    u, th, b1, b2 = b["rules_union"], b["rules_union"]["theme_only"], b["B1"], b["B2"]
    def row(name, x, delta=None, cites="no"):
        return (f"{name} & {f2(x['precision'])} & {f2(x['recall'])} & {f2(x['f1'])}{ci(x.get('f1_ci95'))} & "
                f"{x.get('n_flagged', '---')} & {cites} \\\\")
    return "\n".join([
        r"\begin{table}[t]",
        r"\caption{The price of interpretability on the held-out sentences (any \corpus{} label, 440 positives among 4,078). All systems are scored by the same evaluation run; the learned models are trained on the 33 development contracts.}",
        r"\label{tab:cost}",
        r"\centering",
        r"\footnotesize\setlength{\tabcolsep}{4pt}%",
        r"\begin{tabular}{@{}lrrlrl@{}}",
        r"\toprule",
        r"System & P & R & $F_1$ [95\,\% CI] & Flagged & Cites a legal ground \\",
        r"\midrule",
        row("Theme only (leave-one-document-out)", th),
        row("TF-IDF + logistic regression", b1),
        row("Legal-BERT, fine-tuned", b2),
        row(r"\textbf{Frozen queries (union)}", u, cites=r"\textbf{yes}"),
        r"\bottomrule",
        r"\end{tabular}",
        r"\end{table}",
    ]) + "\n"


def main(argv: list[str]) -> int:
    e2 = json.loads(Path(argv[1]).read_text(encoding="utf-8"))
    (HERE / "T3_queries.tex").write_text(t3(e2), encoding="utf-8")
    (HERE / "T4_cost.tex").write_text(t4(e2), encoding="utf-8")
    print("T3_queries.tex, T4_cost.tex écrits depuis", argv[1])
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

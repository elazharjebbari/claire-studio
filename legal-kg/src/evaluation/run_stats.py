"""F8 — applique les tests pré-enregistrés aux lignes par phrase produites par evaluate_matches.py.

Sorties : STATS.json + STATS.md dans le même dossier. Tests : (1) par item mappé, permutation appariée par document
de F1(règles) − F1(thème seul), Holm sur la famille des items ; (2) binaire, règles ∪ vs chaque prédiction texte
(B1/B2) : permutation appariée + non-infériorité à δ = 0,05 (RQ3) ; (3) IC de Wilson sur les proportions utiles.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from stats import holm, noninferiority, paired_permutation_by_document, wilson


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--eval-dir", type=Path, required=True, help="dossier contenant sentences_eval.jsonl")
    ap.add_argument("--n-perm", type=int, default=10000)
    ap.add_argument("--n-boot", type=int, default=1000)
    ap.add_argument("--delta", type=float, default=0.05)
    a = ap.parse_args(argv)
    rows = [json.loads(l) for l in (a.eval_dir / "sentences_eval.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
    items = sorted(rows[0]["items"]) if rows else []
    out = {"n_sentences": len(rows), "n_documents": len({r["document"] for r in rows}), "per_item": {}, "binary": {}}
    pvals = {}
    for it in items:
        sub = [{"document": r["document"], "y_true": r["items"][it]["y_true"], "rules": r["items"][it]["rules"], "theme_only": r["items"][it]["theme_only"]} for r in rows]
        n_pos = sum(1 for r in sub if r["y_true"])
        res = paired_permutation_by_document(sub, "rules", "theme_only", n=a.n_perm)
        res["n_pos"] = n_pos; res["conclusive"] = n_pos >= 30
        out["per_item"][it] = res; pvals[it] = res["p_value"]
    out["holm_items"] = holm(pvals) if pvals else {}
    systems = [k for k in rows[0]["any"] if k not in ("y_true", "rules")] if rows else []
    for sysname in systems:
        sub = [{"document": r["document"], "y_true": r["any"]["y_true"], "rules": r["any"]["rules"], sysname: r["any"][sysname]} for r in rows]
        if not any(r[sysname] for r in sub):
            out["binary"][sysname] = {"note": "aucune prédiction positive dans l'univers"}; continue
        out["binary"][sysname] = {"permutation": paired_permutation_by_document(sub, "rules", sysname, n=a.n_perm),
                                  "noninferiority": noninferiority(sub, "rules", sysname, delta=a.delta, n_boot=a.n_boot)}
    n_flag = sum(1 for r in rows if r["any"]["rules"]); n_flag_pos = sum(1 for r in rows if r["any"]["rules"] and r["any"]["y_true"])
    out["wilson_precision_rules_union"] = wilson(n_flag_pos, n_flag)
    (a.eval_dir / "STATS.json").write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    L = [f"# Tests pré-enregistrés — {a.eval_dir.name} ({out['n_sentences']} phrases, {out['n_documents']} documents)", "",
         "| Item | n_pos | ΔF1 règles − thème seul | p (perm.) | p Holm | rejet | concluant |", "|---|---|---|---|---|---|---|"]
    for it, r in out["per_item"].items():
        h = out["holm_items"].get(it, {})
        L.append(f"| {it} | {r['n_pos']} | {r['observed_diff']} | {r['p_value']} | {h.get('p_holm')} | {h.get('reject_at_0.05')} | {'oui' if r['conclusive'] else 'non'} |")
    L += ["", "## Binaire : règles ∪ vs texte seul", ""]
    for sysname, r in out["binary"].items():
        if "note" in r:
            L.append(f"- {sysname} : {r['note']}"); continue
        L.append(f"- **{sysname}** : ΔF1 {r['permutation']['observed_diff']} (p {r['permutation']['p_value']}) ; non-infériorité δ={a.delta} : IC {r['noninferiority']['ci95']} → {'OUI' if r['noninferiority']['noninferior'] else 'NON'}")
    w = out["wilson_precision_rules_union"]
    L += ["", f"Précision des règles ∪ (Wilson) : {w['point']} [{w['low']} ; {w['high']}] (k={w.get('k')}, n={w['n']})"]
    (a.eval_dir / "STATS.md").write_text("\n".join(L) + "\n", encoding="utf-8"); print("\n".join(L)); return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Feuille de validation juriste : une ligne par norme proposée, avec les phrases de la clause, les champs
extraits et les colonnes de décision (validate / correct / reject) à remplir. Sortie CSV (tableur) + Markdown.

La proposition soumise est la passe `--repeat` (0 par défaut, déclarée avant lecture des résultats) ; les autres
passes servent uniquement à marquer `unstable` les clauses dont les signatures décisives diffèrent d'une passe à
l'autre, pour orienter l'attention des relecteurs. Aucune information d'abusivité n'apparaît dans la feuille.

Le retour des juristes se réinjecte en jsonl « validé » (statut `validated`, `validated_by`, `validated_at`) lisible
par ingest_norms.py et run_rules.py ; voir `--merge` (à venir quand les fiches remplies existeront).
"""
from __future__ import annotations

import argparse
import csv
import json
from collections import defaultdict
from pathlib import Path

DECISIVE = ("actor", "modality", "action", "condition", "notice", "remedy")
COLUMNS = ["clause_id", "document", "theme_T11", "stability", "norm_no", "actor", "counterparty", "modality", "action",
           "object", "condition", "notice", "notice_duration_days", "remedy", "amount_ratio", "opt_out_deadline_days",
           "evidence", "confidence", "anchoring_flags", "decision", "corrected_fields", "reviewer_note", "reviewer", "date"]


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def signatures(rows_by_repeat: dict[int, dict]) -> dict[int, set]:
    return {k: {tuple(n[f] for f in DECISIVE) for n in o["norms"]} for k, o in rows_by_repeat.items()}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Feuille de validation juriste des templates proposés.")
    ap.add_argument("--clauses", type=Path, required=True)
    ap.add_argument("--extraction", type=Path, required=True, help="step_5_corrected.jsonl (1 ou plusieurs répétitions)")
    ap.add_argument("--repeat", type=int, default=0, help="passe soumise à validation (déclarée a priori)")
    ap.add_argument("--out", type=Path, required=True, help="dossier de sortie (CSV + MD)")
    args = ap.parse_args(argv)

    clauses = {c["clause_id"]: c for c in read_jsonl(args.clauses)}
    per_clause: dict[str, dict[int, dict]] = defaultdict(dict)
    flags_by: dict[tuple[str, int], list] = {}
    for r in read_jsonl(args.extraction):
        if r.get("output") is not None:
            per_clause[r["clause_id"]][int(r["repeat"])] = r["output"]
            flags_by[(r["clause_id"], int(r["repeat"]))] = r.get("anchoring_flags", [])

    args.out.mkdir(parents=True, exist_ok=True)
    rows, md = [], ["# Feuille de validation des templates — passe %d" % args.repeat, "",
                    "Pour chaque norme : `decision` ∈ {validate, correct, reject}. Si `correct`, indiquer les champs corrigés "
                    "sous la forme `champ=valeur; champ=valeur`. Une norme manquante s'ajoute en fin de clause avec `decision=add`.",
                    "Vocabulaires : actor {provider,user,third_party} · modality {obligation,permission,prohibition,power} · "
                    "condition {for_cause,specified_reason,discretion,none_stated} · notice {duration,reasonable,none,not_stated} · "
                    "remedy {refund,right_to_cancel,compensation,none,not_stated}. `not_stated` ≠ `none`.", ""]
    n_unstable = 0
    for cid, clause in clauses.items():
        outs = per_clause.get(cid, {})
        if args.repeat not in outs:
            continue
        sigs = signatures(outs)
        stable = len({frozenset(s) for s in sigs.values()}) == 1 if len(sigs) > 1 else None
        stability = "n/a" if stable is None else ("stable" if stable else "unstable")
        n_unstable += stability == "unstable"
        out = outs[args.repeat]
        flags = flags_by.get((cid, args.repeat), [])
        md += [f"## {cid}  ·  thème {clause['theme_T11']}  ·  {stability}", ""]
        md += [f"[{i}] {s['text']}" for i, s in enumerate(clause["sentences"])] + [""]
        if not out["norms"]:
            md += [f"*Aucune norme proposée* (`no_norm_reason={out.get('no_norm_reason')}`) — decision : ______", ""]
            rows.append({"clause_id": cid, "document": clause["document"], "theme_T11": clause["theme_T11"], "stability": stability,
                         "norm_no": "", "action": f"(no_norm_reason={out.get('no_norm_reason')})", "decision": ""})
            continue
        md += ["| # | actor | modality | action | object | condition | notice | remedy | evidence | conf. | ancrage | decision |",
               "|---|---|---|---|---|---|---|---|---|---|---|---|"]
        for k, n in enumerate(out["norms"]):
            nflags = ";".join(f"{f['field']}→{f['value']}" for f in flags if f["norm"] == k)
            rows.append({"clause_id": cid, "document": clause["document"], "theme_T11": clause["theme_T11"], "stability": stability,
                         "norm_no": k, **{f: n.get(f) for f in ("actor", "counterparty", "modality", "action", "object", "condition",
                                                                  "notice", "notice_duration_days", "remedy", "amount_ratio",
                                                                  "opt_out_deadline_days", "confidence")},
                         "evidence": " ".join(map(str, n["evidence"])), "anchoring_flags": nflags, "decision": ""})
            md.append(f"| {k} | {n['actor']} | {n['modality']} | {n['action']} | {n.get('object') or ''} | {n['condition']} | "
                      f"{n['notice']}{(' (' + str(n.get('notice_duration_days')) + ' j)') if n.get('notice_duration_days') else ''} | "
                      f"{n['remedy']} | {' '.join(map(str, n['evidence']))} | {n['confidence']:.2f} | {nflags} | ______ |")
        md.append("")
    with (args.out / "validation_sheet.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=COLUMNS)
        w.writeheader()
        for r in rows:
            w.writerow({c: ("" if r.get(c) is None else r.get(c)) for c in COLUMNS})
    (args.out / "validation_sheet.md").write_text("\n".join(md), encoding="utf-8")
    summary = {"clauses": sum(1 for c in clauses if args.repeat in per_clause.get(c, {})), "norm_rows": sum(1 for r in rows if r["norm_no"] != ""),
               "unstable_clauses": n_unstable, "repeat": args.repeat, "out": str(args.out)}
    print(json.dumps(summary, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

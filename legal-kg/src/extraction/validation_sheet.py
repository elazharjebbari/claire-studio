"""Feuille de validation juriste : une ligne par norme proposée, avec les phrases de la clause, les champs
extraits et les colonnes de décision (validate / correct / reject) à remplir. Sortie CSV (tableur) + Markdown.

La proposition soumise est la passe `--repeat` (0 par défaut, déclarée avant lecture des résultats) ; les autres
passes servent uniquement à marquer `unstable` les clauses dont les signatures décisives diffèrent d'une passe à
l'autre, pour orienter l'attention des relecteurs. Aucune information d'abusivité n'apparaît dans la feuille.

Le retour des juristes (CSV rempli) se réinjecte par la sous-commande `merge` en jsonl « validé » (statut `validated`,
`validated_by`, `validated_at`, `validation_note`) lisible par ingest_norms.py et run_rules.py : `validate` garde la norme,
`correct` applique `corrected_fields` (`champ=valeur; …`), `reject` la retire, `add` (ligne sans `norm_no`, champs remplis)
en ajoute une. Une clause dont une ligne n'a pas de décision reste `proposed` (non ingérée en `validated`).
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
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


FIELD_TYPES = {"notice_duration_days": int, "opt_out_deadline_days": int, "amount_ratio": float, "confidence": float}
VOCAB = {"actor": {"provider", "user", "third_party"}, "counterparty": {"provider", "user", "third_party"},
         "modality": {"obligation", "permission", "prohibition", "power"},
         "condition": {"for_cause", "specified_reason", "discretion", "none_stated"},
         "notice": {"duration", "reasonable", "none", "not_stated"},
         "remedy": {"refund", "right_to_cancel", "compensation", "none", "not_stated"}}


def parse_corrections(text: str) -> dict:
    out = {}
    for part in (text or "").split(";"):
        if "=" not in part:
            continue
        key, val = (x.strip() for x in part.split("=", 1))
        if key in VOCAB and val not in VOCAB[key]:
            raise ValueError(f"valeur hors vocabulaire : {key}={val}")
        if key in FIELD_TYPES:
            val = FIELD_TYPES[key](val) if val not in ("", "null", "None") else None
        elif key == "evidence":
            val = [int(x) for x in val.replace(",", " ").split()]
        elif val in ("", "null", "None"):
            val = None
        out[key] = val
    return out


def merge(clauses: dict[str, dict], extraction_rows: list[dict], sheet_rows: list[dict], repeat: int, validated_at: str) -> list[dict]:
    """Applique les décisions du CSV à la passe `repeat` ; renvoie les lignes jsonl validées (une par clause décidée)."""
    base = {r["clause_id"]: r for r in extraction_rows if int(r.get("repeat", 0)) == repeat and r.get("output") is not None}
    by_clause: dict[str, list[dict]] = defaultdict(list)
    for r in sheet_rows:
        by_clause[r["clause_id"]].append(r)
    out, skipped = [], []
    for cid, decisions in by_clause.items():
        if cid not in base:
            continue
        if any(d["decision"].strip() == "" for d in decisions):
            skipped.append(cid)
            continue
        norms = [dict(n) for n in base[cid]["output"]["norms"]]
        keep, added = {}, []
        for d in decisions:
            dec = d["decision"].strip().lower()
            if d["norm_no"] != "":
                k = int(d["norm_no"])
                if dec == "validate":
                    keep[k] = norms[k]
                elif dec == "correct":
                    keep[k] = {**norms[k], **parse_corrections(d.get("corrected_fields", ""))}
                elif dec == "reject":
                    continue
                else:
                    raise ValueError(f"{cid} norme {k} : décision inconnue {dec!r}")
            elif dec == "add":
                new = {"object": None, "counterparty": None, "notice_duration_days": None, "amount_ratio": None,
                       "opt_out_deadline_days": None, "confidence": 1.0, "evidence": [0]}
                new.update(parse_corrections(d.get("corrected_fields", "")))
                for f in ("actor", "modality", "action", "condition", "notice", "remedy"):
                    if f in d and d[f]:
                        new[f] = d[f]
                added.append(new)
            elif dec in ("validate", "reject"):
                pass                      # ligne « aucune norme » validée/rejetée : rien à ajouter
            else:
                raise ValueError(f"{cid} : décision inconnue {dec!r} sur une ligne sans norme")
        final = [keep[k] for k in sorted(keep)] + added
        reviewers = sorted({d.get("reviewer", "").strip() for d in decisions if d.get("reviewer", "").strip()})
        notes = "; ".join(d["reviewer_note"].strip() for d in decisions if d.get("reviewer_note", "").strip())
        row = {**base[cid], "status": "validated", "validated_by": ",".join(reviewers) or "unknown", "validated_at": validated_at,
               "validation_note": notes, "output": {**base[cid]["output"], "norms": final,
                                                    "no_norm_reason": base[cid]["output"].get("no_norm_reason") if not final else None}}
        out.append(row)
    if skipped:
        print(json.dumps({"skipped_without_decision": skipped}, ensure_ascii=False))
    return out


def cmd_merge(args: argparse.Namespace) -> int:
    from datetime import datetime, timezone
    clauses = {c["clause_id"]: c for c in read_jsonl(args.clauses)}
    sheet = list(csv.DictReader(args.sheet.open(encoding="utf-8")))
    validated = merge(clauses, read_jsonl(args.extraction), sheet, args.repeat,
                      args.validated_at or datetime.now(timezone.utc).isoformat(timespec="seconds"))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in validated), encoding="utf-8")
    print(json.dumps({"validated_clauses": len(validated), "norms": sum(len(r["output"]["norms"]) for r in validated),
                      "out": str(args.out)}, ensure_ascii=False))
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Feuille de validation juriste des templates proposés.")
    sub = ap.add_subparsers(dest="cmd")
    mg = sub.add_parser("merge", help="réinjecter un CSV rempli en jsonl validé")
    mg.add_argument("--clauses", type=Path, required=True)
    mg.add_argument("--extraction", type=Path, required=True)
    mg.add_argument("--sheet", type=Path, required=True)
    mg.add_argument("--repeat", type=int, default=0)
    mg.add_argument("--validated-at", default=None)
    mg.add_argument("--out", type=Path, required=True)
    mg.set_defaults(func=cmd_merge)
    if argv is None:
        argv = sys.argv[1:]
    if argv and argv[0] == "merge":
        args = ap.parse_args(argv)
        return args.func(args)
    ap = argparse.ArgumentParser(description="Feuille de validation juriste des templates proposés (génération).")
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

"""Ingestion L3 (normes) et L5 (appariements MATCHES_ITEM) — CSV pour Memgraph + Cypher de chargement.

Entrées : clauses (jsonl de build_clause_set), extraction (jsonl step 5 corrigé ou jsonl validé, une ligne par
(clause, repeat)), optionnellement matches.jsonl (sortie de detection/run_rules.py). Sortie : un dossier de CSV
(`norms.csv`, `norm_evidence.csv`, `norm_relations.csv`, `matches.csv`, `activities.csv`, `run.csv`, INGEST.json)
chargeable par graph/cypher/05_ingest_norms.cypher.

Règles : (i) une seule ligne d'extraction par clause est ingérée — `--select validated` (statut `validated` seulement,
défaut) ou `--select repeat:N` ; (ii) les identifiants suivent NAMING.md ; (iii) rien ici ne lit la référence
CLAUDETTE (couche L4 isolée) ; (iv) tout est rattaché à un `Run` (provenance).
"""
from __future__ import annotations

import argparse
import csv
import json
import subprocess
import uuid
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from detection.rules.model import NormRecord, norm_id_for, norms_from_extraction

ROOT = Path(__file__).resolve().parents[2]
NORM_FIELDS = ["id", "clause_id", "document_id", "actor", "counterparty", "modality", "action", "object", "condition",
               "notice", "remedy", "status", "source", "confidence", "amount_ratio", "opt_out_deadline_days",
               "notice_duration_days", "run_id"]


def read_jsonl(p: Path) -> list[dict]:
    return [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines() if l.strip()]


def write_csv(path: Path, rows: list[dict], fields: list[str]) -> int:
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        for r in rows:
            w.writerow({k: ("" if r.get(k) is None else r.get(k)) for k in fields})
    return len(rows)


def select_rows(rows: list[dict], select: str) -> list[dict]:
    """Une ligne par clause : `validated` (statut validé) ou `repeat:N`."""
    if select == "validated":
        chosen = [r for r in rows if r.get("status") == "validated"]
    elif select.startswith("repeat:"):
        n = int(select.split(":", 1)[1])
        chosen = [r for r in rows if int(r.get("repeat", 0)) == n]
    else:
        raise SystemExit(f"--select inconnu : {select}")
    seen, out = set(), []
    for r in chosen:
        if r["clause_id"] in seen:
            raise SystemExit(f"plusieurs lignes retenues pour {r['clause_id']} : préciser --select repeat:N")
        seen.add(r["clause_id"])
        out.append(r)
    return out


def git_sha() -> str:
    try:
        return subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    except Exception:
        return ""


def build(clauses: dict[str, dict], rows: list[dict], *, source: str, run_id: str, matches: list[dict] | None,
          relations: list[dict] | None) -> dict[str, list[dict]]:
    norms: list[NormRecord] = norms_from_extraction(rows, clauses)
    conf_by_norm = {}
    for r in rows:
        for k, n in enumerate((r.get("output") or {}).get("norms", [])):
            conf_by_norm[norm_id_for(r["clause_id"], k)] = n.get("confidence")
    norm_rows = [{
        "id": n.norm_id, "clause_id": n.clause_id, "document_id": f"document:{n.document}", "actor": n.actor,
        "counterparty": n.counterparty, "modality": n.modality, "action": n.action, "object": n.object,
        "condition": n.condition, "notice": n.notice, "remedy": n.remedy, "status": n.status, "source": source,
        "confidence": conf_by_norm.get(n.norm_id), "amount_ratio": n.amount_ratio,
        "opt_out_deadline_days": n.opt_out_deadline_days, "notice_duration_days": n.notice_duration_days, "run_id": run_id,
    } for n in norms]
    evidence_rows = [{"norm_id": n.norm_id, "sentence_id": s} for n in norms for s in n.sentence_ids]
    known = {n.norm_id for n in norms}
    relation_rows = []
    for rel in relations or []:
        if rel["from_id"] in known and rel["to_id"] in known and rel["type"] in ("EXCEPTION_TO", "CONDITIONAL_ON"):
            relation_rows.append({"from_id": rel["from_id"], "to_id": rel["to_id"], "type": rel["type"], "run_id": run_id})
    match_rows = []
    for m in matches or []:
        if m["norm_id"] not in known:
            continue
        match_rows.append({"norm_id": m["norm_id"], "item": m["item"], "rule_id": m["rule_id"], "family": m.get("family", ""),
                           "rule_version": m.get("rule_version", ""), "rules_sha256": m.get("rules_sha256", ""),
                           "evidence_ids": "|".join(f"sentence:{m['document']}:{i}" for i in m.get("evidence", [])),
                           "run_id": m.get("run_id", run_id)})
    activity_rows = []
    for r in rows:
        if r.get("status") == "validated" and (r.get("validated_by") or r.get("validated_at")):
            for k, _ in enumerate((r.get("output") or {}).get("norms", [])):
                activity_rows.append({"id": f"activity:{r['clause_id']}:{k}:{r.get('validated_by', 'unknown')}",
                                      "norm_id": norm_id_for(r["clause_id"], k), "actor": r.get("validated_by", ""),
                                      "at": r.get("validated_at", ""), "kind": "validation", "note": r.get("validation_note", "")})
    return {"norms": norm_rows, "norm_evidence": evidence_rows, "norm_relations": relation_rows, "matches": match_rows,
            "activities": activity_rows}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Ingestion L3/L5 : templates → CSV Memgraph.")
    ap.add_argument("--clauses", type=Path, required=True)
    ap.add_argument("--extraction", type=Path, required=True)
    ap.add_argument("--matches", type=Path, default=None, help="matches.jsonl de detection/run_rules.py (optionnel)")
    ap.add_argument("--relations", type=Path, default=None, help="jsonl {from_id,to_id,type} EXCEPTION_TO/CONDITIONAL_ON (optionnel)")
    ap.add_argument("--select", default="validated", help="validated (défaut) | repeat:N")
    ap.add_argument("--source", default="llm", help="valeur de Norm.source (ex. llm:claude-opus-5, human)")
    ap.add_argument("--run-id", default=None)
    ap.add_argument("--out", type=Path, default=None)
    a = ap.parse_args(argv)

    run_id = a.run_id or str(uuid.uuid4())
    clauses = {c["clause_id"]: c for c in read_jsonl(a.clauses)}
    rows = select_rows(read_jsonl(a.extraction), a.select)
    matches = read_jsonl(a.matches) if a.matches else None
    if matches is not None:
        for m in matches:
            m.setdefault("rule_version", "")
    relations = read_jsonl(a.relations) if a.relations else None
    tables = build(clauses, rows, source=a.source, run_id=run_id, matches=matches, relations=relations)

    out = a.out or ROOT / "graph" / "export" / "norms" / run_id
    out.mkdir(parents=True, exist_ok=True)
    counts = {
        "norms": write_csv(out / "norms.csv", tables["norms"], NORM_FIELDS),
        "norm_evidence": write_csv(out / "norm_evidence.csv", tables["norm_evidence"], ["norm_id", "sentence_id"]),
        "norm_relations": write_csv(out / "norm_relations.csv", tables["norm_relations"], ["from_id", "to_id", "type", "run_id"]),
        "matches": write_csv(out / "matches.csv", tables["matches"],
                             ["norm_id", "item", "rule_id", "family", "rule_version", "rules_sha256", "evidence_ids", "run_id"]),
        "activities": write_csv(out / "activities.csv", tables["activities"], ["id", "norm_id", "actor", "at", "kind", "note"]),
    }
    write_csv(out / "run.csv", [{"id": run_id, "kind": "norm_ingest", "started_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                                 "code_version": git_sha(), "source": a.source, "select": a.select}],
              ["id", "kind", "started_at", "code_version", "source", "select"])
    summary = {"run_id": run_id, "counts": counts, "clauses_ingested": len(rows), "clauses_without_norm": sum(1 for r in rows if not (r.get("output") or {}).get("norms")),
               "by_action": dict(Counter(n["action"] for n in tables["norms"])), "by_status": dict(Counter(n["status"] for n in tables["norms"])),
               "inputs": {"clauses": str(a.clauses), "extraction": str(a.extraction), "matches": str(a.matches) if a.matches else None},
               "cypher": "graph/cypher/05_ingest_norms.cypher (monter ce dossier sous /import/norms)"}
    (out / "INGEST.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

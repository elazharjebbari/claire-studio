"""E2 — Exécution des règles gelées sur des templates extraits (sans Memgraph).

Entrées : clauses (jsonl de build_clause_set) + sorties d'extraction (step_5_corrected.jsonl ou jsonl validé
portant `status`). Sorties : matches.jsonl (une ligne par appariement, avec evidence et champs satisfaits),
sentence_items.jsonl (projection (document, index) → items), SUMMARY.json. Sur `--population holdout`, le
fichier de règles DOIT être gelé (FROZEN.txt) sinon refus. Aucune lecture de la référence d'abusivité ici :
la comparaison relève de src/evaluation.
"""
from __future__ import annotations

import argparse
import json
import uuid
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from detection.rules import evaluate_rules, load_rules
from detection.rules.evaluate import project_to_sentences
from detection.rules.model import norms_from_extraction

ROOT = Path(__file__).resolve().parents[2]


def read_jsonl(p: Path) -> list[dict]:
    return [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines() if l.strip()]


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Applique les règles de la grey list à des templates extraits.")
    ap.add_argument("--clauses", type=Path, required=True)
    ap.add_argument("--extraction", type=Path, required=True, help="jsonl step 5 (ou validé) avec `output.norms`")
    ap.add_argument("--population", choices=["design", "holdout"], required=True)
    ap.add_argument("--statuses", default="validated", help="statuts de normes admis, séparés par des virgules (ablation : proposed)")
    ap.add_argument("--projection", choices=["evidence_only", "whole_clause"], default="evidence_only")
    ap.add_argument("--out", type=Path, default=None)
    a = ap.parse_args(argv)

    rules = load_rules(population=a.population)               # lève RulesError si non gelé sur holdout
    clauses = {c["clause_id"]: c for c in read_jsonl(a.clauses)}
    rows = read_jsonl(a.extraction)
    norms = norms_from_extraction(rows, clauses)
    statuses = tuple(s.strip() for s in a.statuses.split(","))
    matches = evaluate_rules(rules, norms, statuses=statuses)
    proj = project_to_sentences(matches, clauses, mode=a.projection)

    run_id = str(uuid.uuid4())
    out = a.out or ROOT / "results" / "rules" / run_id
    out.mkdir(parents=True, exist_ok=True)
    with (out / "matches.jsonl").open("w", encoding="utf-8") as f:
        for m in matches:
            f.write(json.dumps(m.__dict__, ensure_ascii=False) + "\n")
    with (out / "sentence_items.jsonl").open("w", encoding="utf-8") as f:
        for (doc, idx), items in sorted(proj.items()):
            f.write(json.dumps({"document": doc, "index": idx, "items": sorted(items)}, ensure_ascii=False) + "\n")
    summary = {
        "run_id": run_id, "created_at": datetime.now(timezone.utc).isoformat(), "population": a.population,
        "rules_path": rules["_path"], "rules_version": rules["version"], "rules_sha256": rules["_sha256"],
        "rules_frozen": bool(rules["_frozen"]), "statuses": statuses, "projection": a.projection,
        "n_clauses": len(clauses), "n_extraction_rows": len(rows), "n_norms": len(norms),
        "n_norms_in_scope": sum(n.status in statuses for n in norms),
        "n_matches": len(matches), "n_sentences_flagged": len(proj),
        "matches_by_rule": dict(Counter(m.rule_id for m in matches)),
        "matches_by_item": dict(Counter(m.item for m in matches)),
    }
    (out / "SUMMARY.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

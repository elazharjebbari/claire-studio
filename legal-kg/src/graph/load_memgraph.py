"""Chargement réel dans Memgraph (Bolt) + parité Python ↔ Cypher du moteur de règles.

Pré-requis : une instance Memgraph avec l'export L1/L2/L4 monté sur /import et l'export L3 sur /import/norms, ex. :

    docker run -d --name memgraph -p 7687:7687 \\
      -v $PWD/graph/export/7116e627/<run>:/import:ro -v $PWD/graph/export/norms/<run>:/import/norms:ro \\
      memgraph/memgraph:latest --log-level=WARNING

Étapes : (1) schéma (contraintes, index, vocabulaires) ; (2) 01_ingest (L1/L2/L4) ; (3) 05_ingest_norms (L3/L5) ;
(4) 04_rules_compiled.cypher avec $run_id/$status → appariements Cypher ; (5) évaluateur Python sur les MÊMES normes
(norms.csv + norm_evidence.csv + thèmes) → appariements Python ; (6) rapport de parité (ensembles (règle, norme, item)
et evidence). La couche LABELED est chargée (L4) mais jamais lue par les règles : le rapport vérifie qu'aucune
requête de 04 ne la mentionne (relint) avant exécution.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import time
import uuid
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from neo4j import GraphDatabase

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src"))
from detection.rules import evaluate_rules, load_rules  # noqa: E402
from detection.rules.loader import lint_rules_text  # noqa: E402
from detection.rules.model import NormRecord  # noqa: E402


def statements(path: Path) -> list[str]:
    body = "\n".join(l for l in path.read_text(encoding="utf-8").splitlines() if not l.strip().startswith("//"))
    return [s.strip() for s in body.split(";") if s.strip()]


def run_file(session, path: Path, params: dict | None = None, collect: bool = False) -> list[dict]:
    rows = []
    for st in statements(path):
        t0 = time.time()
        res = session.run(st, params or {})
        data = [r.data() for r in res] if collect else list(res)
        rows += data if collect else []
        print(f"  ok {time.time() - t0:5.1f}s  {st.splitlines()[0][:90]}")
    return rows


def counts(session) -> dict:
    labels = session.run("MATCH (n) RETURN labels(n)[0] AS l, count(*) AS c ORDER BY c DESC").data()
    rels = session.run("MATCH ()-[r]->() RETURN type(r) AS t, count(*) AS c ORDER BY c DESC").data()
    return {"nodes": {r["l"]: r["c"] for r in labels}, "relationships": {r["t"]: r["c"] for r in rels}}


def norms_from_csv(norms_dir: Path, status: str) -> list[NormRecord]:
    ev = {}
    for r in csv.DictReader((norms_dir / "norm_evidence.csv").open(encoding="utf-8")):
        ev.setdefault(r["norm_id"], []).append(int(r["sentence_id"].rsplit(":", 1)[1]))
    theme = {r["clause_id"]: r["theme_key"].split("@")[0] for r in csv.DictReader((norms_dir / "clause_themes.csv").open(encoding="utf-8")) if r["role"] == "primary"}
    rel = []
    for r in csv.DictReader((norms_dir / "norm_relations.csv").open(encoding="utf-8")):
        rel.append(r)
    out = []
    for r in csv.DictReader((norms_dir / "norms.csv").open(encoding="utf-8")):
        f = lambda k: (r[k] if r[k] != "" else None)
        out.append(NormRecord(norm_id=r["id"], clause_id=r["clause_id"], document=r["document_id"].split(":", 1)[1], theme_T11=theme.get(r["clause_id"], ""),
                              actor=r["actor"], modality=r["modality"], action=r["action"], condition=r["condition"], notice=r["notice"], remedy=r["remedy"],
                              object=f("object"), counterparty=f("counterparty"), status=r["status"], evidence=sorted(ev.get(r["id"], [])),
                              amount_ratio=float(r["amount_ratio"]) if r["amount_ratio"] else None,
                              opt_out_deadline_days=int(r["opt_out_deadline_days"]) if r["opt_out_deadline_days"] else None,
                              notice_duration_days=int(r["notice_duration_days"]) if r["notice_duration_days"] else None,
                              related=[(x["type"], x["to_id"]) for x in rel if x["from_id"] == r["id"]]))
    return out


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--bolt", default="bolt://localhost:7687")
    ap.add_argument("--norms", type=Path, required=True, help="dossier export L3 (celui monté sur /import/norms)")
    ap.add_argument("--status", default="proposed", help="statut des normes évaluées : validated | proposed")
    ap.add_argument("--population", default="design", choices=["design", "holdout"])
    ap.add_argument("--reset", action="store_true", help="vide la base avant chargement")
    ap.add_argument("--skip-load", action="store_true", help="ne recharge pas L1–L3 (déjà en base)")
    ap.add_argument("--out", type=Path, default=None)
    a = ap.parse_args(argv)

    rules = load_rules(population=a.population)
    compiled = ROOT / "graph" / "cypher" / "04_rules_compiled.cypher"
    leaks = lint_rules_text(compiled.read_text(encoding="utf-8"))
    if leaks:
        raise SystemExit(f"04_rules_compiled.cypher non étanche : {leaks}")
    run_id = str(uuid.uuid4())
    out = a.out or ROOT / "results" / "parity" / run_id
    out.mkdir(parents=True, exist_ok=True)

    driver = GraphDatabase.driver(a.bolt, auth=None)
    with driver.session() as s:
        if a.reset:
            s.run("MATCH (n) DETACH DELETE n")
            print("base vidée")
        if not a.skip_load:
            print("== schéma"); run_file(s, ROOT / "graph" / "schema" / "memgraph_schema.cypher")
            print("== L1/L2/L4"); run_file(s, ROOT / "graph" / "cypher" / "01_ingest.cypher")
            print("== L3/L5"); run_file(s, ROOT / "graph" / "cypher" / "05_ingest_norms.cypher")
        before = counts(s)
        print("== règles compilées (Cypher)")
        cy_rows = run_file(s, compiled, {"run_id": run_id, "status": a.status}, collect=True)
        after = counts(s)
        # relire les MATCHES_ITEM de ce run (source de vérité côté graphe)
        cy = s.run("MATCH (n:Norm)-[m:MATCHES_ITEM {run_id: $run_id}]->(i:AnnexItem) RETURN m.rule_id AS rule_id, n.id AS norm_id, i.code AS item, m.evidence_ids AS evidence",
                   {"run_id": run_id}).data()
    driver.close()

    py = evaluate_rules(rules, norms_from_csv(a.norms, a.status), statuses=(a.status,))
    py_set = {(m.rule_id, m.norm_id, m.item) for m in py}
    cy_set = {(r["rule_id"], r["norm_id"], r["item"]) for r in cy}
    py_ev = {(m.rule_id, m.norm_id): sorted(f"sentence:{m.document}:{i}" for i in m.evidence) for m in py}
    cy_ev = {(r["rule_id"], r["norm_id"]): sorted(r["evidence"] or []) for r in cy}
    ev_diff = [k for k in py_ev if k in cy_ev and py_ev[k] != cy_ev[k]]
    report = {
        "run_id": run_id, "created_at": datetime.now(timezone.utc).isoformat(), "bolt": a.bolt, "norms_dir": str(a.norms), "status": a.status,
        "rules_version": rules["version"], "rules_sha256": rules["_sha256"], "rules_frozen": bool(rules["_frozen"]),
        "graph_counts_before_rules": before, "graph_counts_after_rules": after,
        "python_matches": len(py_set), "cypher_matches": len(cy_set), "agree": len(py_set & cy_set),
        "only_python": sorted(py_set - cy_set), "only_cypher": sorted(cy_set - py_set), "evidence_mismatch": ev_diff,
        "by_rule_python": dict(Counter(m.rule_id for m in py)), "by_rule_cypher": dict(Counter(r["rule_id"] for r in cy)),
        "parity": not (py_set ^ cy_set) and not ev_diff,
    }
    (out / "PARITY.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    md = [f"# Parité Python ↔ Cypher — run {run_id}", "",
          f"Règles v{rules['version']} (sha256 {rules['_sha256'][:12]}…, gelées : {report['rules_frozen']}), statut `{a.status}`, export L3 `{a.norms.name}`.", "",
          f"| | Python | Cypher | accord |", "|---|---|---|---|", f"| appariements | {len(py_set)} | {len(cy_set)} | {report['agree']} |", "",
          f"**Parité : {'OUI' if report['parity'] else 'NON'}** — seulement Python : {len(report['only_python'])} ; seulement Cypher : {len(report['only_cypher'])} ; evidence divergente : {len(ev_diff)}.", "",
          "| règle | Python | Cypher |", "|---|---|---|"]
    for rid in sorted(set(report["by_rule_python"]) | set(report["by_rule_cypher"])):
        md.append(f"| {rid} | {report['by_rule_python'].get(rid, 0)} | {report['by_rule_cypher'].get(rid, 0)} |")
    md += ["", "## Graphe après chargement", "", "```", json.dumps(after, indent=1), "```"]
    (out / "PARITY.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print("\n".join(md))
    return 0 if report["parity"] else 1


if __name__ == "__main__":
    raise SystemExit(main())

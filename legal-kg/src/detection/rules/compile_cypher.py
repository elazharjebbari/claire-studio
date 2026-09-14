"""Compilation des règles YAML en Cypher Memgraph (même sémantique que evaluate.py).
Les relations d'exception (`related`) ne sont émises que si le graphe les porte (EXCEPTION_TO / CONDITIONAL_ON)."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
FIELDS = ("actor", "modality", "action", "condition", "notice", "remedy")


def _lit(v):
    return json.dumps(v, ensure_ascii=False)


def _norm_conditions(alias: str, spec: dict) -> list[str]:
    conds = []
    for f in FIELDS:
        if f in spec:
            v = spec[f]
            if f == "actor":
                conds.append(f"EXISTS {{ MATCH ({alias})-[:HAS_ACTOR]->(:Party {{role: {_lit(v)}}}) }}" if not isinstance(v, list)
                             else f"EXISTS {{ MATCH ({alias})-[:HAS_ACTOR]->(p:Party) WHERE p.role IN {_lit(v)} }}")
            elif isinstance(v, list):
                conds.append(f"{alias}.{f} IN {_lit(v)}")
            else:
                conds.append(f"{alias}.{f} = {_lit(v)}")
    if "object_contains" in spec:
        toks = spec["object_contains"] if isinstance(spec["object_contains"], list) else [spec["object_contains"]]
        conds.append("(" + " OR ".join(f"{alias}.object CONTAINS {_lit(t)}" for t in toks) + ")")
    if "object_contains_any" in spec:
        conds.append("(" + " OR ".join(f"{alias}.object CONTAINS {_lit(t)}" for t in spec["object_contains_any"]) + ")")
    return conds


def _where_clause(spec: dict) -> str:
    if "any" in spec:
        return "(" + " OR ".join("(" + " AND ".join(_norm_conditions("n", alt)) + ")" for alt in spec["any"]) + ")"
    conds = _norm_conditions("n", spec)
    if "has_norm" in spec:
        conds += _norm_conditions("n", spec["has_norm"])
    return " AND ".join(conds) if conds else "true"


def _unless_clauses(unless: list[dict] | None) -> list[str]:
    out = []
    for u in unless or []:
        if "related" in u:
            rels = "|".join(u["related"].get("relation", []))
            tconds = " AND ".join(_norm_conditions("x", u["related"].get("target", {}))) or "true"
            out.append(f"NOT EXISTS {{ MATCH (n)-[:{rels}]->(x:Norm) WHERE {tconds} }}")
        if "exists_in_document" in u:
            tconds = " AND ".join(_norm_conditions("u", u["exists_in_document"])) or "true"
            out.append(f"NOT EXISTS {{ MATCH (d)-[:CONTAINS]->(:Clause)-[:STATES]->(u:Norm {{status: n.status}}) WHERE u.id <> n.id AND {tconds} }}")
        if "has_norm" in u:
            tconds = " AND ".join(_norm_conditions("h", u["has_norm"])) or "true"
            out.append(f"NOT EXISTS {{ MATCH (c)-[:STATES]->(h:Norm {{status: n.status}}) WHERE {tconds} }}")
        if "object_contains" in u:
            toks = u["object_contains"] if isinstance(u["object_contains"], list) else [u["object_contains"]]
            out.append("NOT (" + " OR ".join(f"n.object CONTAINS {_lit(t)}" for t in toks) + ")")
    return out


def compile_rule(rule: dict, version: str) -> str:
    where = rule.get("where", {})
    conds = [_where_clause(where)]
    if "theme" in where:
        conds.append(f"EXISTS {{ MATCH (c)-[:HAS_THEME {{role: 'primary', source: 'consensus'}}]->(:Theme {{code: {_lit(where['theme'])}, taxonomy: 'T11'}}) }}")
    thr = rule.get("threshold")
    if thr:
        conds.append(f"n.{thr['field']} IS NOT NULL AND n.{thr['field']} {thr['op']} {thr['value']}")
    conds += _unless_clauses(rule.get("unless"))
    item = rule["item"]
    if isinstance(item, list):
        sel = rule.get("item_selector", {})
        cases = " ".join(f"WHEN n.object CONTAINS {_lit(t)} THEN {_lit(i)}" for t, i in sel.items() if t != "default")
        item_expr = f"CASE {cases} ELSE {_lit(sel.get('default', item[-1]))} END"
    else:
        item_expr = _lit(item)
    return f"""// {rule['id']} — item {item} — {rule.get('family', 'R1')} — {rule.get('description', '')}
MATCH (d:Document)-[:CONTAINS]->(c:Clause)-[:STATES]->(n:Norm {{status: $status}})
WHERE {' AND '.join(conds)}
MATCH (n)-[:EVIDENCED_BY]->(s:Sentence)
WITH d, c, n, collect(DISTINCT s.id) AS evidence, {item_expr} AS item_code
MATCH (i:AnnexItem {{code: item_code}})
MERGE (n)-[m:MATCHES_ITEM {{rule_id: {_lit(rule['id'])}, rule_version: {_lit(version)}, run_id: $run_id}}]->(i)
SET m.evidence_ids = evidence
RETURN d.id AS document, c.id AS clause, n.id AS norm, evidence, item_code AS item;
"""


def compile_rules_to_cypher(rules: dict, out_path: Path | None = None) -> str:
    version = str(rules.get("version"))
    header = (f"// Généré par src/detection/rules/compile_cypher.py depuis {rules.get('_path', 'grey_list_queries.yaml')}\n"
              f"// version {version} · sha256 {rules.get('_sha256', '')} · gelée : {bool(rules.get('_frozen'))}\n"
              f"// Paramètres : $run_id, $status ('validated' | 'proposed'). Étanchéité : aucune référence à la couche de référence.\n\n")
    body = "\n".join(compile_rule(r, version) for r in rules.get("rules", []))
    text = header + body
    if out_path:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(text, encoding="utf-8")
    return text


def main(argv=None) -> int:
    import argparse
    from .loader import RULES_DIR, load_rules, lint_rules_text

    ap = argparse.ArgumentParser(description="Compile les règles YAML gelées en Cypher Memgraph.")
    ap.add_argument("--rules", type=Path, default=RULES_DIR / "grey_list_queries.yaml")
    ap.add_argument("--out", type=Path, default=ROOT / "graph" / "cypher" / "04_rules_compiled.cypher")
    ap.add_argument("--population", choices=["design", "holdout"], default="design")
    a = ap.parse_args(argv)
    rules = load_rules(a.rules, population=a.population)
    text = compile_rules_to_cypher(rules, a.out)
    leaks = lint_rules_text(text)
    if leaks:
        raise SystemExit(f"Cypher généré non étanche : {leaks}")
    print(f"{len(rules['rules'])} règles compilées → {a.out} (gelées : {bool(rules['_frozen'])}, sha256 {rules['_sha256'][:12]}…)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

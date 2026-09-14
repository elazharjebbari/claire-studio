"""Évaluateur Python pur des règles (sémantique de référence, testée par cas dorés ; le Cypher compilé doit
donner les mêmes appariements). Conventions : `not_stated` ≠ `none` ; une liste = appartenance ; `any` =
disjonction ; `unless` = exceptions ; projection = phrases d'evidence."""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field

from .model import NormRecord

_OPS = {">=": lambda a, b: a >= b, ">": lambda a, b: a > b, "<=": lambda a, b: a <= b, "<": lambda a, b: a < b, "==": lambda a, b: a == b}


@dataclass
class Match:
    rule_id: str
    item: str
    norm_id: str
    clause_id: str
    document: str
    evidence: list[int]
    satisfied: dict = field(default_factory=dict)     # champs qui ont satisfait la règle (explication)
    family: str = "R1"


def _in(value, spec) -> bool:
    if spec is None:
        return True
    if isinstance(spec, list):
        return value in spec
    return value == spec


def _norm_matches(n: NormRecord, spec: dict) -> bool:
    """Conjonction des conditions de `spec` sur une norme (hors `has_norm`, `theme`, `any`)."""
    for key, val in spec.items():
        if key in ("has_norm", "theme", "any"):
            continue
        if key == "object_contains":
            toks = val if isinstance(val, list) else [val]
            if not (n.object and any(t in n.object for t in toks)):
                return False
        elif key == "object_contains_any":
            if not (n.object and any(t in n.object for t in val)):
                return False
        elif not _in(getattr(n, key, None), val):
            return False
    return True


def _where_matches(n: NormRecord, where: dict, clause_norms: list[NormRecord]) -> tuple[bool, dict]:
    """Retourne (vrai/faux, champs satisfaits)."""
    if "any" in where:
        for alt in where["any"]:
            ok, sat = _where_matches(n, alt, clause_norms)
            if ok:
                return True, sat
        return False, {}
    if "theme" in where and n.theme_T11 != where["theme"]:
        return False, {}
    if "has_norm" in where:
        # règle de niveau clause : la clause doit porter une norme satisfaisant le motif ; la norme courante
        # est celle qui porte l'evidence (première norme satisfaisant le motif)
        if not any(_norm_matches(m, where["has_norm"]) for m in clause_norms):
            return False, {}
        if not _norm_matches(n, where["has_norm"]):
            return False, {}
    if not _norm_matches(n, where):
        return False, {}
    sat = {k: getattr(n, k, None) for k in where if k in ("actor", "modality", "action", "condition", "notice", "remedy")}
    if "object_contains" in where or "object_contains_any" in where:
        sat["object"] = n.object
    return True, sat


def _unless_blocks(n: NormRecord, unless: list[dict], clause_norms: list[NormRecord], doc_norms: list[NormRecord], by_id: dict) -> bool:
    for u in unless or []:
        if "related" in u:
            rels = set(u["related"].get("relation", []))
            target = u["related"].get("target", {})
            for rel, other_id in n.related:
                if rel in rels and other_id in by_id and _norm_matches(by_id[other_id], target):
                    return True
        if "exists_in_document" in u and any(m.norm_id != n.norm_id and _norm_matches(m, u["exists_in_document"]) for m in doc_norms):
            return True
        if "has_norm" in u and any(_norm_matches(m, u["has_norm"]) for m in clause_norms):
            return True
        if "object_contains" in u:
            toks = u["object_contains"] if isinstance(u["object_contains"], list) else [u["object_contains"]]
            if n.object and any(t in n.object for t in toks):
                return True
    return False


def _threshold_ok(n: NormRecord, thr: dict | None) -> bool:
    if not thr:
        return True
    val = getattr(n, thr["field"], None)
    if val is None:
        return False                                  # valeur absente : pas de déclenchement quantitatif
    return _OPS[thr["op"]](val, thr["value"])


def _select_item(rule: dict, n: NormRecord) -> str:
    item = rule["item"]
    if isinstance(item, list):
        sel = rule.get("item_selector", {})
        for tok, it in sel.items():
            if tok != "default" and n.object and tok in n.object:
                return it
        return sel.get("default", item[-1])
    return item


def evaluate_rules(rules: dict, norms: list[NormRecord], *, statuses: tuple[str, ...] = ("validated",)) -> list[Match]:
    """Applique toutes les règles ; ne considère que les normes dont le statut ∈ statuses (ablation : ("proposed",))."""
    pool = [n for n in norms if n.status in statuses]
    by_clause, by_doc, by_id = defaultdict(list), defaultdict(list), {}
    for n in pool:
        by_clause[n.clause_id].append(n)
        by_doc[n.document].append(n)
        by_id[n.norm_id] = n
    matches = []
    for rule in rules.get("rules", []):
        where = rule.get("where", {})
        seen_clause_rules = set()
        for n in pool:
            ok, sat = _where_matches(n, where, by_clause[n.clause_id])
            if not ok or not _threshold_ok(n, rule.get("threshold")):
                continue
            if _unless_blocks(n, rule.get("unless"), by_clause[n.clause_id], by_doc[n.document], by_id):
                continue
            if "has_norm" in where:                    # une règle de clause ne se déclenche qu'une fois par clause
                if (rule["id"], n.clause_id) in seen_clause_rules:
                    continue
                seen_clause_rules.add((rule["id"], n.clause_id))
            matches.append(Match(rule_id=rule["id"], item=_select_item(rule, n), norm_id=n.norm_id, clause_id=n.clause_id,
                                 document=n.document, evidence=sorted(set(n.evidence)), satisfied=sat, family=rule.get("family", "R1")))
    return matches


def project_to_sentences(matches: list[Match], clauses: dict[str, dict] | None = None, mode: str = "evidence_only") -> dict[tuple, set]:
    """(document, index) → {items} ; mode evidence_only (défaut) ou whole_clause (annexe)."""
    out = defaultdict(set)
    for m in matches:
        if mode == "whole_clause" and clauses is not None:
            idxs = [s["index"] for s in clauses[m.clause_id]["sentences"]]
        else:
            idxs = m.evidence
        for i in idxs:
            out[(m.document, i)].add(m.item)
    return out

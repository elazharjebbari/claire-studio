"""Analyse automatique des désaccords règles ↔ référence (remplace l'audit expert pour la soumission 157 ;
positionnement : PUBLICATION_STRATEGY.md § « pipeline entièrement automatique »).

Entrées : les `matches.jsonl` d'une ou plusieurs passes d'extraction (stabilité), la référence CLAUDETTE, la sévérité
réimportée, les clauses (thème, phrases), l'ontologie (item → catégories), les règles (actions attendues par item), et le
`step_5_corrected.jsonl` de la passe de référence (normes par clause, pour typer les faux négatifs).

Sorties (JSON + Markdown) :
  1. Faux positifs par item : sans étiquette / étiquette d'une autre catégorie / stables (signalés à toutes les passes)
     vs instables ; répartition par thème T11 ; part des FP dont la phrase est dans une clause où la référence marque
     une AUTRE phrase (désaccord de localisation plutôt que de fond).
  2. Vrais positifs par sévérité CLAUDETTE (1/2/3) vs faux négatifs par sévérité : les règles retrouvent-elles d'abord
     les cas graves ?
  3. Typologie automatique des faux négatifs (positifs de la catégorie mappée non signalés) :
     N0 clause sans aucune norme extraite ; N1 norme présente avec une action attendue par l'item mais champs
     non conformes (condition / notice / remedy / modality / actor) — avec le champ « le plus proche » ; N2 normes
     présentes mais aucune action attendue (action différente ou `other`) ; N3 signalé par une autre passe seulement.
  4. Stabilité des signalements : phrases signalées par 1 / 2 / 3 passes, κ de Fleiss binaire.
Aucun texte de contrat dans les sorties.
"""
from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
FIELDS = ("actor", "modality", "action", "condition", "notice", "remedy")


def read_jsonl(p: Path):
    return [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines() if l.strip()]


def fleiss_kappa_binary(counts: list[tuple[int, int]]) -> float | None:
    """counts : liste (n_oui, n_non) par unité, même nombre de juges."""
    if not counts:
        return None
    n = counts[0][0] + counts[0][1]; N = len(counts)
    if n < 2:
        return None
    p_yes = sum(c[0] for c in counts) / (N * n); p_no = 1 - p_yes
    Pe = p_yes ** 2 + p_no ** 2
    Pi = [(c[0] * (c[0] - 1) + c[1] * (c[1] - 1)) / (n * (n - 1)) for c in counts]
    Pbar = sum(Pi) / N
    return round((Pbar - Pe) / (1 - Pe), 4) if Pe < 1 else None


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--matches", action="append", required=True, help="matches.jsonl (répéter par passe ; la 1re = passe de référence)")
    ap.add_argument("--extraction", type=Path, required=True, help="step_5_corrected.jsonl de la passe de référence")
    ap.add_argument("--repeat", type=int, default=0, help="passe de référence dans le fichier d'extraction")
    ap.add_argument("--population", choices=["design", "holdout"], required=True)
    ap.add_argument("--universe", choices=["extracted", "population"], default="population")
    ap.add_argument("--extracted", type=Path, default=None)
    ap.add_argument("--clauses", type=Path, default=ROOT / "data" / "annotations" / "clauses_all.jsonl")
    ap.add_argument("--reference", type=Path, default=ROOT / "data" / "processed" / "reference.jsonl")
    ap.add_argument("--severity", type=Path, default=ROOT / "data" / "annotations" / "claudette_severity.jsonl")
    ap.add_argument("--directive", type=Path, default=ROOT / "ontology" / "directive_93_13.yaml")
    ap.add_argument("--rules", type=Path, default=ROOT / "graph" / "rules" / "grey_list_queries.yaml")
    ap.add_argument("--out", type=Path, required=True)
    a = ap.parse_args(argv)

    pop_name = {"design": "designSet", "holdout": "holdout"}[a.population]
    clauses = read_jsonl(a.clauses); by_cid = {c["clause_id"]: c for c in clauses}
    theme_of, clause_of, pop_of = {}, {}, {}
    for c in clauses:
        for s in c["sentences"]:
            k = (c["document"], s["index"]); theme_of[k] = c["theme_T11"]; clause_of[k] = c["clause_id"]; pop_of[k] = c["population"]
    if a.universe == "extracted":
        universe = {(c["document"], s["index"]) for c in read_jsonl(a.extracted) for s in c["sentences"]}
    else:
        universe = {k for k, p in pop_of.items() if p == pop_name}
    labels = defaultdict(set)
    for r in read_jsonl(a.reference):
        labels[(r["document"], r["index"])].add(r["category"])
    severity = {}
    for r in read_jsonl(a.severity):
        severity[(r["document"], r["index"], r["category"])] = r["level"]
    directive = yaml.safe_load(a.directive.read_text(encoding="utf-8"))
    item_cats = {code: (it.get("claudette_categories") or []) for code, it in directive["items"].items()}
    rules = yaml.safe_load(a.rules.read_text(encoding="utf-8"))["rules"]
    expected_actions = defaultdict(set)   # item → actions qui peuvent déclencher une règle de l'item
    specs_by_item = defaultdict(list)      # item → specs plates (une par alternative) pour trouver les champs bloquants
    for r in rules:
        items = r["item"] if isinstance(r["item"], list) else [r["item"]]
        specs = r["where"].get("any", [r["where"]])
        for sp in specs:
            flat = dict(sp.get("has_norm") or {}); flat.update({k: v for k, v in sp.items() if k not in ("has_norm", "theme", "any")})
            acts = flat.get("action") or []
            for it in items:
                expected_actions[it].update(acts if isinstance(acts, list) else [acts]); specs_by_item[it].append(flat)

    def blocking(norm: dict, item: str) -> list[str]:
        """Champs qui empêchent la meilleure règle de l'item de se déclencher sur cette norme (0 si la règle passe)."""
        best = None
        for sp in specs_by_item.get(item, []):
            bad = []
            for f, allowed in sp.items():
                if f in ("object_contains", "object_contains_any"):
                    toks = allowed if isinstance(allowed, list) else [allowed]
                    if not (norm.get("object") and any(t in norm["object"] for t in toks)):
                        bad.append(f"object∌{'/'.join(toks[:3])}")
                    continue
                allowed_l = allowed if isinstance(allowed, list) else [allowed]
                if norm.get(f) not in allowed_l:
                    bad.append(f"{f}={norm.get(f)}")
            if best is None or len(bad) < len(best):
                best = bad
        return best or []

    passes = [read_jsonl(Path(m)) for m in a.matches]
    flags_by_pass = []
    for ms in passes:
        f = defaultdict(set)
        for m in ms:
            for i in m["evidence"]:
                k = (m["document"], i)
                if k in universe:
                    f[m["item"]].add(k)
        flags_by_pass.append(f)
    ref_flags = flags_by_pass[0]
    n_pass = len(passes)

    # normes de la passe de référence par clause
    norms_by_clause = defaultdict(list)
    for row in read_jsonl(a.extraction):
        if int(row.get("repeat", 0)) != a.repeat or not row.get("output"):
            continue
        norms_by_clause[row["clause_id"]] += row["output"].get("norms", [])

    out = {"population": a.population, "universe": a.universe, "n_passes": n_pass, "n_sentences": len(universe), "items": {}}
    for item, cats in item_cats.items():
        if item not in ref_flags and not cats:
            continue
        flagged = ref_flags.get(item, set())
        pos = {k for k in universe if labels.get(k) and (not cats or labels[k] & set(cats))} if cats else set()
        tp = flagged & pos if cats else set()
        fp = flagged - pos if cats else flagged
        fn = pos - flagged
        stable = {k for k in flagged if all(k in fb.get(item, set()) for fb in flags_by_pass)}
        fp_other_label = {k for k in fp if labels.get(k)}
        fp_same_clause_labeled = {k for k in fp if any(labels.get((k[0], s["index"])) and (not cats or labels[(k[0], s["index"])] & set(cats)) for s in by_cid[clause_of[k]]["sentences"] if (k[0], s["index"]) != k)} if cats else set()
        # typologie des FN
        typ = Counter(); near_field = Counter()
        flagged_other_pass = set().union(*[fb.get(item, set()) for fb in flags_by_pass[1:]]) if n_pass > 1 else set()
        for k in fn:
            norms = norms_by_clause.get(clause_of.get(k), [])
            if k in flagged_other_pass:
                typ["N3_flagged_in_another_pass"] += 1
            elif not norms:
                typ["N0_no_norm_in_clause"] += 1
            else:
                cand = [n for n in norms if n["action"] in expected_actions.get(item, set())]
                if cand:
                    typ["N1_expected_action_fields_mismatch"] += 1
                    closest = min(cand, key=lambda n: len(blocking(n, item)))
                    for b in blocking(closest, item):
                        near_field[b] += 1
                else:
                    typ["N2_no_expected_action"] += 1
        sev_tp = Counter(severity.get((k[0], k[1], c)) for k in tp for c in (labels[k] & set(cats)))
        sev_fn = Counter(severity.get((k[0], k[1], c)) for k in fn for c in (labels[k] & set(cats)))
        out["items"][item] = {"categories": cats, "n_flagged": len(flagged), "tp": len(tp), "fp": len(fp), "fn": len(fn),
                              "fp_stable_all_passes": len(fp & stable), "fp_with_other_category_label": len(fp_other_label),
                              "fp_same_clause_has_reference": len(fp_same_clause_labeled),
                              "fp_by_theme": dict(Counter(theme_of.get(k) for k in fp)),
                              "tp_by_severity": {str(k): v for k, v in sev_tp.items()}, "fn_by_severity": {str(k): v for k, v in sev_fn.items()},
                              "fn_typology": dict(typ), "fn_nearest_fields": dict(near_field.most_common(8)),
                              "stable_share_of_flags": round(len(stable) / len(flagged), 3) if flagged else None}
    # stabilité globale
    all_flagged = set().union(*[set().union(*fb.values()) for fb in flags_by_pass if fb]) if any(flags_by_pass) else set()
    yes_of = {k: sum(1 for fb in flags_by_pass if any(k in v for v in fb.values())) for k in universe}
    counts_universe = [(y, n_pass - y) for y in yes_of.values()]          # unités = toutes les phrases (accord sur les négatifs inclus)
    by_n = Counter(y for k, y in yes_of.items() if y > 0)
    out["stability"] = {"n_passes": n_pass, "flagged_union": len(all_flagged), "by_n_passes": {str(k): v for k, v in sorted(by_n.items())},
                        "fleiss_kappa_binary_universe": fleiss_kappa_binary(counts_universe) if n_pass > 1 else None,
                        "majority": sum(1 for y in yes_of.values() if y * 2 > n_pass)}
    a.out.mkdir(parents=True, exist_ok=True)
    (a.out / "DISAGREEMENT.json").write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    L = [f"# Désaccords règles ↔ référence — {a.population} / {a.universe} ({len(universe)} phrases, {n_pass} passes)", "",
         "| Item | Réf. | signalées | TP | FP | FP stables | FP autre cat. | FP clause réf. | FN | FN N0 sans norme | N1 action ok, champs ≠ | N2 action ≠ | N3 autre passe |",
         "|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for it, b in out["items"].items():
        t = b["fn_typology"]
        L.append(f"| {it} | {','.join(b['categories']) or '—'} | {b['n_flagged']} | {b['tp']} | {b['fp']} | {b['fp_stable_all_passes']} | {b['fp_with_other_category_label']} | {b['fp_same_clause_has_reference']} | {b['fn']} | {t.get('N0_no_norm_in_clause', 0)} | {t.get('N1_expected_action_fields_mismatch', 0)} | {t.get('N2_no_expected_action', 0)} | {t.get('N3_flagged_in_another_pass', 0)} |")
    L += ["", "## Sévérité (TP vs FN) et champs les plus proches des faux négatifs N1", ""]
    for it, b in out["items"].items():
        if b["categories"]:
            L.append(f"- **{it}** : TP par sévérité {b['tp_by_severity']} ; FN par sévérité {b['fn_by_severity']} ; champs bloquants (N1) {b['fn_nearest_fields']} ; FP par thème {b['fp_by_theme']}")
    st = out["stability"]
    L += ["", f"## Stabilité : union {st['flagged_union']} phrases signalées ; par nombre de passes {st['by_n_passes']} ; majorité {st['majority']} ; κ de Fleiss (toutes phrases) {st['fleiss_kappa_binary_universe']}"]
    (a.out / "DISAGREEMENT.md").write_text("\n".join(L) + "\n", encoding="utf-8"); print("\n".join(L)); return 0


if __name__ == "__main__":
    raise SystemExit(main())

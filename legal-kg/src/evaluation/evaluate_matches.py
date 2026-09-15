"""E2 — évaluation des appariements des règles gelées contre la référence CLAUDETTE (par item, par règle, agrégé).

Entrées : `matches.jsonl` (detection/run_rules.py), la référence par phrase (`data/processed/reference.jsonl`), les clauses
(`data/annotations/clauses_all.jsonl` : population, thème T11, phrases), l'ontologie (item → catégories CLAUDETTE),
optionnellement `norms.csv` (couverture) et des prédictions Lab (`name=predictions.jsonl`, B1/B2) pour la comparaison
texte seul. Univers d'évaluation : les phrases des clauses extraites (`--universe extracted`, pilote) ou toutes les
phrases de la population (`--universe population`, hold-out).

Pour chaque item : positifs = phrases portant l'une des catégories mappées (toute catégorie si l'item n'en a pas) ;
signalées = union des phrases témoins des règles de l'item ; P/R/F1 avec IC bootstrap par document ; Δ F1 apparié
contre le prédicteur « thème seul » (P(positif | thème T11) estimé sur la population de conception en LODO, seuil
maximisant F1 hors échantillon sur la conception) ; couverture = part des positifs situés dans une clause portant au
moins une norme (borne supérieure du rappel). Aucune décision n'est prise ici : lecture seule, chiffres bruts.
"""
from __future__ import annotations

import argparse
import json
import random
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
CATS = ["A", "CH", "CR", "J", "LAW", "LTD", "TER", "USE"]
MIN_LABELS_FOR_CONCLUSION = 30          # EXPERIMENTAL_PROTOCOL.md règle 6


def read_jsonl(p: Path):
    return [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines() if l.strip()]


def prf(tp: int, fp: int, fn: int) -> tuple[float, float, float]:
    p = tp / (tp + fp) if tp + fp else 0.0
    r = tp / (tp + fn) if tp + fn else 0.0
    return p, r, (2 * p * r / (p + r) if p + r else 0.0)


def boot_ci(docs: list[str], fn, n: int, seed: int) -> dict:
    rng = random.Random(seed)
    uniq = sorted(set(docs))
    if len(uniq) < 2:
        return {"low": None, "high": None}
    vals = [fn(rng.choices(uniq, k=len(uniq))) for _ in range(n)]
    vals.sort()
    return {"low": round(vals[int(0.025 * n)], 4), "high": round(vals[min(n - 1, int(0.975 * n))], 4)}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--matches", type=Path, required=True)
    ap.add_argument("--population", choices=["design", "holdout"], required=True)
    ap.add_argument("--universe", choices=["extracted", "population"], default="population")
    ap.add_argument("--extracted", type=Path, default=None, help="clauses.jsonl de l'extraction (univers `extracted`)")
    ap.add_argument("--clauses", type=Path, default=ROOT / "data" / "annotations" / "clauses_all.jsonl")
    ap.add_argument("--reference", type=Path, default=ROOT / "data" / "processed" / "reference.jsonl")
    ap.add_argument("--directive", type=Path, default=ROOT / "ontology" / "directive_93_13.yaml")
    ap.add_argument("--rules", type=Path, default=ROOT / "graph" / "rules" / "grey_list_queries.yaml")
    ap.add_argument("--norms-csv", type=Path, default=None)
    ap.add_argument("--predictions", action="append", default=[], help="name=predictions.jsonl (Lab U1, y_pred unfair/fair)")
    ap.add_argument("--n-boot", type=int, default=1000)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", type=Path, default=None)
    a = ap.parse_args(argv)

    pop_name = {"design": "designSet", "holdout": "holdout"}[a.population]
    clauses = read_jsonl(a.clauses)
    theme_of, pop_of, clause_of = {}, {}, {}
    for c in clauses:
        for s in c["sentences"]:
            k = (c["document"], s["index"])
            theme_of[k] = c["theme_T11"]; pop_of[k] = c["population"]; clause_of[k] = c["clause_id"]
    labels = defaultdict(set)
    for r in read_jsonl(a.reference):
        labels[(r["document"], r["index"])].add(r["category"])

    if a.universe == "extracted":
        if not a.extracted:
            raise SystemExit("--extracted requis avec --universe extracted")
        universe = [(c["document"], s["index"]) for c in read_jsonl(a.extracted) for s in c["sentences"]]
    else:
        universe = [k for k, p in pop_of.items() if p == pop_name]
    universe = sorted(set(universe))
    docs_u = [k[0] for k in universe]
    design = [k for k, p in pop_of.items() if p == "designSet"]

    directive = yaml.safe_load(a.directive.read_text(encoding="utf-8"))
    item_cats = {code: (it.get("claudette_categories") or []) for code, it in directive["items"].items()}
    item_expr = {code: it.get("expressibility") for code, it in directive["items"].items()}
    rules = yaml.safe_load(a.rules.read_text(encoding="utf-8"))
    rule_items = {r["id"]: (r["item"] if isinstance(r["item"], list) else [r["item"]]) for r in rules["rules"]}

    matches = read_jsonl(a.matches)
    flagged_by_item, flagged_by_rule = defaultdict(set), defaultdict(set)
    for m in matches:
        for i in m["evidence"]:
            k = (m["document"], i)
            flagged_by_rule[m["rule_id"]].add(k)
            flagged_by_item[m["item"]].add(k)
    uni_set = set(universe)

    # couverture : clauses portant ≥ 1 norme
    clauses_with_norm = set()
    if a.norms_csv:
        import csv
        clauses_with_norm = {r["clause_id"] for r in csv.DictReader(a.norms_csv.open(encoding="utf-8"))}

    def positives_for(cats: list[str]) -> set:
        if cats:
            return {k for k in universe if labels.get(k) and (labels[k] & set(cats))}
        return {k for k in universe if labels.get(k)}

    # thème seul : P(positif | thème) sur la conception, LODO pour les documents de conception
    def theme_only_flags(cats: list[str]) -> set:
        def is_pos(k):
            return bool(labels.get(k)) and (not cats or bool(labels[k] & set(cats)))
        by_theme_doc = defaultdict(lambda: defaultdict(lambda: [0, 0]))
        for k in design:
            t = by_theme_doc[theme_of[k]][k[0]]
            t[0] += 1; t[1] += is_pos(k)
        def score(k):
            tot = pos = 0
            for d, (n, p) in by_theme_doc[theme_of[k]].items():
                if d == k[0]:
                    continue
                tot += n; pos += p
            return (pos + 1) / (tot + 2)
        # seuil : maximise F1 sur la conception (scores LODO)
        ds = [(score(k), is_pos(k)) for k in design]
        best_t, best_f = 0.5, -1.0
        for t in sorted({round(s, 4) for s, _ in ds}):
            tp = sum(1 for s, y in ds if s >= t and y); fp = sum(1 for s, y in ds if s >= t and not y); fn = sum(1 for s, y in ds if s < t and y)
            f = prf(tp, fp, fn)[2]
            if f > best_f:
                best_f, best_t = f, t
        return {k for k in universe if score(k) >= best_t}, best_t

    def metrics(flags: set, pos: set, docs_filter=None) -> tuple[int, int, int]:
        U = uni_set if docs_filter is None else {k for k in universe if k[0] in docs_filter}
        f = flags & U; p = pos & U
        return len(f & p), len(f - p), len(p - f)

    def per_doc_counts(flags: set, pos: set) -> dict:
        """(tp, fp, fn) par document, calculé une fois ; le bootstrap n'est plus qu'une somme pondérée."""
        out = {d: [0, 0, 0] for d in set(docs_u)}
        for k in universe:
            f = k in flags; p = k in pos
            if f and p: out[k[0]][0] += 1
            elif f: out[k[0]][1] += 1
            elif p: out[k[0]][2] += 1
        return out

    def f1_of_counts(counts: dict, docs) -> float:
        cnt = defaultdict(int)
        for d in docs:
            cnt[d] += 1
        TP = FP = FN = 0
        for d, m in cnt.items():
            t, x, y = counts[d]; TP += m * t; FP += m * x; FN += m * y
        return prf(TP, FP, FN)[2]

    def eval_block(flags: set, pos: set, name: str, ref_flags: set | None = None) -> dict:
        tp, fp, fn = metrics(flags, pos)
        p, r, f = prf(tp, fp, fn)
        counts = per_doc_counts(flags, pos)
        out = {"name": name, "n_pos": len(pos), "n_flagged": len(flags & uni_set), "tp": tp, "fp": fp, "fn": fn,
               "precision": round(p, 4), "recall": round(r, 4), "f1": round(f, 4),
               "f1_ci95": boot_ci(docs_u, lambda docs: f1_of_counts(counts, docs), a.n_boot, a.seed)}
        if ref_flags is not None:
            ref_counts = per_doc_counts(ref_flags, pos)
            tpb, fpb, fnb = metrics(ref_flags, pos)
            out["theme_only"] = {"precision": round(prf(tpb, fpb, fnb)[0], 4), "recall": round(prf(tpb, fpb, fnb)[1], 4), "f1": round(prf(tpb, fpb, fnb)[2], 4), "n_flagged": len(ref_flags & uni_set)}
            out["delta_f1_vs_theme_only"] = round(f - prf(tpb, fpb, fnb)[2], 4)
            out["delta_f1_ci95"] = boot_ci(docs_u, lambda docs: f1_of_counts(counts, docs) - f1_of_counts(ref_counts, docs), a.n_boot, a.seed)
        return out

    items_eval, items_unmapped = [], []
    for code in sorted(item_cats):
        if item_expr[code] == "not_expressible":
            continue
        cats = item_cats[code]
        flags = flagged_by_item.get(code, set()) & uni_set
        rules_of = sorted(r for r, its in rule_items.items() if code in its)
        if not cats:
            items_unmapped.append({"item": code, "expressibility": item_expr[code], "rules": rules_of, "n_flagged": len(flags),
                                   "flagged_with_any_label": len([k for k in flags if labels.get(k)]),
                                   "flagged_documents": len({k[0] for k in flags}), "note": "sans catégorie CLAUDETTE : audit expert seulement"})
            continue
        pos = positives_for(cats)
        theme_flags, tau = theme_only_flags(cats)
        blk = eval_block(flags, pos, f"item {code}", theme_flags)
        blk.update({"item": code, "categories": cats, "expressibility": item_expr[code], "theme_only_threshold": tau,
                    "rules": rules_of, "conclusive": len(pos) >= MIN_LABELS_FOR_CONCLUSION})
        if clauses_with_norm:
            cov = sum(1 for k in pos if clause_of.get(k) in clauses_with_norm)
            blk["coverage_upper_bound_recall"] = round(cov / len(pos), 4) if pos else None
        items_eval.append(blk)

    rules_eval = []
    for rid, its in rule_items.items():
        cats = sorted({c for i in its for c in item_cats[i]})
        flags = flagged_by_rule.get(rid, set()) & uni_set
        if not cats:
            rules_eval.append({"rule": rid, "items": its, "n_flagged": len(flags), "note": "sans catégorie mappée : audit seulement"}); continue
        blk = eval_block(flags, positives_for(cats), rid)
        blk.update({"rule": rid, "items": its}); rules_eval.append(blk)

    # agrégats : items structurels avec ≥ 1 règle
    struct = [b for b in items_eval if b["expressibility"] == "structural" and b["rules"]]   # items mappés seulement
    TP = sum(b["tp"] for b in struct); FP = sum(b["fp"] for b in struct); FN = sum(b["fn"] for b in struct)
    micro = prf(TP, FP, FN)
    macro_f1 = sum(b["f1"] for b in struct if b["n_pos"]) / max(1, sum(1 for b in struct if b["n_pos"]))
    macro_delta = sum(b["delta_f1_vs_theme_only"] for b in struct if b["n_pos"]) / max(1, sum(1 for b in struct if b["n_pos"]))

    # binaire : union des règles vs toute étiquette ; comparaison aux prédictions Lab
    any_pos = positives_for([])
    any_flags = set().union(*flagged_by_item.values()) if flagged_by_item else set()
    theme_any, _ = theme_only_flags([])
    binary = {"rules_union": eval_block(any_flags, any_pos, "rules ∪", theme_any)}
    for spec in a.predictions:
        name, path = spec.split("=", 1)
        pred = {(r["document"], r["index"]) for r in read_jsonl(Path(path)) if r["y_pred"] == "unfair"}
        inter = pred & uni_set
        if not inter and not (pred and any(k in uni_set for k in pred)):
            binary[name] = {"note": "aucune prédiction dans l'univers évalué (population différente)"}
            continue
        binary[name] = eval_block(pred, any_pos, name)
        binary[name]["overlap_on_positives"] = {"both": len(any_flags & pred & any_pos), "rules_only": len((any_flags - pred) & any_pos),
                                                 f"{name}_only": len((pred - any_flags) & any_pos), "neither": len(any_pos - any_flags - pred)}
        binary[name]["recall_on_item_positives"] = {b["item"]: round(len(pred & positives_for(b["categories"])) / b["n_pos"], 4) if b["n_pos"] else None for b in items_eval}

    result = {
        "created_at": datetime.now(timezone.utc).isoformat(), "matches": str(a.matches), "population": a.population, "universe": a.universe,
        "n_sentences": len(universe), "n_documents": len(set(docs_u)), "n_positive_any": len(any_pos), "n_matches": len(matches),
        "rules_version": matches[0].get("rule_version") if matches else None, "rules_sha256": matches[0].get("rules_sha256") if matches else None,
        "items": items_eval, "items_unmapped": items_unmapped, "rules": rules_eval,
        "aggregate_structural": {"n_items": len(struct), "micro_precision": round(micro[0], 4), "micro_recall": round(micro[1], 4), "micro_f1": round(micro[2], 4),
                                 "macro_f1": round(macro_f1, 4), "macro_delta_f1_vs_theme_only": round(macro_delta, 4)},
        "binary": binary,
        "notes": ["items avec n_pos < 30 : pas de conclusion (protocole, règle 6)", "univers extracted = phrases des clauses extraites seulement"],
    }
    out = a.out or ROOT / "results" / "evaluation" / f"{a.population}-{a.matches.parent.name}"
    out.mkdir(parents=True, exist_ok=True)
    # Lignes par phrase pour les tests statistiques (run_stats.py) : vérité et drapeaux par item + binaire
    theme_flags_by_item = {b["item"]: theme_only_flags(b["categories"])[0] for b in items_eval}
    preds = {}
    for spec in a.predictions:
        name, path = spec.split("=", 1)
        preds[name] = {(r["document"], r["index"]) for r in read_jsonl(Path(path)) if r["y_pred"] == "unfair"}
    with (out / "sentences_eval.jsonl").open("w", encoding="utf-8") as fh:
        for k in universe:
            row = {"document": k[0], "index": k[1], "theme_T11": theme_of.get(k), "labels": sorted(labels.get(k, [])),
                   "any": {"y_true": bool(labels.get(k)), "rules": k in any_flags, "theme_only": k in theme_any, **{n: k in p_ for n, p_ in preds.items()}},
                   "items": {b["item"]: {"y_true": bool(labels.get(k) and labels[k] & set(b["categories"])), "rules": k in flagged_by_item.get(b["item"], set()),
                                         "theme_only": k in theme_flags_by_item[b["item"]]} for b in items_eval}}
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")
    (out / "E2.json").write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    L = [f"# E2 — {a.population} / univers {a.universe} — {len(universe)} phrases, {len(set(docs_u))} documents, {len(any_pos)} abusives", "",
         f"Règles v{result['rules_version']} ({str(result['rules_sha256'])[:12]}…) ; appariements : {len(matches)}", "",
         "| Item | Expr. | Réf. | n_pos | signalées | P | R | F1 [IC] | thème seul F1 | ΔF1 [IC] | couverture | concluant |", "|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for b in items_eval:
        ci = b["f1_ci95"]; dci = b["delta_f1_ci95"]
        L.append(f"| {b['item']} | {b['expressibility'][:5]} | {','.join(b['categories'])} | {b['n_pos']} | {b['n_flagged']} | {b['precision']} | {b['recall']} | {b['f1']} [{ci['low']} ; {ci['high']}] | {b['theme_only']['f1']} | {b['delta_f1_vs_theme_only']} [{dci['low']} ; {dci['high']}] | {b.get('coverage_upper_bound_recall', '—')} | {'oui' if b['conclusive'] else 'non'} |")
    ag = result["aggregate_structural"]
    L += ["", f"**Items structurels ({ag['n_items']})** : micro P {ag['micro_precision']} / R {ag['micro_recall']} / F1 {ag['micro_f1']} ; macro-F1 {ag['macro_f1']} ; Δ macro vs thème seul {ag['macro_delta_f1_vs_theme_only']}.", "",
          "| Règle | Items | n_pos | signalées | P | R | F1 [IC] |", "|---|---|---|---|---|---|---|"]
    for b in rules_eval:
        if "note" in b:
            L.append(f"| {b['rule']} | {','.join(b['items'])} | — | {b['n_flagged']} | — | — | audit seulement |"); continue
        ci = b["f1_ci95"]; L.append(f"| {b['rule']} | {','.join(b['items'])} | {b['n_pos']} | {b['n_flagged']} | {b['precision']} | {b['recall']} | {b['f1']} [{ci['low']} ; {ci['high']}] |")
    L += ["", "## Items sans catégorie CLAUDETTE (audit expert, RQ6)", "", "| Item | Expr. | Règles | signalées | dont avec une étiquette quelconque | documents |", "|---|---|---|---|---|---|"]
    L += [f"| {b['item']} | {b['expressibility'][:5]} | {','.join(b['rules'])} | {b['n_flagged']} | {b['flagged_with_any_label']} | {b['flagged_documents']} |" for b in items_unmapped]
    L += ["", "## Binaire (toute étiquette)", ""]
    for name, b in binary.items():
        if "note" in b:
            L.append(f"- {name} : {b['note']}"); continue
        ci = b["f1_ci95"]; extra = f" ; thème seul F1 {b['theme_only']['f1']} ; ΔF1 {b['delta_f1_vs_theme_only']}" if "theme_only" in b else ""
        L.append(f"- **{name}** : P {b['precision']} / R {b['recall']} / F1 {b['f1']} [{ci['low']} ; {ci['high']}] (signalées {b['n_flagged']}, positives {b['n_pos']}){extra}" + (f" ; recouvrement {b['overlap_on_positives']}" if 'overlap_on_positives' in b else ""))
    (out / "E2.md").write_text("\n".join(L) + "\n", encoding="utf-8")
    print("\n".join(L))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

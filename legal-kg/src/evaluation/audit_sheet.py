"""F9 — feuille d'audit expert des phrases signalées (E6) et dépouillement.

`export` : depuis matches.jsonl + norms.csv (template) + clauses (texte local) → une ligne par (phrase signalée, règle) :
document, clause, phrase (indice + texte), item, règle, explication en prose, champs du template, autres phrases témoins,
et les colonnes à remplir : `verdict` ∈ {correct, arguable, wrong} ; si wrong : `error_source` ∈ {template, query,
reference_missing, other} ; `explanation_sufficient` ∈ {sufficient, partial, insufficient} ; `note`, `reviewer`, `date`.
La feuille est AVEUGLE : la référence CLAUDETTE n'y figure pas ; elle est écrite à part dans `audit_key.csv` pour le
dépouillement. Deux copies (A/B) pour la double lecture.

`merge` : deux CSV remplis → taux par verdict et par cause avec IC de Wilson, κ de Cohen inter-relecteurs sur les lignes
communes, part « signalement fondé, référence absente » (RQ6 : cible ≥ 20 % des faux positifs), suffisance (RQ3 : ≥ 70 %).
"""
from __future__ import annotations

import argparse
import csv
import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from stats import wilson  # noqa: E402

FILL = ["verdict", "error_source", "explanation_sufficient", "note", "reviewer", "date"]


def read_jsonl(p: Path):
    return [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines() if l.strip()]


def prose(n: dict, item: str, rule: str) -> str:
    mod = {"obligation": "must", "prohibition": "must not", "permission": "may", "power": "may"}.get(n["modality"], n["modality"])
    cond = {"discretion": "at its discretion", "none_stated": "with no condition stated", "for_cause": "for cause", "specified_reason": "for a specified reason"}.get(n["condition"], n["condition"])
    notice = {"none": "without notice", "not_stated": "with no notice stated", "reasonable": "with reasonable notice", "duration": "with a stated notice period"}.get(n["notice"], n["notice"])
    remedy = {"none": "and no remedy for the other party", "not_stated": "and no remedy stated", "refund": "with a refund", "right_to_cancel": "with a right to cancel", "compensation": "with compensation"}.get(n["remedy"], n["remedy"])
    obj = f" ({n['object']})" if n.get("object") else ""
    return f"The {n['actor']} {mod} {n['action'].replace('_', ' ')}{obj}, {cond}, {notice}, {remedy} — matches Annex item ({item}) via rule {rule}."


def export(a) -> int:
    clauses = {c["clause_id"]: c for c in read_jsonl(a.clauses)}
    norms = {r["id"]: r for r in csv.DictReader(a.norms_csv.open(encoding="utf-8"))}
    labels = defaultdict(set)
    for r in read_jsonl(a.reference):
        labels[(r["document"], r["index"])].add(r["category"])
    rows, key = [], []
    for m in read_jsonl(a.matches):
        n = norms.get(m["norm_id"])
        if n is None:
            continue
        c = clauses[m["clause_id"]]
        text_of = {s["index"]: s["text"] for s in c["sentences"]}
        for idx in m["evidence"]:
            others = " | ".join(f"[{j}] {text_of.get(j, '')}" for j in m["evidence"] if j != idx)
            rows.append({"audit_id": f"{m['document']}:{idx}:{m['rule_id']}", "document": m["document"], "clause_id": m["clause_id"], "theme_T11": c["theme_T11"],
                         "sentence_index": idx, "sentence": text_of.get(idx, ""), "item": m["item"], "rule": m["rule_id"], "family": m.get("family", ""),
                         "explanation": prose(n, m["item"], m["rule_id"]), "actor": n["actor"], "modality": n["modality"], "action": n["action"], "object": n["object"],
                         "condition": n["condition"], "notice": n["notice"], "remedy": n["remedy"], "other_evidence": others,
                         "clause_text": " ".join(f"[{s['index']}] {s['text']}" for s in c["sentences"]), **{f: "" for f in FILL}})
            key.append({"audit_id": rows[-1]["audit_id"], "reference_categories": "|".join(sorted(labels.get((m["document"], idx), []))),
                        "reference_positive": bool(labels.get((m["document"], idx)))})
    a.out.mkdir(parents=True, exist_ok=True)
    fields = list(rows[0].keys()) if rows else []
    for copy in ("A", "B"):
        with (a.out / f"audit_sheet_{copy}.csv").open("w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=fields); w.writeheader(); w.writerows(rows)
    with (a.out / "audit_key.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=["audit_id", "reference_categories", "reference_positive"]); w.writeheader(); w.writerows(key)
    md = ["# Feuille d'audit expert — phrases signalées par les règles gelées", "",
          "Pour chaque ligne : `verdict` ∈ {correct, arguable, wrong} ; si wrong, `error_source` ∈ {template, query, reference_missing, other} ; "
          "`explanation_sufficient` ∈ {sufficient, partial, insufficient} (l'explication suffit-elle à décider sans relire le contrat ?). "
          "La référence CLAUDETTE n'est pas montrée.", ""]
    for r in rows:
        md += [f"## {r['audit_id']} · thème {r['theme_T11']} · item ({r['item']}) · {r['rule']}", "", f"**Phrase [{r['sentence_index']}]** : {r['sentence']}", "",
               f"**Explication** : {r['explanation']}", "", f"Template : actor={r['actor']} · modality={r['modality']} · action={r['action']} · object={r['object']} · condition={r['condition']} · notice={r['notice']} · remedy={r['remedy']}", "",
               (f"Autres phrases témoins : {r['other_evidence']}" if r["other_evidence"] else ""), "", f"<details><summary>Clause complète</summary>{r['clause_text']}</details>", "",
               "verdict: ______  error_source: ______  explanation_sufficient: ______  note: ______", ""]
    (a.out / "audit_sheet.md").write_text("\n".join(md), encoding="utf-8")
    print(json.dumps({"rows": len(rows), "sentences": len({(r['document'], r['sentence_index']) for r in rows}), "by_item": dict(Counter(r["item"] for r in rows)), "out": str(a.out)}, ensure_ascii=False))
    return 0


def kappa(pairs: list[tuple[str, str]]) -> float | None:
    if not pairs:
        return None
    n = len(pairs); po = sum(1 for x, y in pairs if x == y) / n
    cats = {c for p in pairs for c in p}
    pe = sum((sum(1 for x, _ in pairs if x == c) / n) * (sum(1 for _, y in pairs if y == c) / n) for c in cats)
    return round((po - pe) / (1 - pe), 4) if pe < 1 else None


def merge(a) -> int:
    A = {r["audit_id"]: r for r in csv.DictReader(a.sheet_a.open(encoding="utf-8")) if r.get("verdict")}
    B = {r["audit_id"]: r for r in csv.DictReader(a.sheet_b.open(encoding="utf-8")) if r.get("verdict")} if a.sheet_b else {}
    key = {r["audit_id"]: r for r in csv.DictReader(a.key.open(encoding="utf-8"))} if a.key else {}
    out = {"n_A": len(A), "n_B": len(B)}
    common = sorted(set(A) & set(B))
    out["kappa_verdict"] = kappa([(A[i]["verdict"], B[i]["verdict"]) for i in common]); out["n_common"] = len(common)
    # consensus : A, remplacé par l'accord A/B quand disponible ; désaccords listés
    final = {}
    for i, r in A.items():
        v = r["verdict"]
        if i in B and B[i]["verdict"] != v:
            v = "arguable"
        final[i] = {**r, "verdict": v}
    out["disagreements"] = [i for i in common if A[i]["verdict"] != B[i]["verdict"]]
    n = len(final)
    for v in ("correct", "arguable", "wrong"):
        out[f"rate_{v}"] = wilson(sum(1 for r in final.values() if r["verdict"] == v), n)
    wrong = [r for r in final.values() if r["verdict"] == "wrong"]
    out["error_sources"] = dict(Counter(r.get("error_source", "") for r in wrong))
    out["reference_missing_share_of_wrong"] = wilson(sum(1 for r in wrong if r.get("error_source") == "reference_missing"), len(wrong))
    if key:
        fp = [r for r in final.values() if key.get(r["audit_id"], {}).get("reference_positive") == "False"]
        out["false_positives_by_reference"] = len(fp)
        out["fp_judged_correct_or_arguable"] = wilson(sum(1 for r in fp if r["verdict"] in ("correct", "arguable")), len(fp))
    suff = [r.get("explanation_sufficient", "") for r in final.values() if r.get("explanation_sufficient")]
    out["sufficiency"] = {"n": len(suff), **{k: wilson(sum(1 for s in suff if s == k), len(suff)) for k in ("sufficient", "partial", "insufficient")}}
    by_rule = defaultdict(Counter)
    for r in final.values():
        by_rule[r["rule"]][r["verdict"]] += 1
    out["by_rule"] = {k: dict(v) for k, v in by_rule.items()}
    a.out.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8"); print(json.dumps(out, indent=1, ensure_ascii=False)[:1500]); return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(); sub = ap.add_subparsers(dest="cmd", required=True)
    ex = sub.add_parser("export"); ex.add_argument("--matches", type=Path, required=True); ex.add_argument("--norms-csv", type=Path, required=True)
    ex.add_argument("--clauses", type=Path, required=True); ex.add_argument("--reference", type=Path, default=ROOT / "data" / "processed" / "reference.jsonl")
    ex.add_argument("--out", type=Path, required=True)
    mg = sub.add_parser("merge"); mg.add_argument("--sheet-a", type=Path, required=True); mg.add_argument("--sheet-b", type=Path, default=None)
    mg.add_argument("--key", type=Path, default=None); mg.add_argument("--out", type=Path, required=True)
    a = ap.parse_args(argv)
    return export(a) if a.cmd == "export" else merge(a)


if __name__ == "__main__":
    raise SystemExit(main())

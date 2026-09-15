"""Comparaison de deux extracteurs sur le même pilote (même prompt, mêmes lots) — prélude à LLM_EXTRACTION §5.

Sans la référence juriste, le score pondéré de sélection (exactitude des champs, hallucinations) n'est pas
calculable. Ce script fournit ce qui l'est, pour chaque extracteur et entre les deux :
  - indicateurs de qualité sans référence : conformité, normes par clause, clauses sans norme, part `other`,
    signalements d'ancrage lexical par norme, stabilité intra-modèle (Jaccard des signatures décisives) ;
  - accord inter-modèles par passe appariée : Jaccard des signatures décisives par clause, accord
    norme/pas de norme, accord des phrases signalées par les règles gelées (Jaccard, κ de Cohen) ;
  - option `--reference` (conception uniquement) : diagnostic précision/rappel par passe.
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter, defaultdict
from itertools import combinations
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src"))

from detection.rules import evaluate_rules, load_rules  # noqa: E402
from detection.rules.evaluate import project_to_sentences  # noqa: E402
from detection.rules.model import norms_from_extraction  # noqa: E402
from evaluation.extraction_stability import DECISIVE, jaccard, prf, read_jsonl  # noqa: E402


def cohen_kappa_binary(a: list[bool], b: list[bool]) -> float | None:
    n = len(a)
    if n == 0:
        return None
    po = sum(x == y for x, y in zip(a, b)) / n
    pa, pb = sum(a) / n, sum(b) / n
    pe = pa * pb + (1 - pa) * (1 - pb)
    return None if pe == 1 else round((po - pe) / (1 - pe), 4)


def load_extractor(run_dir: Path) -> dict:
    rows = read_jsonl(run_dir / "step_5_corrected.jsonl")
    anchoring = read_jsonl(run_dir / "step_4_anchoring.jsonl")
    run = json.loads((run_dir / "run.json").read_text(encoding="utf-8"))
    by_repeat: dict[int, list[dict]] = defaultdict(list)
    for r in rows:
        by_repeat[int(r["repeat"])].append(r)
    return {"run": run, "rows": rows, "by_repeat": by_repeat, "anchoring": anchoring}


def signatures(row: dict) -> set:
    return {tuple(n[f] for f in DECISIVE) for n in row["output"]["norms"]}


def quality(ex: dict) -> dict:
    norms = [n for r in ex["rows"] for n in r["output"]["norms"]]
    flags = sum(len(a["flags"]) for a in ex["anchoring"])
    per_clause = defaultdict(dict)
    for r in ex["rows"]:
        per_clause[r["clause_id"]][int(r["repeat"])] = signatures(r)
    intra = [jaccard(s[a], s[b]) for s in per_clause.values() for a, b in combinations(sorted(s), 2)]
    metrics = ex["run"].get("metrics", {})
    return {
        "backend": ex["run"].get("backend"), "model": ex["run"].get("model"),
        "schema_compliance": metrics.get("schema_compliance"), "semantic_pass": metrics.get("semantic_pass"),
        "norms_per_clause": round(len(norms) / max(len(ex["rows"]), 1), 3),
        "empty_share": round(sum(1 for r in ex["rows"] if not r["output"]["norms"]) / max(len(ex["rows"]), 1), 4),
        "other_action_share": round(sum(1 for n in norms if n["action"] == "other") / max(len(norms), 1), 4),
        "anchoring_flags_per_norm": round(flags / max(len(norms), 1), 4),
        "anchoring_flags_by_value": dict(Counter(f"{f['field']}={f['value']}" for a in ex["anchoring"] for f in a["flags"]).most_common(6)),
        "condition_distribution": dict(Counter(n["condition"] for n in norms)),
        "intra_model_decisive_jaccard": round(sum(intra) / len(intra), 4) if intra else None,
        "tokens": ex["run"].get("usage") or {"tokens_in": ex["run"].get("tokens_in"), "tokens_out": ex["run"].get("tokens_out")},
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Comparer deux extracteurs sur le même pilote.")
    ap.add_argument("--clauses", type=Path, required=True)
    ap.add_argument("--a", type=Path, required=True, help="dossier de run A (après replay)")
    ap.add_argument("--b", type=Path, required=True, help="dossier de run B (après replay)")
    ap.add_argument("--statuses", default="proposed")
    ap.add_argument("--reference", type=Path, default=None)
    ap.add_argument("--out", type=Path, default=None)
    args = ap.parse_args(argv)

    clauses = {c["clause_id"]: c for c in read_jsonl(args.clauses)}
    if args.reference and any(c.get("population") == "holdout" for c in clauses.values()):
        raise SystemExit("--reference refusé : clauses du hold-out présentes")
    rules = load_rules(population="design")
    statuses = tuple(s.strip() for s in args.statuses.split(","))
    ex = {"A": load_extractor(args.a), "B": load_extractor(args.b)}
    sentences = [(c["document"], s["index"]) for c in clauses.values() for s in c["sentences"]]
    positives = set()
    if args.reference:
        keys = set(sentences)
        positives = {(r["document"], r["index"]) for r in read_jsonl(args.reference) if (r["document"], r["index"]) in keys}

    flagged: dict[str, dict[int, set]] = {}
    for name, e in ex.items():
        flagged[name] = {}
        for k, rows in e["by_repeat"].items():
            ms = evaluate_rules(rules, norms_from_extraction(rows, clauses), statuses=statuses)
            flagged[name][k] = set(project_to_sentences(ms))

    pairs = sorted(set(ex["A"]["by_repeat"]) & set(ex["B"]["by_repeat"]))
    inter = {}
    for k in pairs:
        ra = {r["clause_id"]: r for r in ex["A"]["by_repeat"][k]}
        rb = {r["clause_id"]: r for r in ex["B"]["by_repeat"][k]}
        common = sorted(set(ra) & set(rb))
        sig = [jaccard(signatures(ra[c]), signatures(rb[c])) for c in common]
        empty = sum(bool(ra[c]["output"]["norms"]) == bool(rb[c]["output"]["norms"]) for c in common)
        fa, fb = flagged["A"][k], flagged["B"][k]
        inter[k] = {
            "clauses": len(common),
            "decisive_signature_jaccard_mean": round(sum(sig) / len(sig), 4) if sig else None,
            "empty_vs_nonempty_agreement": round(empty / len(common), 4) if common else None,
            "flagged_A": len(fa), "flagged_B": len(fb), "flagged_both": len(fa & fb),
            "flagged_jaccard": round(jaccard(fa, fb), 4),
            "flagged_cohen_kappa": cohen_kappa_binary([s in fa for s in sentences], [s in fb for s in sentences]),
        }

    report = {"A": str(args.a), "B": str(args.b), "rules_sha256": rules["_sha256"], "statuses": statuses,
              "quality": {name: quality(e) for name, e in ex.items()}, "inter_model_by_repeat": inter}
    if args.reference:
        report["design_diagnostic"] = {
            "note": "conception, normes non validées, pilote enrichi : pas un résultat publiable",
            "positives": len(positives),
            **{name: {k: prf(v, positives) for k, v in flagged[name].items()} for name in ex},
            "union_A_B_repeat0": prf(flagged["A"].get(0, set()) | flagged["B"].get(0, set()), positives) if 0 in pairs else None,
            "intersection_A_B_repeat0": prf(flagged["A"].get(0, set()) & flagged["B"].get(0, set()), positives) if 0 in pairs else None,
        }
    text = json.dumps(report, indent=1, ensure_ascii=False)
    if args.out:
        args.out.write_text(text, encoding="utf-8")
    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

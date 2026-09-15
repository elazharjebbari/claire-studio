"""Stabilité de l'extraction d'une passe à l'autre, et stabilité de ce que les règles gelées en déduisent.

Entrées : clauses (jsonl) + `step_5_corrected.jsonl` contenant plusieurs répétitions (`repeat` 0..R-1).
Mesures :
  1. identité stricte des sorties (métrique historique du pipeline) ;
  2. accord sur les normes décisives : pour chaque clause, ensemble des signatures
     (actor, modality, action, condition, notice, remedy) ; Jaccard moyen entre paires de passes ;
  3. stabilité de la détection : règles gelées appliquées à CHAQUE passe séparément, puis ensembles de phrases
     signalées comparés (Jaccard par paire, κ de Fleiss sur les phrases du jeu, phrases signalées par 1/2/3 passes) ;
  4. optionnel (`--reference`, conception uniquement) : diagnostic précision/rappel par passe et du vote majoritaire.

Le point 4 lit la référence CLAUDETTE : il relève de l'évaluation, jamais des règles ni de l'extraction. Le
script refuse `--reference` si une clause appartient à la population `holdout`.
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from itertools import combinations
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src"))

from detection.rules import evaluate_rules, load_rules  # noqa: E402
from detection.rules.evaluate import project_to_sentences  # noqa: E402
from detection.rules.model import norms_from_extraction  # noqa: E402

DECISIVE = ("actor", "modality", "action", "condition", "notice", "remedy")


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def jaccard(a: set, b: set) -> float:
    return 1.0 if not a and not b else len(a & b) / len(a | b)


def fleiss_kappa_binary(counts: list[int], raters: int) -> float | None:
    """κ de Fleiss pour une décision binaire : `counts[i]` = nombre de passes qui signalent l'item i."""
    n = len(counts)
    if n == 0 or raters < 2:
        return None
    p_yes = sum(counts) / (n * raters)
    p_e = p_yes ** 2 + (1 - p_yes) ** 2
    p_i = [(c * (c - 1) + (raters - c) * (raters - c - 1)) / (raters * (raters - 1)) for c in counts]
    p_bar = sum(p_i) / n
    return None if p_e == 1 else round((p_bar - p_e) / (1 - p_e), 4)


def prf(flagged: set, positives: set) -> dict:
    tp = len(flagged & positives)
    p = tp / len(flagged) if flagged else 0.0
    r = tp / len(positives) if positives else 0.0
    f = 2 * p * r / (p + r) if p + r else 0.0
    return {"flagged": len(flagged), "tp": tp, "precision": round(p, 4), "recall": round(r, 4), "f1": round(f, 4)}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Stabilité de l'extraction et de la détection entre répétitions.")
    ap.add_argument("--clauses", type=Path, required=True)
    ap.add_argument("--extraction", type=Path, required=True, help="step_5_corrected.jsonl multi-répétitions")
    ap.add_argument("--statuses", default="proposed")
    ap.add_argument("--reference", type=Path, default=None, help="reference.jsonl (conception uniquement)")
    ap.add_argument("--out", type=Path, default=None)
    args = ap.parse_args(argv)

    clauses = {c["clause_id"]: c for c in read_jsonl(args.clauses)}
    rows = read_jsonl(args.extraction)
    repeats = sorted({int(r["repeat"]) for r in rows})
    statuses = tuple(s.strip() for s in args.statuses.split(","))
    rules = load_rules(population="design")

    by_repeat: dict[int, list[dict]] = defaultdict(list)
    for r in rows:
        by_repeat[int(r["repeat"])].append(r)

    # 1–2. identité stricte et accord sur les signatures décisives
    per_clause: dict[str, dict[int, dict]] = defaultdict(dict)
    for r in rows:
        if r.get("output") is not None:
            per_clause[r["clause_id"]][int(r["repeat"])] = r["output"]
    complete = {cid: outs for cid, outs in per_clause.items() if len(outs) == len(repeats)}
    identical = sum(1 for outs in complete.values()
                    if len({json.dumps(o, sort_keys=True) for o in outs.values()}) == 1)
    sig_jaccards, empty_agree = [], 0
    for outs in complete.values():
        sigs = {k: {tuple(n[f] for f in DECISIVE) for n in o["norms"]} for k, o in outs.items()}
        sig_jaccards += [jaccard(sigs[a], sigs[b]) for a, b in combinations(sorted(sigs), 2)]
        empty_agree += int(len({bool(o["norms"]) for o in outs.values()}) == 1)
    norms_per_repeat = {k: sum(len(r["output"]["norms"]) for r in v if r.get("output")) for k, v in by_repeat.items()}

    # 3. détection par passe
    sentences = [(c["document"], s["index"]) for c in clauses.values() for s in c["sentences"]]
    flagged: dict[int, set] = {}
    matches_by_rule: dict[int, dict] = {}
    for k in repeats:
        norms = norms_from_extraction(by_repeat[k], clauses)
        ms = evaluate_rules(rules, norms, statuses=statuses)
        flagged[k] = set(project_to_sentences(ms))
        counts = defaultdict(int)
        for m in ms:
            counts[m.rule_id] += 1
        matches_by_rule[k] = dict(sorted(counts.items()))
    votes = {s: sum(s in flagged[k] for k in repeats) for s in sentences}
    majority = {s for s, v in votes.items() if v * 2 > len(repeats)}
    detection = {
        "flagged_per_repeat": {k: len(v) for k, v in flagged.items()},
        "matches_by_rule_per_repeat": matches_by_rule,
        "pairwise_jaccard": {f"{a}-{b}": round(jaccard(flagged[a], flagged[b]), 4) for a, b in combinations(repeats, 2)},
        "flagged_by_n_repeats": {n: sum(1 for v in votes.values() if v == n) for n in range(1, len(repeats) + 1)},
        "fleiss_kappa_sentences": fleiss_kappa_binary(list(votes.values()), len(repeats)),
        "majority_flagged": len(majority),
    }

    report = {
        "extraction": str(args.extraction), "n_clauses": len(clauses), "repeats": repeats,
        "rules_sha256": rules["_sha256"], "statuses": statuses,
        "extraction_stability": {
            "clauses_complete": len(complete),
            "identical_outputs_share": round(identical / len(complete), 4) if complete else None,
            "decisive_signature_jaccard_mean": round(sum(sig_jaccards) / len(sig_jaccards), 4) if sig_jaccards else None,
            "empty_vs_nonempty_agreement": round(empty_agree / len(complete), 4) if complete else None,
            "norms_per_repeat": norms_per_repeat,
        },
        "detection_stability": detection,
    }

    if args.reference:
        if any(c.get("population") == "holdout" for c in clauses.values()):
            raise SystemExit("--reference refusé : des clauses du hold-out sont présentes (diagnostic de conception seulement)")
        positives = set()
        for r in read_jsonl(args.reference):
            key = (r["document"], r["index"])
            if key in votes:
                positives.add(key)
        report["design_diagnostic"] = {
            "note": "conception, normes non validées, pilote enrichi en thèmes à risque : pas un résultat publiable",
            "sentences": len(sentences), "positives": len(positives),
            "per_repeat": {k: prf(flagged[k], positives) for k in repeats},
            "majority_vote": prf(majority, positives),
        }

    text = json.dumps(report, indent=1, ensure_ascii=False)
    if args.out:
        args.out.write_text(text, encoding="utf-8")
    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

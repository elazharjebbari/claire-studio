"""Analyse POST HOC (non pré-enregistrée) citée en § 9 : complémentarité des requêtes et de Legal-BERT.

Lit uniquement artifacts/ : evaluation/sentences_eval_pass0.jsonl (décisions par phrase de l'évaluation passe 0)
et baselines/B2_legal-bert_holdout_predictions.jsonl (scores de l'encodeur). Écrit
artifacts/evaluation/POSTHOC_complementarity.json : phrases abusives retrouvées par les seules requêtes et leurs
scores, et performance de l'union naïve des deux systèmes. Usage : python3 tools/post_hoc_complementarity.py
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

A = Path(__file__).resolve().parents[1] / "artifacts"
EVAL = A / "evaluation" / "sentences_eval_pass0.jsonl"
PRED = A / "baselines" / "B2_legal-bert_holdout_predictions.jsonl"


def prf(tp: int, fp: int, fn: int) -> dict:
    p = tp / (tp + fp) if tp + fp else 0.0
    r = tp / (tp + fn) if tp + fn else 0.0
    return {"tp": tp, "fp": fp, "fn": fn, "precision": round(p, 4), "recall": round(r, 4),
            "f1": round(2 * p * r / (p + r), 4) if p + r else 0.0}


def main() -> int:
    ev = {}
    for line in EVAL.read_text(encoding="utf-8").splitlines():
        r = json.loads(line)
        ev[(r["document"], r["index"])] = r["any"]
    score = {}
    for line in PRED.read_text(encoding="utf-8").splitlines():
        r = json.loads(line)
        score[(r["document"], r["index"])] = r["scores"]["unfair"]
    rules_only = sorted(k for k, a in ev.items() if a["y_true"] and a["rules"] and not a["B2"])
    scores = [score[k] for k in rules_only]
    union = [a["rules"] or a["B2"] for a in ev.values()]
    truth = [a["y_true"] for a in ev.values()]
    tp = sum(u and t for u, t in zip(union, truth)); fp = sum(u and not t for u, t in zip(union, truth))
    fn = sum(t and not u for u, t in zip(union, truth))
    b2 = [a["B2"] for a in ev.values()]
    out = {
        "note": "analyse post hoc, non pré-enregistrée ; passe 0 ; phrase = unité ; toute étiquette CLAUDETTE",
        "inputs": {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in (EVAL, PRED)},
        "positives": sum(truth),
        "rules_retrieved_positives": sum(a["y_true"] and a["rules"] for a in ev.values()),
        "rules_only_positives": len(rules_only),
        "rules_only_encoder_score": {"lt_0.1": sum(s < 0.1 for s in scores), "lt_0.25": sum(s < 0.25 for s in scores),
                                     "ge_0.4": sum(s >= 0.4 for s in scores)},
        "rules_only_sentences": [{"document": d, "index": i, "encoder_unfair_score": round(score[(d, i)], 6)} for d, i in rules_only],
        "encoder_alone": prf(sum(b and t for b, t in zip(b2, truth)), sum(b and not t for b, t in zip(b2, truth)), sum(t and not b for b, t in zip(b2, truth))),
        "naive_union_rules_or_encoder": prf(tp, fp, fn),
    }
    (A / "evaluation" / "POSTHOC_complementarity.json").write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({k: v for k, v in out.items() if k not in ("rules_only_sentences", "inputs")}, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

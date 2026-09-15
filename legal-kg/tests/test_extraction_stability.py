"""Stabilité inter-passes : mesures d'extraction et de détection sur un jeu synthétique à trois répétitions."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from evaluation import extraction_stability as es  # noqa: E402


def _clause(doc, local, theme, n=2, population="designSet", start=10):
    return {"clause_id": f"clause:{doc}:consensus:{local}", "document": doc, "theme_T11": theme, "population": population,
            "sentences": [{"index": start + i, "text": f"sentence {i}"} for i in range(n)], "action_inventory": ["terminate", "other"]}


def _row(cid, repeat, norms):
    return {"clause_id": cid, "repeat": repeat, "status": "proposed", "output": {"clause_id": cid, "norms": norms, "no_norm_reason": None if norms else "informational"}}


def _term(evidence=(0,), condition="discretion"):
    return {"actor": "provider", "modality": "power", "action": "terminate", "condition": condition, "notice": "not_stated",
            "remedy": "not_stated", "evidence": list(evidence), "confidence": 0.9}


@pytest.fixture
def data(tmp_path):
    c1, c2 = _clause("Doc", "0001", "TERMINATION", start=10), _clause("Doc", "0002", "TERMINATION", start=20)
    rows = [
        # clause 1 : identique sur les 3 passes → signalée 3 fois par Q-g
        _row(c1["clause_id"], 0, [_term()]), _row(c1["clause_id"], 1, [_term()]), _row(c1["clause_id"], 2, [_term()]),
        # clause 2 : résiliation « pour motif » dans une passe sur 3 (éteint Q-g ET Q-f-asymmetry) → signalée 2 fois (majorité)
        _row(c2["clause_id"], 0, [_term(evidence=(1,))]), _row(c2["clause_id"], 1, [_term(evidence=(1,), condition="for_cause")]),
        _row(c2["clause_id"], 2, [_term(evidence=(1,))]),
    ]
    (tmp_path / "clauses.jsonl").write_text("\n".join(json.dumps(c) for c in (c1, c2)) + "\n")
    (tmp_path / "step5.jsonl").write_text("\n".join(json.dumps(r) for r in rows) + "\n")
    (tmp_path / "reference.jsonl").write_text(json.dumps({"document": "Doc", "index": 10, "category": "TER", "level": 2}) + "\n")
    return tmp_path


def test_measures(data, capsys):
    es.main(["--clauses", str(data / "clauses.jsonl"), "--extraction", str(data / "step5.jsonl"),
             "--reference", str(data / "reference.jsonl"), "--out", str(data / "out.json")])
    r = json.loads((data / "out.json").read_text())
    ext, det = r["extraction_stability"], r["detection_stability"]
    assert ext["clauses_complete"] == 2 and ext["identical_outputs_share"] == 0.5
    assert ext["decisive_signature_jaccard_mean"] == pytest.approx((3 * 1.0 + 1.0 + 0.0 + 0.0) / 6, abs=1e-4)
    assert det["flagged_per_repeat"] == {"0": 2, "1": 1, "2": 2}
    assert det["flagged_by_n_repeats"] == {"1": 0, "2": 1, "3": 1}
    assert det["majority_flagged"] == 2
    assert det["fleiss_kappa_sentences"] is not None
    diag = r["design_diagnostic"]
    assert diag["positives"] == 1 and diag["majority_vote"]["tp"] == 1 and diag["majority_vote"]["precision"] == 0.5


def test_reference_refused_on_holdout(data):
    c = _clause("Doc", "0003", "TERMINATION", population="holdout", start=30)
    with (data / "clauses.jsonl").open("a") as fh:
        fh.write(json.dumps(c) + "\n")
    with pytest.raises(SystemExit, match="hold-out"):
        es.main(["--clauses", str(data / "clauses.jsonl"), "--extraction", str(data / "step5.jsonl"),
                 "--reference", str(data / "reference.jsonl")])


def test_fleiss_binary_edge_cases():
    assert es.fleiss_kappa_binary([], 3) is None
    assert es.fleiss_kappa_binary([3, 0, 3, 0], 3) == 1.0
    assert es.fleiss_kappa_binary([0, 0, 0], 3) is None      # aucun signalement : accord attendu = 1, κ indéfini

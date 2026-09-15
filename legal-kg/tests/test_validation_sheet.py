"""Feuille de validation juriste : une ligne par norme, clauses instables marquées, aucune référence d'abusivité."""
import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src" / "extraction"))
import validation_sheet as vs  # noqa: E402

PILOT = ROOT / "data" / "annotations" / "pilot_100" / "clauses.jsonl"


def test_sheet_from_synthetic_two_passes(tmp_path):
    clauses = [json.loads(l) for l in PILOT.read_text().splitlines()[:2]]
    inv = clauses[0]["action_inventory"]
    def norm(action, condition="none_stated"):
        return {"actor": "provider", "modality": "permission", "action": action, "object": None, "condition": condition,
                "notice": "not_stated", "remedy": "not_stated", "evidence": [0], "confidence": 0.7}
    rows = [
        {"clause_id": clauses[0]["clause_id"], "repeat": 0, "status": "proposed", "anchoring_flags": [{"norm": 0, "field": "condition", "value": "discretion"}],
         "output": {"clause_id": clauses[0]["clause_id"], "norms": [norm(inv[0], "discretion")], "no_norm_reason": None}},
        {"clause_id": clauses[0]["clause_id"], "repeat": 1, "status": "proposed", "output": {"clause_id": clauses[0]["clause_id"], "norms": [norm(inv[0])], "no_norm_reason": None}},
        {"clause_id": clauses[1]["clause_id"], "repeat": 0, "status": "proposed", "output": {"clause_id": clauses[1]["clause_id"], "norms": [], "no_norm_reason": "informational"}},
        {"clause_id": clauses[1]["clause_id"], "repeat": 1, "status": "proposed", "output": {"clause_id": clauses[1]["clause_id"], "norms": [], "no_norm_reason": "informational"}},
    ]
    (tmp_path / "c.jsonl").write_text("\n".join(json.dumps(c) for c in clauses) + "\n")
    (tmp_path / "s5.jsonl").write_text("\n".join(json.dumps(r) for r in rows) + "\n")
    assert vs.main(["--clauses", str(tmp_path / "c.jsonl"), "--extraction", str(tmp_path / "s5.jsonl"), "--out", str(tmp_path / "v")]) == 0
    sheet = list(csv.DictReader((tmp_path / "v" / "validation_sheet.csv").open()))
    assert [r["stability"] for r in sheet] == ["unstable", "stable"]
    assert sheet[0]["anchoring_flags"] == "condition→discretion" and sheet[0]["decision"] == ""
    assert sheet[1]["norm_no"] == "" and "no_norm_reason=informational" in sheet[1]["action"]
    md = (tmp_path / "v" / "validation_sheet.md").read_text()
    body = re.sub(r"^\[\d+\] .*$", "", md, flags=re.M)          # hors texte des contrats
    assert not re.search(r"\bunfair|\babusi|\bLABELED\b|\b(LTD|TER|CH|CR|USE|LAW)\b", body)

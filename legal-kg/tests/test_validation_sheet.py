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


def test_merge_applies_decisions(tmp_path):
    clauses = [json.loads(l) for l in PILOT.read_text().splitlines()[:3]]
    inv = clauses[0]["action_inventory"]
    def norm(action, condition="none_stated"):
        return {"actor": "provider", "modality": "permission", "action": action, "object": None, "condition": condition,
                "notice": "not_stated", "remedy": "not_stated", "evidence": [0], "confidence": 0.7}
    c0, c1, c2 = (c["clause_id"] for c in clauses)
    rows = [
        {"clause_id": c0, "repeat": 0, "status": "proposed", "output": {"clause_id": c0, "norms": [norm(inv[0]), norm(inv[0], "discretion")], "no_norm_reason": None}},
        {"clause_id": c1, "repeat": 0, "status": "proposed", "output": {"clause_id": c1, "norms": [], "no_norm_reason": "informational"}},
        {"clause_id": c2, "repeat": 0, "status": "proposed", "output": {"clause_id": c2, "norms": [norm(inv[0])], "no_norm_reason": None}},
    ]
    (tmp_path / "c.jsonl").write_text("\n".join(json.dumps(c) for c in clauses) + "\n")
    (tmp_path / "s5.jsonl").write_text("\n".join(json.dumps(r) for r in rows) + "\n")
    vs.main(["--clauses", str(tmp_path / "c.jsonl"), "--extraction", str(tmp_path / "s5.jsonl"), "--out", str(tmp_path / "v")])
    sheet = list(csv.DictReader((tmp_path / "v" / "validation_sheet.csv").open()))
    # c0 : norme 0 validée, norme 1 corrigée (condition) ; c1 : ajout d'une norme ; c2 : sans décision → reste proposed
    for r in sheet:
        if r["clause_id"] == c0 and r["norm_no"] == "0":
            r.update(decision="validate", reviewer="fzb")
        if r["clause_id"] == c0 and r["norm_no"] == "1":
            r.update(decision="correct", corrected_fields="condition=for_cause; notice=reasonable", reviewer="fo")
        if r["clause_id"] == c1:
            r.update(decision="add", actor="user", modality="obligation", action=clauses[1]["action_inventory"][0],
                     condition="none_stated", notice="not_stated", remedy="not_stated", corrected_fields="evidence=0 1", reviewer="fzb")
    with (tmp_path / "v" / "filled.csv").open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=vs.COLUMNS); w.writeheader(); w.writerows(sheet)
    assert vs.main(["merge", "--clauses", str(tmp_path / "c.jsonl"), "--extraction", str(tmp_path / "s5.jsonl"),
                    "--sheet", str(tmp_path / "v" / "filled.csv"), "--out", str(tmp_path / "validated.jsonl"),
                    "--validated-at", "2026-09-16T00:00:00+00:00"]) == 0
    out = {r["clause_id"]: r for r in map(json.loads, (tmp_path / "validated.jsonl").read_text().splitlines())}
    assert set(out) == {c0, c1}
    assert out[c0]["status"] == "validated" and out[c0]["validated_by"] == "fo,fzb"
    assert [n["condition"] for n in out[c0]["output"]["norms"]] == ["none_stated", "for_cause"]
    assert out[c0]["output"]["norms"][1]["notice"] == "reasonable"
    assert out[c1]["output"]["norms"][0]["actor"] == "user" and out[c1]["output"]["norms"][0]["evidence"] == [0, 1]
    assert out[c1]["output"]["no_norm_reason"] is None

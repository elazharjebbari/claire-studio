"""Backend inline de l'extraction : lots rendus étanches, rejeu identique au backend API (étapes 2–5)."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src" / "extraction"))

import inline_backend as ib  # noqa: E402

PILOT = ROOT / "data" / "annotations" / "pilot_100" / "clauses.jsonl"
FORBIDDEN_WORDS = re.compile(r"\bunfair|\babusi|\bgrey.?list|\bannex\b|93/13", re.I)
FORBIDDEN_CODES = re.compile(r"\bLABELED\b|\b(LTD|TER|CH|CR|USE|LAW)\b")   # codes : sensibles à la casse


def _clauses(n):
    return [json.loads(l) for l in PILOT.read_text(encoding="utf-8").splitlines()[:n]]


def test_export_renders_isolated_batches(tmp_path):
    assert ib.main(["export", "--clauses", str(PILOT), "--out", str(tmp_path), "--batch-size", "40"]) == 0
    manifest = json.loads((tmp_path / "MANIFEST.json").read_text())
    assert [len(b["clause_ids"]) for b in manifest["batches"]] == [40, 40, 20]
    for b in manifest["batches"]:
        text = (tmp_path / b["file"]).read_text()
        # Les phrases du contrat sont exclues du contrôle : le texte d'un ToS peut légitimement contenir ces mots
        # (« fraudulent or abusive activity », clause Atlas 0050). Seules les instructions rendues comptent.
        sentences = re.findall(r"^\[\d+\] .*$", text, flags=re.M)
        assert sentences, "aucune phrase rendue"
        text = re.sub(r"^\[\d+\] .*$", "", text, flags=re.M)
        # l'en-tête du fichier de prompt (qui énonce les interdits) n'est pas rendu dans les lots
        assert not FORBIDDEN_WORDS.search(text), FORBIDDEN_WORDS.search(text)
        assert not FORBIDDEN_CODES.search(text), FORBIDDEN_CODES.search(text)
        for cid in b["clause_ids"]:
            assert f"clause_id: `{cid}`" in text
        assert "{{" not in text, "gabarit non rendu"


def test_replay_valid_invalid_missing(tmp_path):
    ib.main(["export", "--clauses", str(PILOT), "--out", str(tmp_path), "--batch-size", "3", "--limit", "3"])
    c0, c1, c2 = _clauses(3)
    inv0 = c0["action_inventory"]
    good = {"clause_id": c0["clause_id"], "no_norm_reason": None, "norms": [
        {"actor": "provider", "modality": "power", "action": inv0[0], "object": None, "condition": "none_stated",
         "notice": "not_stated", "remedy": "not_stated", "evidence": [0], "confidence": 0.8}]}
    bad = {"clause_id": c1["clause_id"], "no_norm_reason": None, "norms": [
        {"actor": "provider", "modality": "may", "action": "x", "condition": "none_stated", "notice": "not_stated",
         "remedy": "not_stated", "evidence": [0], "confidence": 0.8}]}
    lines = [json.dumps(good), "```", json.dumps(bad)]   # une clôture de bloc parasite est ignorée
    (tmp_path / "responses" / "r0_batch_01.jsonl").write_text("\n".join(lines) + "\n")
    assert ib.main(["replay", "--clauses", str(PILOT), "--run-dir", str(tmp_path), "--limit", "3"]) == 0
    run = json.loads((tmp_path / "run.json").read_text())
    assert run["backend"] == "inline_subagent" and run["protocol_deviations"]
    assert run["counts"] == {"schema_ok": 1, "missing": 1, "schema_errors": 1, "norms": 1, "empty": 0}
    step5 = [json.loads(l) for l in (tmp_path / "step_5_corrected.jsonl").read_text().splitlines()]
    assert [r["clause_id"] for r in step5] == [c0["clause_id"]]
    assert step5[0]["status"] == "proposed" and step5[0]["repeat"] == 0


def test_replay_refuses_changed_prompt(tmp_path, monkeypatch):
    ib.main(["export", "--clauses", str(PILOT), "--out", str(tmp_path), "--limit", "1"])
    manifest = json.loads((tmp_path / "MANIFEST.json").read_text())
    manifest["prompt_hash"] = "0" * 64
    (tmp_path / "MANIFEST.json").write_text(json.dumps(manifest))
    try:
        ib.main(["replay", "--clauses", str(PILOT), "--run-dir", str(tmp_path), "--limit", "1"])
    except SystemExit as exc:
        assert "prompt" in str(exc)
    else:
        raise AssertionError("un prompt modifié après export doit être refusé")

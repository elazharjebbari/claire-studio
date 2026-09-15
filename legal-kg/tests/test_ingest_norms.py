"""Ingestion L3/L5 : identifiants NAMING.md, evidence absolue, sélection d'une ligne par clause, étanchéité du Cypher."""
from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from graph import ingest_norms  # noqa: E402
from detection.rules.model import norm_id_for  # noqa: E402

CLAUSES = [
    {"clause_id": "clause:9gag:consensus:0003", "document": "9gag", "theme_T11": "TERMINATION",
     "sentences": [{"index": 40, "text": "a"}, {"index": 41, "text": "b"}, {"index": 42, "text": "c"}]},
    {"clause_id": "clause:9gag:consensus:0007", "document": "9gag", "theme_T11": "FEES_PAYMENT", "sentences": [{"index": 90, "text": "z"}]},
]
NORM = {"actor": "provider", "counterparty": "user", "modality": "power", "action": "terminate", "object": "account",
        "condition": "discretion", "notice": "not_stated", "remedy": "not_stated", "evidence": [1, 2], "confidence": 0.9}
ROWS = [
    {"clause_id": "clause:9gag:consensus:0003", "repeat": 0, "status": "validated", "validated_by": "fatima.ouali",
     "validated_at": "2026-09-20T10:00:00Z", "output": {"clause_id": "clause:9gag:consensus:0003", "norms": [NORM]}},
    {"clause_id": "clause:9gag:consensus:0003", "repeat": 1, "status": "proposed", "output": {"clause_id": "clause:9gag:consensus:0003", "norms": [NORM]}},
    {"clause_id": "clause:9gag:consensus:0007", "repeat": 0, "status": "validated", "output": {"clause_id": "clause:9gag:consensus:0007", "norms": [], "no_norm_reason": "not_applicable"}},
]
MATCHES = [{"rule_id": "Q-g", "item": "g", "norm_id": norm_id_for("clause:9gag:consensus:0003", 0), "clause_id": "clause:9gag:consensus:0003",
            "document": "9gag", "evidence": [41, 42], "satisfied": {}, "family": "R1", "rule_version": "0.1", "rules_sha256": "8f29", "run_id": "run-x"}]


def _write(tmp_path: Path):
    (tmp_path / "clauses.jsonl").write_text("\n".join(json.dumps(c) for c in CLAUSES), encoding="utf-8")
    (tmp_path / "extraction.jsonl").write_text("\n".join(json.dumps(r) for r in ROWS), encoding="utf-8")
    (tmp_path / "matches.jsonl").write_text("\n".join(json.dumps(m) for m in MATCHES), encoding="utf-8")


def _csv(p: Path):
    return list(csv.DictReader(p.open(encoding="utf-8")))


def test_norm_id_follows_naming():
    assert norm_id_for("clause:9gag:consensus:0003", 1) == "norm:9gag:consensus:c0003:n1"


def test_ingest_end_to_end(tmp_path):
    _write(tmp_path)
    out = tmp_path / "out"
    ingest_norms.main(["--clauses", str(tmp_path / "clauses.jsonl"), "--extraction", str(tmp_path / "extraction.jsonl"),
                       "--matches", str(tmp_path / "matches.jsonl"), "--source", "llm:test", "--run-id", "run-ingest", "--out", str(out)])
    norms = _csv(out / "norms.csv")
    assert [n["id"] for n in norms] == ["norm:9gag:consensus:c0003:n0"]
    assert norms[0]["status"] == "validated" and norms[0]["source"] == "llm:test" and norms[0]["document_id"] == "document:9gag"
    assert norms[0]["confidence"] == "0.9" and norms[0]["amount_ratio"] == ""
    ev = _csv(out / "norm_evidence.csv")
    assert [e["sentence_id"] for e in ev] == ["sentence:9gag:41", "sentence:9gag:42"]   # indices relatifs → absolus
    m = _csv(out / "matches.csv")
    assert m[0]["item"] == "g" and m[0]["evidence_ids"] == "sentence:9gag:41|sentence:9gag:42" and m[0]["rule_version"] == "0.1"
    act = _csv(out / "activities.csv")
    assert act[0]["actor"] == "fatima.ouali" and act[0]["norm_id"] == "norm:9gag:consensus:c0003:n0"
    cl = _csv(out / "clauses.csv")
    assert {c["id"] for c in cl} == {"clause:9gag:consensus:0003", "clause:9gag:consensus:0007"}
    assert _csv(out / "clause_themes.csv")[0]["theme_key"] == "TERMINATION@T11"
    assert len(_csv(out / "clause_sentences.csv")) == 4
    summary = json.loads((out / "INGEST.json").read_text())
    assert summary["clauses_ingested"] == 2 and summary["clauses_without_norm"] == 1 and summary["counts"]["norms"] == 1


def test_select_repeat_and_ambiguity(tmp_path):
    rows = ingest_norms.select_rows(ROWS, "repeat:1")
    assert [r["clause_id"] for r in rows] == ["clause:9gag:consensus:0003"]
    dup = ROWS + [{"clause_id": "clause:9gag:consensus:0003", "repeat": 2, "status": "validated", "output": {"norms": []}}]
    with pytest.raises(SystemExit):
        ingest_norms.select_rows(dup, "validated")


def test_cypher_ingest_is_isolated():
    text = (ROOT / "graph" / "cypher" / "05_ingest_norms.cypher").read_text(encoding="utf-8")
    body = "\n".join(l for l in text.splitlines() if not l.strip().startswith("//"))
    assert not re.search(r"\bLABELED\b|\bCategory\b", body)
    for f in ("clauses.csv", "clause_sentences.csv", "clause_themes.csv", "norms.csv", "norm_evidence.csv", "norm_relations.csv", "matches.csv", "activities.csv", "run.csv"):
        assert f in text


def test_split_clause_gets_parent(tmp_path):
    clauses = CLAUSES + [{"clause_id": "clause:9gag:consensus:0029a", "document": "9gag", "theme_T11": "FEES_PAYMENT",
                          "split_of_long_clause": True, "sentences": [{"index": 300, "text": "x"}]}]
    rows = [{"clause_id": "clause:9gag:consensus:0029a", "repeat": 0, "status": "validated",
             "output": {"clause_id": "clause:9gag:consensus:0029a", "norms": [NORM]}}]
    tables = ingest_norms.build({c["clause_id"]: c for c in clauses}, rows, source="llm:test", run_id="r", matches=None, relations=None)
    assert tables["clauses"][0]["split_of"] == "clause:9gag:consensus:0029"
    assert tables["norms"][0]["id"] == "norm:9gag:consensus:c0029a:n0"

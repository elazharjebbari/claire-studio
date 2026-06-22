"""Parité front/back du moteur de triage.

Le moteur Python (claire.triage.engine) et le moteur TS (frontend/src/lib/triage/engine.ts)
doivent produire le MÊME routage. La parité est garantie via un golden set PARTAGÉ
(frontend/src/lib/triage/golden.cases.json) : le test TS asserte TS == golden, ce test
asserte Python == golden → transitivement TS == Python. Source unique = le golden + les
règles (rules.py miroir de rules.ts).
"""

import json
from pathlib import Path

import pytest

from claire.triage.engine import triage_engine
from claire.triage.rules import RULES

GOLDEN = (
    Path(__file__).resolve().parents[2]
    / "frontend" / "src" / "lib" / "triage" / "golden.cases.json"
)


def _load():
    data = json.loads(GOLDEN.read_text(encoding="utf-8"))
    return data


def test_golden_file_present_and_versioned():
    data = _load()
    assert data["rulesVersion"] == RULES["version"], "version de règles désalignée front/back"
    assert len(data["cases"]) >= 15


def _primary(labels):
    return next((x["label"] for x in labels if x["role"] == "primary"), None)


def _secondary(labels):
    return next((x["label"] for x in labels if x["role"] == "secondary"), None)


@pytest.mark.parametrize("case", _load()["cases"], ids=lambda c: c["id"])
def test_python_engine_matches_golden(case):
    r = triage_engine(case["votes"], case["boundary"], RULES)
    assert r is not None
    exp = case["expect"]
    assert r["level"] == exp["level"]
    assert r["action"] == exp["action"]
    assert r["label_mode"] == exp["labelMode"]
    assert r["needs_human"] == exp["needsHuman"]
    assert r["boundary"]["type"] == exp["boundaryType"]
    assert _primary(r["labels"]) == exp["primary"]
    assert _secondary(r["labels"]) == exp["secondary"]
    if exp["override"]:
        assert r["override"]["from"] == exp["override"]["from"]
        assert r["override"]["to"] == exp["override"]["to"]
    else:
        assert "override" not in r


def test_min_judges_returns_none():
    assert triage_engine({"claude": "LICENSE_IP"}, {"claude": True}, RULES) is None


def test_exhaustive_invariants_three_judges():
    """Balayage 20³ : invariants du protocole (miroir du test TS)."""
    codes = RULES["priority"]
    refuges = set(RULES["refuges"])
    n = 0
    for a in codes:
        for b in codes:
            for c in codes:
                r = triage_engine({"j1": a, "j2": b, "j3": c}, {"j1": True, "j2": True, "j3": True}, RULES)
                assert r is not None
                n += 1
                assert r["level"] in {"C1", "C2", "C3", "C4", "C5"}
                assert len(r["candidates"]) > 0
                assert r["needs_human"] == (r["level"] != "C1")
                if r["label_mode"] == "open":
                    assert r["labels"] == []
                    assert r["level"] == "C5"
                else:
                    primaries = [x for x in r["labels"] if x["role"] == "primary"]
                    assert len(primaries) == 1
                    for x in r["labels"]:
                        if x["role"] == "secondary":
                            assert x["label"] not in refuges
                if r["level"] in {"C3", "C4"}:
                    assert _primary(r["labels"]) not in refuges
    assert n == len(codes) ** 3

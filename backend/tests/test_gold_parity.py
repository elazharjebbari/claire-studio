"""Parité front/back du moteur de scoring GOLD.

Le moteur Python (claire.projects.gold_scoring) et le moteur TS
(frontend/src/lib/goldScoring.ts) doivent produire la MÊME décision. Golden PARTAGÉ
(frontend/src/lib/gold/golden.cases.json) : le test TS asserte TS == golden, ce test
asserte Python == golden → transitivement TS == Python. Module PUR → pas de DB.
"""

import json
from pathlib import Path

import pytest

from claire.projects.gold_scoring import Vote, score_sentence

GOLDEN = (
    Path(__file__).resolve().parents[2]
    / "frontend" / "src" / "lib" / "gold" / "golden.cases.json"
)


def _load():
    return json.loads(GOLDEN.read_text(encoding="utf-8"))


def _votes(spec):
    return [
        Vote(
            voter_id=v["voterId"],
            primary=v["primary"],
            secondaries=tuple(v.get("secondaries", [])),
            is_llm=v.get("isLlm", False),
        )
        for v in spec
    ]


def test_golden_present_and_versioned():
    data = _load()
    assert data["engineVersion"] == 2
    assert len(data["cases"]) >= 15


@pytest.mark.parametrize("case", _load()["cases"], ids=lambda c: c["id"])
def test_python_engine_matches_golden(case):
    s = score_sentence(_votes(case["votes"]), case.get("config") or None)
    exp = case["expect"]
    assert s.primary == exp["primary"]
    assert s.secondaries == exp["secondaries"]
    assert s.agreement_class == exp["agreementClass"]
    assert s.confidence == exp["confidence"]
    assert s.risk_band == exp["riskBand"]
    assert s.human_dissent == exp["humanDissent"]
    assert s.human_block == exp["humanBlock"]
    assert s.llm_block == exp["llmBlock"]
    assert s.auto_level == exp["autoLevel"]

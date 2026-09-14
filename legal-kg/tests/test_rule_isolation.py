"""Étanchéité : les règles et les prompts ne doivent jamais voir la référence d'abusivité.

- graph/rules/*.yaml et 02_detection_queries.cypher : interdiction de LABELED, Category, des codes de
  catégories CLAUDETTE et du mot « unfair » ;
- llm/prompts/*.md (parties System/User) : interdiction des catégories, des items « Annex », de « unfair ».
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATEGORY_CODES = {"LTD", "TER", "CH", "CR", "USE", "LAW"}   # A et J trop courts pour un test lexical : couverts par « Category »
FORBIDDEN_RULES = [r"\bLABELED\b", r"\bCategory\b", r"\bunfair", r"\babusive"]


def _body_without_comments(text: str, comment_prefix: str) -> str:
    return "\n".join(l for l in text.splitlines() if not l.strip().startswith(comment_prefix))


def test_rules_yaml_isolated():
    for p in (ROOT / "graph" / "rules").glob("*.yaml"):
        body = _body_without_comments(p.read_text(encoding="utf-8"), "#")
        for pat in FORBIDDEN_RULES:
            assert not re.search(pat, body), f"{p.name} mentionne {pat}"
        for code in CATEGORY_CODES:
            assert not re.search(rf"\b{code}\b", body), f"{p.name} mentionne la catégorie {code}"


def test_detection_cypher_isolated():
    p = ROOT / "graph" / "cypher" / "02_detection_queries.cypher"
    body = _body_without_comments(p.read_text(encoding="utf-8"), "//")
    for pat in FORBIDDEN_RULES:
        assert not re.search(pat, body), f"02_detection_queries.cypher mentionne {pat}"


def test_prompts_isolated():
    for p in (ROOT / "llm" / "prompts").glob("*.md"):
        if p.name == "PROMPT_REGISTRY.md":
            continue
        text = p.read_text(encoding="utf-8")
        # ne tester que le prompt effectif (à partir de « ## System »), pas l'en-tête de gouvernance
        start = text.find("## System")
        body = text[start:] if start >= 0 else text
        for pat in [r"\bunfair", r"\babusive", r"\bAnnex\b", r"\bDirective\b", r"\bCLAUDETTE\b"]:
            assert not re.search(pat, body), f"{p.name} contient {pat}"
        for code in CATEGORY_CODES:
            assert not re.search(rf"\b{code}\b", body), f"{p.name} contient la catégorie {code}"

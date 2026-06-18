"""Pre-annotation loaders (feature 2) — normalise v9.2 and v9.4 to the pivot.

Pivot clause (CONTRACT §4):
    {anchor_index, theme, evidence_span, rationale}

Source formats:
- v9.4: {doc, judge, version, plan: {clauses: [{clause_id, theme, open_span, anchor_id}]}}
- v9.2: {doc, judge, version, document_plan: {segments: [{start_id, theme, rationale, evidence_span}]}}
"""

from __future__ import annotations

import logging

logger = logging.getLogger("claire.imports")


class PreAnnotationFormatError(ValueError):
    """Raised when a pre-annotation payload matches no known schema."""


def detect_schema_version(raw: dict) -> str:
    """Return a normalised schema tag: 'v9.4' or 'v9.2'."""
    if "plan" in raw and isinstance(raw.get("plan"), dict):
        return "v9.4"
    if "document_plan" in raw and isinstance(raw.get("document_plan"), dict):
        return "v9.2"
    raise PreAnnotationFormatError(
        "Unknown pre-annotation format (expected 'plan' or 'document_plan')."
    )


def normalize_v94(raw: dict) -> list[dict]:
    """v9.4 plan.clauses[] -> pivot clauses."""
    clauses = raw.get("plan", {}).get("clauses", [])
    out: list[dict] = []
    for i, c in enumerate(clauses):
        out.append(
            {
                "anchor_index": int(c["anchor_id"]),
                "theme": c.get("theme", ""),
                "evidence_span": c.get("open_span", ""),
                "rationale": c.get("rationale", ""),
                "order": i,
            }
        )
    return out


def normalize_v92(raw: dict) -> list[dict]:
    """v9.2 document_plan.segments[] -> pivot clauses."""
    segments = raw.get("document_plan", {}).get("segments", [])
    out: list[dict] = []
    for i, s in enumerate(segments):
        out.append(
            {
                "anchor_index": int(s["start_id"]),
                "theme": s.get("theme", ""),
                "evidence_span": s.get("evidence_span", ""),
                "rationale": s.get("rationale", ""),
                "order": i,
            }
        )
    return out


def normalize_preannotation(raw: dict) -> tuple[str, list[dict]]:
    """Dispatch to the right normaliser.

    Returns (schema_version, pivot_clauses).
    """
    version = detect_schema_version(raw)
    if version == "v9.4":
        return version, normalize_v94(raw)
    return version, normalize_v92(raw)

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
    """Return a normalised schema tag: 'v9.4' or 'v9.2'.

    Raises PreAnnotationFormatError when ``raw`` is not a mapping or matches no
    known schema, so callers get a clear error instead of an opaque crash.
    """
    if not isinstance(raw, dict):
        raise PreAnnotationFormatError(
            f"Pre-annotation payload must be a JSON object, got {type(raw).__name__}."
        )
    if "plan" in raw and isinstance(raw.get("plan"), dict):
        return "v9.4"
    if "document_plan" in raw and isinstance(raw.get("document_plan"), dict):
        return "v9.2"
    raise PreAnnotationFormatError(
        "Unknown pre-annotation format (expected 'plan' or 'document_plan')."
    )


def _coerce_anchor(value, *, where: str, position: int) -> int:
    """Parse an anchor index, raising a clear error on malformed values."""
    if value is None:
        raise PreAnnotationFormatError(
            f"Missing anchor index in {where} item #{position}."
        )
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise PreAnnotationFormatError(
            f"Invalid anchor index {value!r} in {where} item #{position}."
        ) from exc


def normalize_v94(raw: dict) -> list[dict]:
    """v9.4 plan.clauses[] -> pivot clauses."""
    clauses = raw.get("plan", {}).get("clauses", [])
    if not isinstance(clauses, list):
        raise PreAnnotationFormatError("v9.4 'plan.clauses' must be a list.")
    out: list[dict] = []
    for i, c in enumerate(clauses):
        if not isinstance(c, dict):
            raise PreAnnotationFormatError(
                f"v9.4 clause #{i} must be an object, got {type(c).__name__}."
            )
        out.append(
            {
                "anchor_index": _coerce_anchor(
                    c.get("anchor_id"), where="v9.4 plan.clauses", position=i
                ),
                "theme": c.get("theme", ""),
                # Tolérant : v9.4 = open_span ; v9.3 = evidence_span. Champs en plus
                # (ex. v9.3 `macro`) ignorés ici mais conservés dans `raw`.
                "evidence_span": c.get("open_span") or c.get("evidence_span", ""),
                "rationale": c.get("rationale", ""),
                "legal_nature": c.get("legal_nature", ""),
                "order": i,
            }
        )
    return out


def _nature_by_index(raw: dict) -> dict[int, str]:
    """Nature juridique PAR PHRASE depuis `annotations[]` (v9.2), si présent.

    Le LLM dérive une `legal_nature` par phrase (clé `id`) dans un tableau parallèle
    aux segments. On l'indexe pour l'attacher au segment dont c'est la phrase d'ancre.
    Tolérant : absent / malformé → dict vide (la nature LLM reste optionnelle).
    """
    annotations = raw.get("annotations")
    out: dict[int, str] = {}
    if isinstance(annotations, list):
        for a in annotations:
            if not isinstance(a, dict) or "id" not in a:
                continue
            try:
                out[int(a["id"])] = str(a.get("legal_nature") or "")
            except (TypeError, ValueError):
                continue
    return out


def _segments_from_annotations(annotations) -> list[dict]:
    """Repli : reconstruit les segments (vue BLOCS) depuis `annotations[]` (vue PHRASE)
    quand `document_plan.segments` est vide. Un segment commence à chaque
    `is_block_start` ; à défaut de marqueurs, on coupe à chaque changement de thème.
    Données Mistral FIDÈLES (réassemblage, pas de fabrication) — complète un doc dont
    le plan de blocs n'a pas été émis (ex. Instagram). evidence/rationale de l'ancre."""
    if not isinstance(annotations, list):
        return []
    rows = [
        a for a in annotations
        if isinstance(a, dict) and "id" in a and a.get("theme")
    ]
    if not rows:
        return []
    try:
        rows.sort(key=lambda a: int(a["id"]))
    except (TypeError, ValueError):
        return []
    has_markers = any(a.get("is_block_start") for a in rows)
    out: list[dict] = []
    prev_theme = None
    for a in rows:
        is_start = a.get("is_block_start") if has_markers else (a.get("theme") != prev_theme)
        if is_start:
            rc = a.get("rationale_codes") if isinstance(a.get("rationale_codes"), dict) else {}
            out.append(
                {
                    "start_id": int(a["id"]),
                    "theme": a.get("theme", ""),
                    "rationale": a.get("rationale", "") or "",
                    "evidence_span": (rc.get("evidence_span") or a.get("evidence_span") or ""),
                }
            )
        prev_theme = a.get("theme")
    return out


def normalize_v92(raw: dict) -> list[dict]:
    """v9.2 document_plan.segments[] -> pivot clauses (+ legal_nature de l'ancre).

    Repli robuste : si le plan de blocs est vide mais que `annotations[]` est présent,
    on reconstruit les segments depuis la vue par phrase (cf. _segments_from_annotations).
    """
    segments = raw.get("document_plan", {}).get("segments", [])
    if not isinstance(segments, list):
        raise PreAnnotationFormatError(
            "v9.2 'document_plan.segments' must be a list."
        )
    if not segments:
        segments = _segments_from_annotations(raw.get("annotations"))
    nature = _nature_by_index(raw)
    out: list[dict] = []
    for i, s in enumerate(segments):
        if not isinstance(s, dict):
            raise PreAnnotationFormatError(
                f"v9.2 segment #{i} must be an object, got {type(s).__name__}."
            )
        anchor = _coerce_anchor(
            s.get("start_id"), where="v9.2 document_plan.segments", position=i,
        )
        out.append(
            {
                "anchor_index": anchor,
                "theme": s.get("theme", ""),
                "evidence_span": s.get("evidence_span", ""),
                "rationale": s.get("rationale", ""),
                # Nature juridique LLM de la phrase d'ancre (consultation, axe 2/3b).
                "legal_nature": nature.get(anchor, ""),
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

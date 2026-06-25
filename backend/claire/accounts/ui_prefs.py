"""Préférences d'interface PAR COMPTE — validation/fusion serveur (whitelist stricte).

Le blob `ui_preferences` est stocké VERBATIM en camelCase (contrat front
frontend/src/lib/prefs/schema.ts ; exclu de la conversion camel↔snake côté DRF). Le PATCH
est PARTIEL : on fusionne l'``incoming`` (camelCase) sur l'``existing`` stocké, en n'acceptant
QUE les clés connues (whitelist — pas de JSON arbitraire), en bornant les énumérations, et en
forçant la version. Les ids de modèle (``llmSource``, ``prefill.judge``, clés de ``ghostJudges``)
restent des chaînes LIBRES.

PUR (aucune dépendance Django) → testable isolément.
"""

from __future__ import annotations

UI_PREFS_SCHEMA_VERSION = 1
_DISPLAY_LANGS = ("orig", "both", "fr")

DEFAULTS: dict = {
    "v": UI_PREFS_SCHEMA_VERSION,
    "overlays": {"showUnfairness": True, "displayLang": "orig", "llmSource": "human"},
    "ghostJudges": {},
    "panels": {
        "inspectorOpen": True,
        "sidebarCollapsed": False,
        "planCollapsed": False,
        "historyOpen": False,
        "commentsOpen": False,
        "triageOpen": False,
        "docControlsCollapsed": False,
    },
    "prefill": {"enabled": False, "judge": None, "asked": False},
}

_BOOL_KEYS = {
    "overlays": ["showUnfairness"],
    "panels": [
        "inspectorOpen", "sidebarCollapsed", "planCollapsed", "historyOpen", "commentsOpen",
        "triageOpen", "docControlsCollapsed",
    ],
    "prefill": ["enabled", "asked"],
}


def _as_bool(x, default):
    return x if isinstance(x, bool) else default


def normalize_ui_preferences(raw) -> dict:
    """Renvoie un blob complet et valide à partir d'une valeur brute (fusion aux défauts)."""
    return merge_ui_preferences(DEFAULTS, raw if isinstance(raw, dict) else {})


def merge_ui_preferences(existing, incoming) -> dict:
    """Fusionne ``incoming`` (PATCH partiel) sur ``existing``, whitelist stricte + bornage.

    `existing` est censé être un blob déjà propre (ou {} / DEFAULTS) ; `incoming` est le payload
    partiel reçu. Toute clé inconnue est IGNORÉE. Renvoie un nouveau dict (ne mute rien).
    """
    base = existing if isinstance(existing, dict) else {}
    inc = incoming if isinstance(incoming, dict) else {}

    def section(name):
        b = base.get(name) if isinstance(base.get(name), dict) else {}
        i = inc.get(name) if isinstance(inc.get(name), dict) else {}
        return b, i

    ob, oi = section("overlays")
    pb, pi = section("panels")
    fb, fi = section("prefill")

    out = {"v": UI_PREFS_SCHEMA_VERSION}

    # overlays --------------------------------------------------------------
    overlays = {}
    overlays["showUnfairness"] = _as_bool(
        oi.get("showUnfairness", ob.get("showUnfairness")),
        DEFAULTS["overlays"]["showUnfairness"],
    )
    dl = oi.get("displayLang", ob.get("displayLang", DEFAULTS["overlays"]["displayLang"]))
    overlays["displayLang"] = dl if dl in _DISPLAY_LANGS else DEFAULTS["overlays"]["displayLang"]
    src = oi.get("llmSource", ob.get("llmSource", DEFAULTS["overlays"]["llmSource"]))
    overlays["llmSource"] = src if isinstance(src, str) and src else DEFAULTS["overlays"]["llmSource"]
    out["overlays"] = overlays

    # panels ----------------------------------------------------------------
    panels = {}
    for k in _BOOL_KEYS["panels"]:
        panels[k] = _as_bool(pi.get(k, pb.get(k)), DEFAULTS["panels"][k])
    out["panels"] = panels

    # prefill ---------------------------------------------------------------
    prefill = {}
    prefill["enabled"] = _as_bool(fi.get("enabled", fb.get("enabled")), DEFAULTS["prefill"]["enabled"])
    prefill["asked"] = _as_bool(fi.get("asked", fb.get("asked")), DEFAULTS["prefill"]["asked"])
    if "judge" in fi:
        j = fi.get("judge")
    else:
        j = fb.get("judge", DEFAULTS["prefill"]["judge"])
    prefill["judge"] = j if (isinstance(j, str) and j) else None
    out["prefill"] = prefill

    # ghostJudges (map id de juge LIBRE → bool) -----------------------------
    ghost = {}
    src_ghost = base.get("ghostJudges") if isinstance(base.get("ghostJudges"), dict) else {}
    for k, v in src_ghost.items():
        if isinstance(v, bool):
            ghost[str(k)] = v
    inc_ghost = inc.get("ghostJudges") if isinstance(inc.get("ghostJudges"), dict) else {}
    for k, v in inc_ghost.items():
        if isinstance(v, bool):
            ghost[str(k)] = v
    out["ghostJudges"] = ghost

    return out

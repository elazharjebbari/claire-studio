"""Config de campagne de résolution — lecture tolérante + traduction vers le moteur.

La config vit dans `Project.settings['resolution']` (preset « confiance annotateurs » par
défaut). Le Studio d'édition + la validation serveur arrivent en V7 ; ici on LIT seulement,
tolérant aux clés snake/camel, et on traduit vers la config attendue par
`claire.projects.gold_scoring.score_sentence`.
"""

from __future__ import annotations

from claire.projects.gold_scoring import LLM_ROLES, default_config


def _get(d: dict, *keys, default=None):
    """Premier des `keys` présent dans `d` (tolérance snake/camel)."""
    if not isinstance(d, dict):
        return default
    for k in keys:
        if k in d:
            return d[k]
    return default


def resolution_settings(project) -> dict:
    """Le bloc `resolution` brut des settings du projet (jamais None)."""
    settings_blob = getattr(project, "settings", None)
    if isinstance(settings_blob, dict):
        res = settings_blob.get("resolution")
        if isinstance(res, dict):
            return res
    return {}


def build_engine_config(project) -> dict:
    """Traduit la config de campagne en config pour `score_sentence` (pur)."""
    cfg = default_config()
    res = resolution_settings(project)

    llm = _get(res, "llm", default={}) or {}
    role = _get(llm, "role") or _get(res, "llm_role", "llmRole")
    if role in LLM_ROLES:
        cfg["llm_role"] = role
    weight = _get(llm, "weight") or _get(res, "llm_weight", "llmWeight")
    if weight is not None:
        try:
            cfg["llm_weight"] = float(weight)
        except (TypeError, ValueError):
            pass

    per_annotator = _get(res, "annotator_weights", "annotatorWeights", "per_annotator", default={})
    if isinstance(per_annotator, dict):
        cfg["per_annotator"] = {str(k): float(v) for k, v in per_annotator.items()}
    per_llm = _get(llm, "per_judge", "perJudge") or _get(res, "per_llm", default={})
    if isinstance(per_llm, dict):
        # Forme {judge: {weight}} ou {judge: weight}.
        out = {}
        for k, v in per_llm.items():
            w = v.get("weight") if isinstance(v, dict) else v
            if w is not None:
                try:
                    out[str(k)] = float(w)
                except (TypeError, ValueError):
                    pass
        cfg["per_llm"] = out

    sec_min = _get(res, "secondary_min_annotators", "secondaryMinAnnotators")
    if sec_min is not None:
        try:
            cfg["secondary_min_annotators"] = int(sec_min)
        except (TypeError, ValueError):
            pass

    return cfg


def annotation_statuses(project) -> set:
    """Statuts d'annotation pris en compte comme « experts » (gold-grade)."""
    res = resolution_settings(project)
    raw = _get(res, "statuses", default=None)
    if isinstance(raw, (list, tuple)) and raw:
        return set(raw)
    return {"submitted", "in_review", "approved"}

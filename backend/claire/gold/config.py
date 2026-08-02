"""Config de campagne de résolution — lecture tolérante + traduction vers le moteur.

La config vit dans `Project.settings['resolution']` (preset « confiance annotateurs » par
défaut). Le Studio d'édition + la validation serveur arrivent en V7 ; ici on LIT seulement,
tolérant aux clés snake/camel, et on traduit vers la config attendue par
`claire.projects.gold_scoring.score_sentence`.
"""

from __future__ import annotations

import copy

from claire.imports.models import Judge
from claire.projects.gold_scoring import default_config

# Les LLM ne sont qu'une RÉFÉRENCE (jamais un votant) ; ces rôles restent stockables
# dans la config par compat mais n'ont AUCUN effet sur le moteur.
LLM_ROLES = ("ignore", "tiebreak", "signal", "full")
LEVELS = {"C1", "C2", "C3", "C4", "C5"}
SECONDARY_POLICIES = {"optional", "required", "advisory"}
ANNOTATION_STATUSES = {"submitted", "in_review", "approved", "draft"}
# DÉRIVÉ de la source unique `Judge` : ajouter un juge ne demande aucune retouche ici.
KNOWN_JUDGES = set(Judge.values)

# Preset par défaut « CONFIANCE AUX ANNOTATEURS » (cf. presets.yaml). Stocké en snake_case
# dans Project.settings['resolution'] ; le wire est camelisé par le renderer/parser DRF.
DEFAULT_RESOLUTION_CONFIG: dict = {
    "v": 1,
    "llm": {"role": "tiebreak", "weight": 0.5, "per_judge": {}},
    "annotator_weights": {},  # username -> poids
    "signal_bonus": 0.2,
    "auto_resolve": {
        "absolute_agreement": True,  # accord strict des annotateurs → 1 clic
        "majority": True,            # majorité d'annotateurs ≥ 2/3 → auto
        "low_risk_levels": ["C1", "C2"],
        "manual_levels": ["C3", "C4", "C5"],
    },
    "arbiters": [],  # usernames AUTORISÉS à arbitrer (vide = politique par défaut)
    "auto_share": True,
    "secondary_policy": "advisory",
    "statuses": ["submitted", "in_review", "approved"],
}


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
    """Traduit la config de campagne en config pour `score_sentence` (ANNOTATEURS seuls).

    Les LLM ne sont PAS parties au conflit : la config ne porte que des paramètres
    annotateurs (poids par annotateur, seuil de secondaires)."""
    cfg = default_config()
    res = resolution_settings(project)

    per_annotator = _get(res, "annotator_weights", "annotatorWeights", "per_annotator", default={})
    if isinstance(per_annotator, dict):
        out = {}
        for k, v in per_annotator.items():
            try:
                out[str(k)] = float(v)
            except (TypeError, ValueError):
                pass
        cfg["per_annotator"] = out

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


def secondary_policy(project) -> str:
    """Politique des secondaires : 'required' = promus d'office dans le gold auto-résolu ;
    'advisory'/'optional' = proposés (affichés) mais jamais auto-promus (l'arbitre choisit)."""
    res = resolution_settings(project)
    sp = _get(res, "secondary_policy", "secondaryPolicy", default="advisory")
    return sp if sp in SECONDARY_POLICIES else "advisory"


def auto_resolve_flags(project) -> dict:
    """Drapeaux d'auto-résolution effectifs (accord strict 1-clic, majorité ≥ 2/3)."""
    res = resolution_settings(project)
    ar = _get(res, "auto_resolve", "autoResolve", default={}) or {}
    return {
        "absolute_agreement": bool(_get(ar, "absolute_agreement", "absoluteAgreement", default=True)),
        "majority": bool(_get(ar, "majority", default=True)),
    }


def config_arbiters(project) -> set:
    """Usernames explicitement autorisés à arbitrer (vide = politique par défaut)."""
    res = resolution_settings(project)
    raw = _get(res, "arbiters", default=[])
    return {str(u) for u in raw} if isinstance(raw, (list, tuple)) else set()


# ── Studio de config (V7) : lecture complète, validation, sauvegarde tracée ──
def _member_usernames(project) -> set:
    return set(
        project.memberships.select_related("user").values_list("user__username", flat=True)
    )


def resolution_config_full(project) -> dict:
    """Config complète (défauts fusionnés avec le stocké) pour le studio — section par section."""
    stored = resolution_settings(project)
    cfg = copy.deepcopy(DEFAULT_RESOLUTION_CONFIG)
    if not isinstance(stored, dict):
        return cfg
    cfg["llm"] = {**cfg["llm"], **(stored.get("llm") if isinstance(stored.get("llm"), dict) else {})}
    cfg["auto_resolve"] = {
        **cfg["auto_resolve"],
        **(stored.get("auto_resolve") if isinstance(stored.get("auto_resolve"), dict) else {}),
    }
    for key in ("annotator_weights", "signal_bonus", "arbiters", "auto_share", "secondary_policy", "statuses"):
        if key in stored:
            cfg[key] = stored[key]
    if "config_changes" in stored:
        cfg["config_changes"] = stored["config_changes"]
    return cfg


def _clamp(x, lo, hi, default):
    try:
        return max(lo, min(hi, float(x)))
    except (TypeError, ValueError):
        return default


def validate_resolution_config(raw: dict, project) -> dict:
    """Valide + normalise la config reçue (post parser snake_case). Lève ValueError (→400)."""
    if not isinstance(raw, dict):
        raise ValueError("config invalide.")
    # Base = config EXISTANTE (défauts fusionnés) → un PATCH partiel ne réinitialise rien.
    cfg = resolution_config_full(project)
    cfg.pop("config_changes", None)
    members = _member_usernames(project)

    llm = raw.get("llm") if isinstance(raw.get("llm"), dict) else {}
    role = llm.get("role")
    if role is not None:
        if role not in LLM_ROLES:
            raise ValueError(f"rôle LLM inconnu : {role!r}")
        cfg["llm"]["role"] = role
    if "weight" in llm:
        cfg["llm"]["weight"] = _clamp(llm["weight"], 0.0, 2.0, 0.5)
    per_judge = llm.get("per_judge")
    if isinstance(per_judge, dict):
        # Ne garder que les juges connus (clés inconnues = bruit / clé camélisée par le parser).
        cfg["llm"]["per_judge"] = {
            str(k): _clamp(v, 0.0, 2.0, 1.0) for k, v in per_judge.items() if str(k) in KNOWN_JUDGES
        }

    aw = raw.get("annotator_weights")
    if isinstance(aw, dict):
        # Clés = usernames de MEMBRES uniquement (évite la pollution + corruption parser).
        cfg["annotator_weights"] = {
            str(k): _clamp(v, 0.0, 5.0, 1.0) for k, v in aw.items() if str(k) in members
        }

    if "signal_bonus" in raw:
        cfg["signal_bonus"] = _clamp(raw["signal_bonus"], 0.0, 1.0, 0.2)

    ar = raw.get("auto_resolve") if isinstance(raw.get("auto_resolve"), dict) else {}
    if "absolute_agreement" in ar:
        cfg["auto_resolve"]["absolute_agreement"] = bool(ar["absolute_agreement"])
    if "majority" in ar:
        cfg["auto_resolve"]["majority"] = bool(ar["majority"])
    for key in ("low_risk_levels", "manual_levels"):
        if key in ar:
            vals = ar[key] if isinstance(ar[key], (list, tuple)) else []
            bad = [v for v in vals if v not in LEVELS]
            if bad:
                raise ValueError(f"niveau de triage inconnu : {bad!r}")
            cfg["auto_resolve"][key] = list(vals)

    if "auto_share" in raw:
        cfg["auto_share"] = bool(raw["auto_share"])

    sp = raw.get("secondary_policy")
    if sp is not None:
        if sp not in SECONDARY_POLICIES:
            raise ValueError(f"politique de secondaires inconnue : {sp!r}")
        cfg["secondary_policy"] = sp

    st = raw.get("statuses")
    if isinstance(st, (list, tuple)):
        bad = [s for s in st if s not in ANNOTATION_STATUSES]
        if bad:
            raise ValueError(f"statut d'annotation inconnu : {bad!r}")
        if st:
            cfg["statuses"] = list(st)

    # Arbitres : doivent être des MEMBRES du projet (l'autocomplétion ne propose qu'eux).
    arbiters = raw.get("arbiters")
    if isinstance(arbiters, (list, tuple)):
        cleaned = []
        seen = set()
        for u in arbiters:
            u = str(u)
            if u in seen:
                continue
            if u not in members:
                raise ValueError(f"« {u} » n'est pas membre du projet.")
            seen.add(u)
            cleaned.append(u)
        cfg["arbiters"] = cleaned

    return cfg


def save_resolution_config(project, cfg: dict, actor=None) -> dict:
    """Persiste la config dans Project.settings['resolution'] + trace le changement."""
    from django.utils import timezone

    settings_blob = project.settings if isinstance(project.settings, dict) else {}
    previous = settings_blob.get("resolution") if isinstance(settings_blob.get("resolution"), dict) else {}
    changes = previous.get("config_changes") if isinstance(previous.get("config_changes"), list) else []
    changes = (changes + [{"at": timezone.now().isoformat(), "by": getattr(actor, "username", None)}])[-20:]
    stored = dict(cfg)
    stored["config_changes"] = changes
    settings_blob["resolution"] = stored
    project.settings = settings_blob
    project.save(update_fields=["settings", "updated_at"])
    return stored

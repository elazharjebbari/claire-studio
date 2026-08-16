"""Presets d'expérience — chargés depuis `docs/pactiva-lab/specs/pipeline-presets.yaml`.

Le fichier encode le protocole en deux étages du plan scientifique (§5 de
`01_PLAN_SCIENTIFIQUE.md`) : cribler avec ce qui est rapide, confirmer avec ce qui est
lourd. Il vivait jusqu'ici comme pure documentation — jamais lu par le code. Ce module ne
fait qu'un chargement en lecture seule ; **aucune logique métier** (la validation reste
dans `contracts.validate_config`, appelée sur la config finale une fois le dataset choisi).

Absence du fichier ⇒ liste vide + avertissement journalisé, jamais une 500 : un preset
manquant est une fonctionnalité indisponible, pas une panne.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path

import yaml
from django.conf import settings

logger = logging.getLogger("claire.lab")


def presets_file() -> Path:
    configured = getattr(settings, "LAB_PRESETS_FILE", None)
    if configured:
        return Path(configured)
    return (
        Path(settings.BASE_DIR).parent
        / "docs" / "pactiva-lab" / "specs" / "pipeline-presets.yaml"
    )


@lru_cache(maxsize=1)
def _load_cached(path: str) -> dict:
    try:
        raw = Path(path).read_text(encoding="utf-8")
    except OSError:
        logger.warning("lab_presets_file_missing path=%s", path)
        return {"presets": [], "recommended_order": []}
    data = yaml.safe_load(raw) or {}
    return {
        "presets": data.get("presets") or [],
        "recommended_order": data.get("recommended_order") or [],
        # Registre ordonné des blocs thématiques du lanceur (05_BLOCS_ET_PROGRAMMES.md).
        "themes": data.get("themes") or [],
    }


def load_presets() -> dict:
    """Renvoie `{"presets": [...], "recommendedOrder": [...]}` (via la camélisation HTTP).

    Mis en cache par chemin de fichier : le fichier ne change qu'au déploiement, et le
    relire à chaque requête `GET /lab/presets` serait un aller-disque pour rien.
    """
    return _load_cached(str(presets_file()))

"""Programmes d'expériences — chargés depuis `specs/experiment-programs.yaml`.

Même philosophie que `presets.py` : chargement en lecture seule, aucune logique
métier, absence du fichier ⇒ liste vide journalisée (fonctionnalité indisponible,
pas une panne). L'avancement des programmes n'est JAMAIS stocké : il est dérivé des
runs réels par la vue (`views.experiment_programs`) — une table de programmes aurait
créé une seconde source de vérité à synchroniser avec les runs, exactement le genre
de mensonge silencieux que ce produit combat partout
(décision : docs/pactiva-lab/05_BLOCS_ET_PROGRAMMES.md §2).
"""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path

import yaml
from django.conf import settings

logger = logging.getLogger("claire.lab")


def programs_file() -> Path:
    configured = getattr(settings, "LAB_PROGRAMS_FILE", None)
    if configured:
        return Path(configured)
    return (
        Path(settings.BASE_DIR).parent
        / "docs" / "pactiva-lab" / "specs" / "experiment-programs.yaml"
    )


@lru_cache(maxsize=1)
def _load_cached(path: str) -> dict:
    try:
        raw = Path(path).read_text(encoding="utf-8")
    except OSError:
        logger.warning("lab_programs_file_missing path=%s", path)
        return {"programs": []}
    data = yaml.safe_load(raw) or {}
    return {"programs": data.get("programs") or []}


def load_programs() -> dict:
    """Renvoie `{"programs": [...]}` (camélisé par le middleware HTTP)."""
    return _load_cached(str(programs_file()))

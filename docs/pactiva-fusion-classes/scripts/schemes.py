"""Schémas de fusion candidats — DÉSORMAIS DÉRIVÉS DE LA SOURCE UNIQUE.

Ce module ne déclare plus les mappings : il les lit dans la spécification versionnée
`frontend/src/lib/taxonomy/taxonomies.json`, lue à l'identique par le Lab (Python) et par
l'interface (TypeScript). Les dicts qui vivaient ici en dur étaient une COPIE destinée à
diverger ; l'API publique (`SCHEMES`, `remap`, `remap_set`) est conservée telle quelle pour
que les scripts d'aperçu du dossier continuent de fonctionner sans modification.

Justification des regroupements : fascicule 02 du dossier de fusion, et le champ
`rationale` de chaque catégorie dans la spécification.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "research"))

from pactiva_lab.taxonomy import (  # noqa: E402
    canonical_id,
    project_theme,
    project_theme_set,
    projection,
    taxonomy_ids,
)

# Même forme qu'avant (source → cible, l'identité étant l'absence de clé), mais DÉRIVÉE :
# une évolution de la spécification se propage ici sans retouche.
SCHEMES = {
    "T20-statuquo": {},
    "T14-fiabilite": {k: v for k, v in projection("T14").items() if k != v},
    "T11-fonctionnel-strate": {k: v for k, v in projection("T11").items() if k != v},
    "T10-fonctionnel": {k: v for k, v in projection("T10").items() if k != v},
}

# Correspondance nom historique → identifiant de la spécification.
SCHEME_IDS = {
    "T20-statuquo": "T20",
    "T14-fiabilite": "T14",
    "T11-fonctionnel-strate": "T11",
    "T10-fonctionnel": "T10",
}


def remap(theme: str, mapping: dict) -> str:
    return mapping.get(theme, theme)


def remap_set(s, mapping: dict) -> frozenset:
    return frozenset(mapping.get(t, t) for t in s)


__all__ = [
    "SCHEMES", "SCHEME_IDS", "remap", "remap_set",
    "canonical_id", "project_theme", "project_theme_set", "taxonomy_ids",
]

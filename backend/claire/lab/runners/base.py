"""Interface d'exécution — quatre opérations, deux implémentations.

Ajouter une cible de calcul (SLURM, cloud, autre grille) ne doit toucher que ce dossier :
c'est le point d'évolutivité principal de l'architecture. Le reste du Lab ne connaît que
cette interface.
"""

from __future__ import annotations

import json
from pathlib import Path


class ExecutionBackend:
    kind = "abstract"

    def submit(self, run, dataset_dir: Path, out_dir: Path) -> str:
        """Lance le calcul. Renvoie un identifiant externe (vide en local)."""
        raise NotImplementedError

    def poll(self, run) -> str:
        """État courant : `waiting` | `running` | `stopped`."""
        raise NotImplementedError

    def fetch(self, run, out_dir: Path) -> bool:
        """Rapatrie les résultats. Renvoie True si le run s'est terminé normalement
        (présence du fichier `_SENTINEL`), False si les résultats sont partiels."""
        raise NotImplementedError

    def cancel(self, run) -> None:
        raise NotImplementedError


def write_config(out_dir: Path, config: dict) -> Path:
    """Écrit la configuration à côté des résultats.

    Un run publié doit porter sa configuration exacte : sans elle, le chiffre du tableau
    n'est pas reproductible, et c'est la première chose qu'un relecteur demande.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "config.json"
    path.write_text(json.dumps(config, indent=2, ensure_ascii=False), encoding="utf-8")
    return path


def sentinel_present(out_dir: Path) -> bool:
    """Distingue « terminé normalement » de « tué par le walltime ».

    Sans ce marqueur, un rapatriement de résultats partiels serait pris pour un succès —
    et un tableau de l'article citerait un score calculé sur trois plis au lieu de cinq.
    """
    return (Path(out_dir) / "_SENTINEL").exists()

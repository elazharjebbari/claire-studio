"""Pont vers les fonctions statistiques PURES du package de recherche.

`pactiva_lab` n'est pas installé dans le venv Django (dépendances ML lourdes tenues à
l'écart par construction) — mais son socle (`evaluation/`) est garanti sans dépendance
hors bibliothèque standard (testé par `test_le_socle_ne_depend_pas_de_sklearn_ni_de_torch`
côté recherche). On l'importe donc par chemin, via la même racine que le runner local
(`LAB_RESEARCH_DIR`), plutôt que de dupliquer les formules ici : une implémentation
miroir divergerait tôt ou tard des chiffres publiés par le runner.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

from .models import ArtifactKind, ExperimentRun, RunArtifact
from .runners.local import research_root


class PredictionsUnavailable(RuntimeError):
    """Les prédictions par phrase d'un run ne sont pas exploitables.

    Cas réels : run antérieur au catalogage des artefacts, run partiel coupé avant
    l'écriture, fichier altéré (checksum). Le code est stable pour que l'UI affiche le
    repli descriptif plutôt qu'un test silencieusement absent."""

    def __init__(self, code: str, detail: str):
        self.code = code
        super().__init__(detail)


def load_stats():
    """Charge `pactiva_lab.evaluation.stats` depuis la racine recherche configurée."""
    root = str(research_root())
    if root not in sys.path:
        sys.path.insert(0, root)
    from pactiva_lab.evaluation import stats  # import différé : chemin requis d'abord

    return stats


def read_predictions(run: ExperimentRun) -> list[dict]:
    """Lit `predictions.jsonl` d'un run, checksum vérifié contre le catalogue.

    Le checksum n'est pas un luxe : le fichier vit sur le disque partagé, hors base —
    un résultat statistique calculé sur un fichier altéré serait pire qu'une erreur.
    """
    artifact = (
        RunArtifact.objects.filter(run=run, kind=ArtifactKind.PREDICTIONS)
        .order_by("-created_at")
        .first()
    )
    if artifact is None:
        raise PredictionsUnavailable(
            "predictions_missing",
            f"aucune prédiction par phrase cataloguée pour le run {run.id} "
            "(run antérieur, partiel, ou purgé)",
        )
    path = Path(artifact.path)
    if not path.exists():
        raise PredictionsUnavailable(
            "predictions_missing", f"fichier absent du disque : {path.name}"
        )
    payload = path.read_bytes()
    if hashlib.sha256(payload).hexdigest() != artifact.checksum:
        raise PredictionsUnavailable(
            "predictions_checksum_mismatch",
            f"empreinte du fichier {path.name} différente du catalogue — fichier altéré",
        )
    rows = []
    for line in payload.decode("utf-8").splitlines():
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    if not rows:
        raise PredictionsUnavailable("predictions_missing", "fichier de prédictions vide")
    return rows

"""Exécution locale — sous-processus `python -m pactiva_lab run`.

Le package ML est invoqué en SOUS-PROCESSUS et non importé : c'est ce qui garantit que
Django ne charge jamais torch ni scikit-learn, et que le chemin d'exécution local est
rigoureusement le même que sur Grid'5000 (même commande, mêmes fichiers, mêmes sorties).
Un bug qui n'apparaîtrait que sur la grille serait très coûteux à diagnostiquer.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

from django.conf import settings

from ..services import heartbeat
from .base import ExecutionBackend, sentinel_present, write_config

# Intervalle de sonde du fichier `progress.json` pendant un run local. Un compromis : assez
# court pour qu'une barre de progression paraisse vivante, assez long pour ne pas multiplier
# les écritures en base sur un run qui dure des heures.
LOCAL_POLL_INTERVAL_SECONDS = 2.0


def research_root() -> Path:
    """Racine du package `pactiva_lab`."""
    configured = getattr(settings, "LAB_RESEARCH_DIR", None)
    if configured:
        return Path(configured)
    return Path(settings.BASE_DIR).parent / "research"


def research_python() -> str:
    """Interpréteur utilisé pour exécuter `pactiva_lab`.

    Replié par défaut sur `sys.executable` (celui de Django) pour ne rien casser en
    l'absence de réglage. Mais les deux packages ont des dépendances disjointes par
    construction (`claire/` ne doit jamais voir torch/sklearn) : sur une machine où
    l'environnement Django ne peut pas installer les paquets ML lourds — wheel PyPI
    absent pour sa version de Python/plateforme, par exemple — `LAB_RESEARCH_PYTHON`
    pointe vers un venv dédié au package `research/`, sans toucher `backend/.venv`.
    """
    configured = getattr(settings, "LAB_RESEARCH_PYTHON", None)
    return str(configured) if configured else sys.executable


class LocalBackend(ExecutionBackend):
    kind = "local"

    def __init__(self):
        self.last_returncode = None

    def submit(self, run, dataset_dir: Path, out_dir: Path) -> str:
        out_dir = Path(out_dir)
        config_path = write_config(out_dir, run.config)
        cancel_file = out_dir / "CANCEL"
        progress_path = out_dir / "progress.json"

        env = os.environ.copy()
        root = research_root()
        env["PYTHONPATH"] = os.pathsep.join(
            [p for p in (str(root), env.get("PYTHONPATH", "")) if p]
        )
        # Isolé par run, dans `out_dir` (déjà garanti inscriptible par l'appelant) plutôt
        # que le repli par défaut `~/.cache/huggingface` : sous systemd, `HOME` pointe vers
        # un répertoire hors du contrôle de ce package et pas forcément inscriptible par
        # l'utilisateur qui exécute le worker. Même convention que le script Grid'5000.
        env.setdefault("HF_HOME", str(out_dir / ".hf"))

        cmd = [
            research_python(), "-m", "pactiva_lab", "run",
            "--config", str(config_path),
            "--data", str(dataset_dir),
            "--out", str(out_dir),
            "--progress", str(progress_path),
            "--cancel-file", str(cancel_file),
        ]
        timeout = getattr(settings, "LAB_LOCAL_TIMEOUT", 3600)
        deadline = time.monotonic() + timeout

        with (out_dir / "run.log").open("w", encoding="utf-8") as log:
            # `Popen` non bloquant plutôt que `subprocess.run` : sonder `progress.json`
            # PENDANT l'exécution est ce qui alimente une barre de progression réelle
            # (pli en cours) au lieu d'un saut brutal de 0 à 100 % — le fichier était déjà
            # écrit par le runner à chaque pli, simplement jamais lu tant que le processus
            # n'était pas terminé.
            process = subprocess.Popen(
                cmd, cwd=str(root), env=env, stdout=log, stderr=subprocess.STDOUT,
            )
            last_reported: int | None = None
            while True:
                returncode = process.poll()
                if returncode is not None:
                    break
                if time.monotonic() > deadline:
                    process.kill()
                    process.wait()
                    raise subprocess.TimeoutExpired(cmd, timeout)
                last_reported = self._report_progress(run, progress_path, last_reported)
                time.sleep(LOCAL_POLL_INTERVAL_SECONDS)
            self._report_progress(run, progress_path, last_reported)

        # Conservé pour distinguer une annulation (130) d'un échec (1).
        self.last_returncode = process.returncode
        return ""

    @staticmethod
    def _report_progress(run, progress_path: Path, last_reported: int | None) -> int | None:
        """Relit `progress.json` et met à jour le run SI le pourcentage a changé.

        Le garde `!=` évite d'écrire en base à chaque sonde de 2 s pour rien — seul un
        changement réel (un nouveau pli terminé) justifie une écriture.
        """
        try:
            data = json.loads(progress_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return last_reported
        percent = data.get("percent")
        if not isinstance(percent, (int, float)) or percent == last_reported:
            return last_reported
        fold, folds = data.get("fold"), data.get("folds")
        phase = f"pli {fold}/{folds}" if fold is not None and folds is not None else ""
        heartbeat(run, progress=int(percent), phase=phase)
        return percent

    def poll(self, run) -> str:
        # Le sous-processus est synchrone : au retour de `submit`, il est terminé.
        return "stopped"

    def fetch(self, run, out_dir: Path) -> bool:
        return sentinel_present(out_dir)

    def cancel(self, run) -> None:
        """Annulation coopérative : on dépose le fichier que le runner surveille.

        Coopérative plutôt que par signal, pour que le run puisse écrire son résultat
        partiel avant de s'arrêter — un pli calculé ne doit jamais être perdu.
        """
        if run.storage_path:
            path = Path(run.storage_path)
            path.mkdir(parents=True, exist_ok=True)
            (path / "CANCEL").write_text("1", encoding="utf-8")

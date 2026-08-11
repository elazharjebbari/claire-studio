"""Exécution locale — sous-processus `python -m pactiva_lab run`.

Le package ML est invoqué en SOUS-PROCESSUS et non importé : c'est ce qui garantit que
Django ne charge jamais torch ni scikit-learn, et que le chemin d'exécution local est
rigoureusement le même que sur Grid'5000 (même commande, mêmes fichiers, mêmes sorties).
Un bug qui n'apparaîtrait que sur la grille serait très coûteux à diagnostiquer.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from django.conf import settings

from .base import ExecutionBackend, sentinel_present, write_config


def research_root() -> Path:
    """Racine du package `pactiva_lab`."""
    configured = getattr(settings, "LAB_RESEARCH_DIR", None)
    if configured:
        return Path(configured)
    return Path(settings.BASE_DIR).parent / "research"


class LocalBackend(ExecutionBackend):
    kind = "local"

    def __init__(self):
        self.last_returncode = None

    def submit(self, run, dataset_dir: Path, out_dir: Path) -> str:
        out_dir = Path(out_dir)
        config_path = write_config(out_dir, run.config)
        cancel_file = out_dir / "CANCEL"

        env = os.environ.copy()
        root = research_root()
        env["PYTHONPATH"] = os.pathsep.join(
            [p for p in (str(root), env.get("PYTHONPATH", "")) if p]
        )

        with (out_dir / "run.log").open("w", encoding="utf-8") as log:
            completed = subprocess.run(
                [
                    sys.executable, "-m", "pactiva_lab", "run",
                    "--config", str(config_path),
                    "--data", str(dataset_dir),
                    "--out", str(out_dir),
                    "--progress", str(out_dir / "progress.json"),
                    "--cancel-file", str(cancel_file),
                ],
                cwd=str(root), env=env, stdout=log, stderr=subprocess.STDOUT,
                timeout=getattr(settings, "LAB_LOCAL_TIMEOUT", 3600),
                check=False,
            )
        # Conservé pour distinguer une annulation (130) d'un échec (1).
        self.last_returncode = completed.returncode
        return ""

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

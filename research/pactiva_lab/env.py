"""Capture de l'environnement d'exécution — reproductibilité.

Un résultat d'article doit pouvoir être rejoué. On enregistre donc, avec chaque run : les
versions des bibliothèques effectivement chargées, le matériel, et la durée. Le tout est
recopié dans `results.json` et affiché dans l'UI.
"""

from __future__ import annotations

import platform
import sys
import time


def _version(module: str) -> str | None:
    try:
        import importlib.metadata as metadata

        return metadata.version(module)
    except Exception:
        return None


def capture_environment(started: float | None = None) -> dict:
    gpu = None
    try:  # torch est optionnel : son absence n'est pas une erreur
        import torch

        gpu = {
            "available": torch.cuda.is_available(),
            "device": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
        }
    except Exception:
        gpu = {"available": False, "device": None}

    return {
        "python": sys.version.split()[0],
        "platform": platform.platform(),
        "processor": platform.processor(),
        "packages": {
            name: _version(name)
            for name in ("scikit-learn", "numpy", "torch", "transformers",
                         "sentence-transformers")
            if _version(name)
        },
        "gpu": gpu,
        "elapsedSeconds": round(time.time() - started, 3) if started else None,
    }

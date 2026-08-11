"""Backends d'exécution : local et Grid'5000.

Ajouter une cible (SLURM, cloud) ne touche que ce dossier — c'est le point
d'évolutivité principal de l'architecture.
"""

from .base import ExecutionBackend  # noqa: F401


def get_backend(kind: str) -> ExecutionBackend:
    """Fabrique le backend demandé. Import paresseux : le backend Grid'5000 ne doit pas
    être chargé (ni ses dépendances réseau) quand on travaille en local."""
    if kind == "g5k":
        from .g5k import Grid5000Backend

        return Grid5000Backend()
    from .local import LocalBackend

    return LocalBackend()

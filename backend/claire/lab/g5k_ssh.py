"""Gestion de la clé SSH Grid'5000 — fichier temporaire, jamais persisté durablement.

Découverte de la recherche documentaire (`docs/pactiva-g5k/research/01_VUE_ENSEMBLE_SITES_ACCES.md`
§3.1) : Grid'5000 **désactive l'authentification par mot de passe en SSH** — seule une
clé publique déposée sur le compte fonctionne. Le mot de passe stocké dans
`ComputeCredential.secret_encrypted` authentifie l'API REST (HTTP Basic), pas SSH/rsync :
il faut un second secret, la clé privée correspondante.

Cette clé est déchiffrée en mémoire, écrite dans un fichier temporaire à permissions
`0600` le temps strict d'un transfert, puis supprimée — jamais laissée sur disque au-delà
de cette fenêtre, y compris si le transfert échoue.
"""

from __future__ import annotations

import os
import stat
import tempfile
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator


@contextmanager
def temporary_ssh_key(raw_key: str) -> Iterator[Path]:
    """Écrit `raw_key` dans un fichier temporaire 0600, le supprime à la sortie.

    La suppression est garantie même si le bloc `with` lève une exception — le
    fichier ne doit jamais survivre à un rsync qui plante.
    """
    if not raw_key:
        raise ValueError("clé SSH vide")
    fd, path_str = tempfile.mkstemp(prefix="pactiva-g5k-", suffix=".key")
    path = Path(path_str)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(raw_key)
            if not raw_key.endswith("\n"):
                handle.write("\n")
        path.chmod(stat.S_IRUSR | stat.S_IWUSR)  # 0600 : lecture/écriture propriétaire seul
        yield path
    finally:
        path.unlink(missing_ok=True)


def ssh_command(key_path: Path) -> str:
    """Chaîne à passer à `rsync -e` / `ssh` pour utiliser cette clé sans invite de
    passphrase ni interaction (le transfert tourne dans un worker sans terminal)."""
    return f"ssh -i {key_path} -o BatchMode=yes -o StrictHostKeyChecking=accept-new"

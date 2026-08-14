"""Exécution sur Grid'5000 — API REST (via `python-grid5000`) + transfert SSH/rsync.

Deux secrets DISTINCTS (voir `docs/pactiva-g5k/07_ARCHITECTURE.md` §1) :
* le **mot de passe** authentifie l'API REST (HTTP Basic) — via `g5k_client.py` ;
* la **clé SSH** authentifie `rsync`/`ssh` — Grid'5000 désactive l'authentification par
  mot de passe en SSH (`docs/pactiva-g5k/research/01_VUE_ENSEMBLE_SITES_ACCES.md` §3.1).
  Un run qui nécessite un transfert sans clé SSH configurée échoue explicitement
  (`g5k_ssh_key_missing`) avant toute tentative, plutôt qu'avec un message SSH cryptique.

Deux contraintes structurent le code (inchangées depuis la conception initiale) :

* **un job peut attendre longtemps en file** → l'état `waiting` est distinct de
  `running`, et le sondage est adaptatif ;
* **le *walltime* est un couperet** → on rapatrie même sans `_SENTINEL`, et on ingère en
  `partial` plutôt que de jeter le travail accompli.

Grid'5000 n'est jamais sur le chemin critique : en cas d'indisponibilité, le run échoue
avec un code explicite et reste rejouable en local.
"""

from __future__ import annotations

import logging
import shlex
import subprocess
from pathlib import Path

from .base import ExecutionBackend, sentinel_present, write_config
from ..g5k_client import G5KError, build_client
from ..g5k_client import cancel as g5k_cancel
from ..g5k_client import poll as g5k_poll
from ..g5k_client import submit as g5k_submit
from ..g5k_client import test_connection as g5k_test_connection
from ..g5k_ssh import ssh_command, temporary_ssh_key

logger = logging.getLogger("claire.lab.g5k")

GATEWAY = "access.grid5000.fr"

# Sondage adaptatif : dense au début (le job peut démarrer tout de suite), puis espacé.
# ⚠️ Chaque sonde coûte désormais DEUX requêtes HTTP côté client officiel
# (`client.sites[site]` résout le site avant `jobs.get()` — vérifié par les tests de
# g5k_client.py, pas documenté par le wiki) : l'intervalle reste pertinent, mais deux
# fois plus de charge par sonde qu'avec l'ancien client maison à un seul appel.
POLL_SCHEDULE = ((60, 5), (600, 15), (None, 60))


def poll_interval(elapsed_seconds: float) -> int:
    """Intervalle de sondage selon le temps déjà écoulé."""
    for threshold, interval in POLL_SCHEDULE:
        if threshold is None or elapsed_seconds < threshold:
            return interval
    return 60


def build_run_script(*, run_id: str, require_gpu: bool, env_name: str, workdir: str) -> str:
    """Script exécuté sur le nœud.

    Le garde-fou GPU est le point important : sur Grid'5000, un désaccord entre la
    version de `pytorch-cuda` et le CUDA du nœud rend le GPU invisible, et
    l'entraînement se poursuit **six heures sur CPU** sans rien signaler. Mieux vaut
    échouer en trois secondes avec un code distinct (64/65) — comportement confirmé
    exactement conforme à la doc officielle (`docs/pactiva-g5k/research/05_MONITORING_ML_GPU.md`
    §4.3-4.4) : aucun mécanisme fiable de vérification pré-réservation n'existe côté
    Grid'5000, la vérification post-connexion reste la bonne pratique.
    """
    gpu_guard = ""
    if require_gpu:
        gpu_guard = """
nvidia-smi || { echo "FATAL: aucun GPU visible sur ce noeud"; exit 64; }
python - <<'PYCHECK' || { echo "FATAL: torch ne voit pas le GPU (CUDA/pytorch-cuda desaccordes)"; exit 65; }
import sys, torch
sys.exit(0 if torch.cuda.is_available() else 1)
PYCHECK
"""
    # `~` ne s'étend JAMAIS entre guillemets doubles en bash — `RUN_DIR="~/pactiva/..."`
    # laisserait un tilde LITTÉRAL dans la valeur, et `cd "$RUN_DIR"` échouerait sur un
    # répertoire qui n'existe pas. Bug réel trouvé le 14 août 2026 (job Grid'5000 réel,
    # site Rennes, `cd: ~/pactiva/runs/<id>: No such file or directory` dans le stderr
    # OAR) — `$HOME` est une variable, elle s'étend normalement entre guillemets, donc on
    # substitue le tilde EN PYTHON avant d'écrire le script plutôt qu'en bash.
    node_workdir = f"$HOME{workdir[1:]}" if workdir.startswith("~") else workdir
    return f"""#!/usr/bin/env bash
set -euo pipefail
RUN_DIR="{node_workdir}/runs/{run_id}"
cd "$RUN_DIR"

module load conda 2>/dev/null || true
source activate {shlex.quote(env_name)} 2>/dev/null || conda activate {shlex.quote(env_name)}
export HF_HOME="${{HF_HOME:-$RUN_DIR/.hf}}"
{gpu_guard}
python -m pactiva_lab run \\
  --config config.json --data dataset --out results \\
  --progress results/progress.json --cancel-file results/CANCEL

# Marqueur de fin normale : son absence signale un job tue par le walltime.
echo "DONE" > results/_SENTINEL
"""


class Grid5000Backend(ExecutionBackend):
    kind = "g5k"

    def __init__(self, login: str | None = None, password: str | None = None,
                 ssh_key: str | None = None):
        # Les identifiants ne sont détenus qu'en mémoire, le temps de la soumission.
        self.login = login
        self.password = password
        self.ssh_key = ssh_key
        self._client = build_client(login, password) if login and password else None

    def test_connection(self) -> tuple[bool, bool | None, str]:
        """Vérifie les DEUX secrets, indépendamment — un utilisateur peut avoir l'un
        sans l'autre, jamais un seul booléen agrégé trompeur (§7 de l'architecture).

        Renvoie `(api_ok, ssh_ok, detail)`. `ssh_ok` vaut `None` si aucune clé SSH
        n'est configurée (pas testable, distinct d'un test qui aurait échoué).
        """
        api_ok, api_detail = g5k_test_connection(self._client) if self._client else (
            False, "aucun identifiant API configuré"
        )
        if not self.ssh_key:
            return api_ok, None, api_detail
        ssh_ok, ssh_detail = self._test_ssh()
        return api_ok, ssh_ok, f"{api_detail} · SSH : {ssh_detail}"

    def _test_ssh(self) -> tuple[bool, str]:
        try:
            with temporary_ssh_key(self.ssh_key) as key_path:
                completed = subprocess.run(
                    [*ssh_command(key_path).split(), f"{self.login}@{GATEWAY}", "true"],
                    capture_output=True, text=True, timeout=20, check=False,
                )
        except subprocess.TimeoutExpired:
            return False, "délai dépassé"
        if completed.returncode == 0:
            return True, "connexion SSH établie"
        return False, "clé refusée ou hôte injoignable"

    # -- Cycle de vie ------------------------------------------------------ #

    def submit(self, run, dataset_dir: Path, out_dir: Path) -> str:
        config = (run.config.get("compute") or {}).get("g5k") or {}
        site = config.get("site", "nancy")
        workdir = config.get("workdir", "~/pactiva")
        env_name = config.get("env_name", "pactiva-lab")
        resources = config.get("resources", "gpu=1,walltime=04:00")
        queue = config.get("queue", "default")
        require_gpu = bool((run.config.get("compute") or {}).get("require_gpu"))

        if not self.ssh_key:
            raise G5KError(
                "g5k_ssh_key_missing",
                "aucune clé SSH enregistrée — le transfert de fichiers est impossible "
                "(Grid'5000 désactive l'authentification par mot de passe en SSH)",
            )

        out_dir = Path(out_dir)
        write_config(out_dir, run.config)
        script = build_run_script(
            run_id=str(run.id), require_gpu=require_gpu, env_name=env_name, workdir=workdir
        )
        (out_dir / "run.sh").write_text(script, encoding="utf-8")

        # Deux chemins DISTINCTS pour le même stockage — le `home` Grid'5000 est propre à
        # chaque site (jamais partagé), voir `_access_path`. `node_remote` est évalué SUR
        # LE NŒUD (où `~` pointe directement le home du site réservé) ; `access_remote`
        # est évalué DEPUIS `access.grid5000.fr` pour le rsync (où `~` seul pointe le
        # disque local du frontal, pas un home de site — confirmé le 14 août 2026 avant
        # toute réservation : un `mkdir` bare y est refusé, permission denied).
        node_remote = f"{workdir}/runs/{run.id}"
        access_remote = f"{self._access_path(site, workdir)}/runs/{run.id}"
        self._rsync_push(dataset_dir, out_dir, access_remote)

        types = ["besteffort"] if queue == "besteffort" else []
        job_id = g5k_submit(
            self._client, site,
            resources=resources, command=f"bash {node_remote}/run.sh",
            types=types, name=f"pactiva-{run.id}",
        )
        logger.info("g5k_submitted run=%s job=%s site=%s", run.id, job_id, site)
        return job_id

    def poll(self, run) -> str:
        site = ((run.config.get("compute") or {}).get("g5k") or {}).get("site", "nancy")
        return g5k_poll(self._client, site, run.external_job_id)

    def fetch(self, run, out_dir: Path) -> bool:
        config = (run.config.get("compute") or {}).get("g5k") or {}
        site = config.get("site", "nancy")
        workdir = config.get("workdir", "~/pactiva")
        access_remote = f"{self._access_path(site, workdir)}/runs/{run.id}/results/"
        self._rsync_pull(access_remote, Path(out_dir))
        return sentinel_present(out_dir)

    @staticmethod
    def _access_path(site: str, workdir: str) -> str:
        """Traduit un chemin tel que vu PAR LE NŒUD (`workdir`, ex. `~/pactiva`) vers son
        équivalent DEPUIS `access.grid5000.fr` (ex. `~/nantes/pactiva`).

        Le `home` Grid'5000 est propre à chaque site — jamais partagé entre eux
        (docs/pactiva-g5k/research/04_STOCKAGE_RESEAU.md §1.1). Sur `access.grid5000.fr`,
        `~` seul pointe vers le disque LOCAL du frontal (quelques centaines de Mo,
        écriture refusée à un utilisateur standard) ; chaque home de site y est monté en
        NFS sous `~/<site>/`. Sur un NŒUD réservé au site X, en revanche, `~` pointe
        DIRECTEMENT le home NFS de ce site (pas de sous-dossier `<site>/` à ajouter — le
        nœud n'a jamais qu'un seul site à voir). Les deux chemins désignent donc le MÊME
        stockage NFS, vus depuis deux machines différentes avec des racines différentes.
        """
        if not workdir.startswith("~"):
            return workdir  # chemin absolu déjà explicite — rien à qualifier par site
        relative = workdir[1:].lstrip("/")
        return f"~/{site}/{relative}" if relative else f"~/{site}"

    def cancel(self, run) -> None:
        site = ((run.config.get("compute") or {}).get("g5k") or {}).get("site", "nancy")
        if run.external_job_id:
            g5k_cancel(self._client, site, run.external_job_id)

    # -- Transfert --------------------------------------------------------- #

    def _rsync_push(self, dataset_dir: Path, out_dir: Path, remote: str) -> None:
        target = f"{self.login}@{GATEWAY}:{remote}/"
        with temporary_ssh_key(self.ssh_key) as key_path:
            rsh = ssh_command(key_path)
            self._run_rsync(["-az", "--mkpath", "-e", rsh, f"{dataset_dir}/", f"{target}dataset/"])
            self._run_rsync(["-az", "-e", rsh, f"{out_dir}/config.json", f"{out_dir}/run.sh", target])

    def _rsync_pull(self, remote: str, out_dir: Path) -> None:
        out_dir.mkdir(parents=True, exist_ok=True)
        # `allow_failure` : un rapatriement partiel n'est pas une erreur — c'est le cas
        # nominal quand le walltime a coupé le job.
        with temporary_ssh_key(self.ssh_key) as key_path:
            rsh = ssh_command(key_path)
            self._run_rsync(
                ["-az", "-e", rsh, f"{self.login}@{GATEWAY}:{remote}", f"{out_dir}/"],
                allow_failure=True,
            )

    def _run_rsync(self, args: list[str], *, allow_failure: bool = False) -> None:
        completed = subprocess.run(
            ["rsync", *args], capture_output=True, text=True, timeout=1800, check=False
        )
        if completed.returncode != 0 and not allow_failure:
            raise G5KError(
                "g5k_transfer_failed",
                # Jamais la commande complète dans le message : elle contient le login.
                f"échec du transfert (code {completed.returncode})",
            )

"""Exécution sur Grid'5000 — API REST + OAR.

Documentation officielle consultée le 11 août 2026 :
* racine `https://api.grid5000.fr/stable`, **HTTP Basic** depuis l'extérieur ;
* `POST /sites/{site}/jobs` → 201 Created, URI du job dans l'en-tête `Location` ;
* `GET /sites/{site}/jobs/{id}` → `state` ∈ {waiting, running, stopped} ;
* transfert de fichiers par la passerelle `access.grid5000.fr`.

Deux contraintes structurent le code :

* **un job peut attendre longtemps en file** → l'état `waiting` est distinct de
  `running`, et le sondage est adaptatif (inutile d'interroger toutes les 5 s un job en
  file depuis deux heures) ;
* **le *walltime* est un couperet** → on rapatrie même sans `_SENTINEL`, et on ingère en
  `partial` plutôt que de jeter le travail accompli.

Grid'5000 n'est jamais sur le chemin critique : en cas d'indisponibilité, le run échoue
avec un code explicite et reste rejouable en local.
"""

from __future__ import annotations

import json
import logging
import shlex
import subprocess
import urllib.error
import urllib.request
from base64 import b64encode
from pathlib import Path

from .base import ExecutionBackend, sentinel_present, write_config

logger = logging.getLogger("claire.lab.g5k")

API_ROOT = "https://api.grid5000.fr/stable"
GATEWAY = "access.grid5000.fr"

# Sondage adaptatif : dense au début (le job peut démarrer tout de suite), puis espacé.
POLL_SCHEDULE = ((60, 5), (600, 15), (None, 60))


class G5KError(RuntimeError):
    """Erreur côté Grid'5000, porteuse d'un code exploitable par l'UI."""

    def __init__(self, code: str, detail: str):
        self.code = code
        super().__init__(detail)


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
    échouer en trois secondes avec un code distinct (64/65).
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
    return f"""#!/usr/bin/env bash
set -euo pipefail
RUN_DIR="{workdir}/runs/{run_id}"
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

    def __init__(self, login: str | None = None, password: str | None = None):
        # Les identifiants ne sont détenus qu'en mémoire, le temps de la soumission.
        self.login = login
        self.password = password

    # -- HTTP ------------------------------------------------------------- #

    def _request(self, method: str, url: str, payload: dict | None = None) -> dict:
        data = json.dumps(payload).encode() if payload is not None else None
        request = urllib.request.Request(url, data=data, method=method)
        request.add_header("Content-Type", "application/json")
        if self.login and self.password:
            token = b64encode(f"{self.login}:{self.password}".encode()).decode()
            request.add_header("Authorization", f"Basic {token}")
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                body = response.read().decode("utf-8")
                return json.loads(body) if body.strip() else {}
        except urllib.error.HTTPError as exc:
            if exc.code in (401, 403):
                raise G5KError("g5k_auth_failed", "identifiants Grid'5000 refusés") from exc
            raise G5KError("g5k_http_error", f"HTTP {exc.code} sur {method} {url}") from exc
        except urllib.error.URLError as exc:
            raise G5KError("g5k_unreachable", f"API injoignable : {exc.reason}") from exc

    def test_connection(self) -> tuple[bool, str]:
        """Vérifie les identifiants AVANT de réserver quoi que ce soit.

        Découvrir un mot de passe faux au bout d'une réservation de quatre heures est
        exactement ce qu'il faut éviter.
        """
        try:
            payload = self._request("GET", f"{API_ROOT}/sites")
        except G5KError as exc:
            return False, f"{exc.code} : {exc}"
        sites = [item.get("uid") for item in payload.get("items", [])]
        return True, f"connexion établie ({len(sites)} sites)"

    # -- Cycle de vie ------------------------------------------------------ #

    def submit(self, run, dataset_dir: Path, out_dir: Path) -> str:
        config = (run.config.get("compute") or {}).get("g5k") or {}
        site = config.get("site", "nancy")
        workdir = config.get("workdir", "~/pactiva")
        env_name = config.get("env_name", "pactiva-lab")
        resources = config.get("resources", "gpu=1,walltime=04:00")
        queue = config.get("queue", "default")
        require_gpu = bool((run.config.get("compute") or {}).get("require_gpu"))

        out_dir = Path(out_dir)
        write_config(out_dir, run.config)
        script = build_run_script(
            run_id=str(run.id), require_gpu=require_gpu, env_name=env_name, workdir=workdir
        )
        (out_dir / "run.sh").write_text(script, encoding="utf-8")

        remote = f"{workdir}/runs/{run.id}"
        self._rsync_push(dataset_dir, out_dir, remote)

        payload = {
            "resources": resources,
            "command": f"bash {remote}/run.sh",
            "types": ["besteffort"] if queue == "besteffort" else [],
        }
        if queue == "production":
            payload["queue"] = "production"

        response = self._request("POST", f"{API_ROOT}/sites/{site}/jobs", payload)
        job_id = str(response.get("uid") or response.get("id") or "")
        if not job_id:
            raise G5KError("g5k_submit_failed", f"réponse sans identifiant de job : {response}")
        logger.info("g5k_submitted run=%s job=%s site=%s", run.id, job_id, site)
        return job_id

    def poll(self, run) -> str:
        site = ((run.config.get("compute") or {}).get("g5k") or {}).get("site", "nancy")
        payload = self._request("GET", f"{API_ROOT}/sites/{site}/jobs/{run.external_job_id}")
        state = payload.get("state", "")
        # L'API expose waiting/running/stopped ; on les remonte tels quels pour que l'UI
        # puisse distinguer « en file » de « en cours ».
        return {"waiting": "waiting", "running": "running"}.get(state, "stopped")

    def fetch(self, run, out_dir: Path) -> bool:
        config = (run.config.get("compute") or {}).get("g5k") or {}
        workdir = config.get("workdir", "~/pactiva")
        remote = f"{workdir}/runs/{run.id}/results/"
        self._rsync_pull(remote, Path(out_dir))
        return sentinel_present(out_dir)

    def cancel(self, run) -> None:
        site = ((run.config.get("compute") or {}).get("g5k") or {}).get("site", "nancy")
        if run.external_job_id:
            self._request("DELETE", f"{API_ROOT}/sites/{site}/jobs/{run.external_job_id}")

    # -- Transfert --------------------------------------------------------- #

    def _rsync_push(self, dataset_dir: Path, out_dir: Path, remote: str) -> None:
        target = f"{self.login}@{GATEWAY}:{remote}/"
        self._run_rsync(["-az", "--mkpath", f"{dataset_dir}/", f"{target}dataset/"])
        self._run_rsync(["-az", f"{out_dir}/config.json", f"{out_dir}/run.sh", target])

    def _rsync_pull(self, remote: str, out_dir: Path) -> None:
        out_dir.mkdir(parents=True, exist_ok=True)
        # `|| true` implicite : un rapatriement partiel n'est pas une erreur — c'est le
        # cas nominal quand le walltime a coupé le job.
        self._run_rsync(
            ["-az", f"{self.login}@{GATEWAY}:{remote}", f"{out_dir}/"], allow_failure=True
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

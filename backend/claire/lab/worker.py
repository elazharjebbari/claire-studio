"""Boucle du worker : prend un run en file, l'exécute, ingère ses résultats.

Séparé des vues pour rester testable sans HTTP. La stratégie de reprise est celle du
worker d'analyse, déjà éprouvée : heartbeat, reprise des zombies, retry borné.
"""

from __future__ import annotations

import logging
import time
from pathlib import Path

from django.utils import timezone

from .crypto import decrypt_secret
from .models import ComputeCredential, ExperimentRun, RunStatus
from .runners import get_backend
from .services import claim_next_run, fail_run, heartbeat, ingest_results, lab_storage_root

logger = logging.getLogger("claire.lab")


def _backend_for(run: ExperimentRun):
    """Instancie le backend, en injectant les identifiants au dernier moment.

    Les identifiants ne sont déchiffrés qu'ici, en mémoire, et ne sont jamais écrits
    dans un fichier déposé sur le stockage partagé.
    """
    target = (run.config.get("compute") or {}).get("target", "local")
    if target != "g5k":
        return get_backend("local")

    credential = (
        ComputeCredential.objects.filter(
            user=run.experiment.created_by, kind="g5k"
        ).first()
    )
    if credential is None or not credential.secret_encrypted:
        raise RuntimeError("credentials_missing")

    from .runners.g5k import Grid5000Backend

    return Grid5000Backend(
        login=credential.login, password=decrypt_secret(credential.secret_encrypted)
    )


def execute_run(run: ExperimentRun) -> ExperimentRun:
    """Exécute un run de bout en bout."""
    dataset = run.experiment.dataset
    out_dir = lab_storage_root() / "runs" / str(run.id)
    out_dir.mkdir(parents=True, exist_ok=True)
    run.storage_path = str(out_dir)
    run.save(update_fields=["storage_path"])

    try:
        backend = _backend_for(run)
    except RuntimeError as exc:
        return fail_run(
            run, str(exc),
            "aucun identifiant Grid'5000 configuré pour cet utilisateur",
        )

    try:
        job_id = backend.submit(run, Path(dataset.storage_path), out_dir)
    except Exception as exc:
        code = getattr(exc, "code", "submit_failed")
        return fail_run(run, code, str(exc))

    if job_id:
        run.external_job_id = job_id
        run.status = RunStatus.WAITING
        run.save(update_fields=["external_job_id", "status"])
        if not _wait_remote(run, backend):
            return run

    try:
        complete = backend.fetch(run, out_dir)
    except Exception as exc:
        return fail_run(run, getattr(exc, "code", "fetch_failed"), str(exc))

    if run.cancel_requested:
        run.status = RunStatus.CANCELLED
        run.completed_at = timezone.now()
        run.save(update_fields=["status", "completed_at"])
        return run

    # `complete=False` = pas de `_SENTINEL` : le job a été coupé (walltime). On ingère
    # tout de même en `partial` — le travail accompli ne doit pas être perdu.
    return ingest_results(run, out_dir, partial=not complete)


def _wait_remote(run: ExperimentRun, backend) -> bool:
    """Sonde un job distant jusqu'à sa fin. Renvoie False si l'attente a échoué."""
    from .runners.g5k import poll_interval

    started = time.time()
    deadline = started + getattr(
        __import__("django.conf", fromlist=["settings"]).settings, "LAB_G5K_MAX_WAIT", 86400
    )
    while time.time() < deadline:
        if run.cancel_requested:
            try:
                backend.cancel(run)
            except Exception:  # pragma: no cover - l'annulation ne doit jamais planter
                logger.warning("g5k_cancel_failed run=%s", run.id)
            run.status = RunStatus.CANCELLED
            run.completed_at = timezone.now()
            run.save(update_fields=["status", "completed_at"])
            return False

        try:
            state = backend.poll(run)
        except Exception as exc:
            fail_run(run, getattr(exc, "code", "g5k_unreachable"), str(exc))
            return False

        if state == "stopped":
            return True
        if state == "running" and run.status != RunStatus.RUNNING:
            run.status = RunStatus.RUNNING
            run.save(update_fields=["status"])
        heartbeat(run, phase=state)
        time.sleep(poll_interval(time.time() - started))

    fail_run(run, "g5k_timeout", "délai d'attente dépassé pour le job distant")
    return False


def run_once() -> bool:
    """Traite un run s'il y en a un. Renvoie True si du travail a été fait."""
    run = claim_next_run()
    if run is None:
        return False
    logger.info("lab_run_started id=%s attempt=%s", run.id, run.attempt)
    try:
        execute_run(run)
    except Exception as exc:  # pragma: no cover - un run qui plante ne tue pas le worker
        logger.exception("lab_run_crashed id=%s", run.id)
        fail_run(run, "worker_crash", str(exc))
    return True


def loop(*, interval: float = 5.0, max_iterations: int | None = None) -> None:
    """Boucle du worker. `max_iterations` sert aux tests."""
    iterations = 0
    while max_iterations is None or iterations < max_iterations:
        if not run_once():
            time.sleep(interval)
        iterations += 1

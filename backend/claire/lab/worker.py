"""Boucle du worker : prend un run en file, l'exécute, ingère ses résultats.

Séparé des vues pour rester testable sans HTTP. La stratégie de reprise est celle du
worker d'analyse, déjà éprouvée : heartbeat, reprise des zombies, retry borné.
"""

from __future__ import annotations

import logging
import time
from pathlib import Path

from django.conf import settings
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
        login=credential.login,
        password=decrypt_secret(credential.secret_encrypted),
        ssh_key=decrypt_secret(credential.ssh_key_encrypted) if credential.ssh_key_encrypted else None,
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

    # Bug réel trouvé le 14 août 2026 (5 runs G5K sur 8, même sweep, même worker) :
    # `results.json` existait bel et bien côté Grid'5000 (vérifié à la main quelques
    # minutes après l'échec) mais le PREMIER rapatriement ne le voyait pas — une course
    # entre la fin du job côté nœud de calcul et la visibilité NFS de son écriture
    # depuis `access.grid5000.fr` (deux machines distinctes, cohérence "close-to-open"
    # NFS non instantanée). `_wait_remote` déclenche `fetch()` dès que l'état OAR passe
    # à "stopped", sans délai de grâce. Quelques nouvelles tentatives espacées
    # absorbent cette course sans rien coûter dans le cas normal (le fichier est déjà là
    # au premier essai la plupart du temps).
    max_attempts = getattr(settings, "LAB_FETCH_RETRIES", 3)
    try:
        complete = backend.fetch(run, out_dir)
        attempt = 1
        while not (Path(out_dir) / "results.json").exists() and attempt < max_attempts:
            time.sleep(3)
            complete = backend.fetch(run, out_dir)
            attempt += 1
    except Exception as exc:
        return fail_run(run, getattr(exc, "code", "fetch_failed"), str(exc))

    # `fetch` peut prendre du temps (rsync d'un gros résultat) — même rafraîchissement
    # que dans `_wait_remote`, pour la même raison : `run` peut avoir été chargé bien
    # avant qu'une annulation ne soit posée par le process web.
    run.refresh_from_db(fields=["cancel_requested"])
    if run.cancel_requested:
        run.status = RunStatus.CANCELLED
        run.completed_at = timezone.now()
        run.save(update_fields=["status", "completed_at"])
        return run

    # `complete=False` = pas de `_SENTINEL` : le job a été coupé (walltime). On ingère
    # tout de même en `partial` — le travail accompli ne doit pas être perdu.
    return ingest_results(run, out_dir, partial=not complete)


PROGRESS_INTERVAL = 60.0  # secondes entre deux lectures de la progression distante


def _wait_remote(run: ExperimentRun, backend) -> bool:
    """Sonde un job distant jusqu'à sa fin. Renvoie False si l'attente a échoué."""
    from .runners.g5k import poll_interval

    started = time.time()
    # Première interrogation immédiate : un job repris en cours de route doit afficher
    # son avancement réel sans attendre une minute de plus.
    last_progress_at = 0.0
    deadline = started + getattr(
        __import__("django.conf", fromlist=["settings"]).settings, "LAB_G5K_MAX_WAIT", 86400
    )
    while time.time() < deadline:
        # Le worker tourne dans un process séparé de celui qui sert `POST .../cancel`
        # (`manage.py lab_worker` vs le process web) : sans ce rafraîchissement, `run`
        # reste l'instance figée chargée une fois par `claim_next_run()`, et une
        # annulation demandée pendant l'attente d'un job distant de plusieurs heures ne
        # serait JAMAIS vue avant le prochain redémarrage du worker.
        run.refresh_from_db(fields=["cancel_requested"])
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

        # La progression coûte un aller-retour SSH : on l'interroge au plus une fois par
        # minute, alors que le sondage d'état descend à cinq secondes en début de job.
        progress = None
        now = time.time()
        if state == "running" and now - last_progress_at >= PROGRESS_INTERVAL:
            progress = backend.remote_progress(run)
            last_progress_at = now
        heartbeat(run, phase=state, progress=progress)
        time.sleep(poll_interval(time.time() - started))

    fail_run(run, "g5k_timeout", "délai d'attente dépassé pour le job distant")
    return False


def _cancel_zombie_external_job(zombie: ExperimentRun) -> None:
    """Annule le job Grid'5000 sous-jacent d'un run repris comme zombie.

    Bug réel trouvé le 14 août 2026 (revue avant Palier 6) : sans ce nettoyage,
    l'ancien job continue de tourner sur le cluster — orphelin, invisible — pendant
    que le run repris en soumet un second au prochain passage. Un doublon silencieux
    qui consomme des heures GPU partagées pour rien, sur une plateforme où chaque
    réservation retire une ressource à d'autres équipes.
    """
    if not zombie.external_job_id:
        return  # jamais soumis (échec avant submit), ou run local — rien à annuler
    try:
        backend = _backend_for(zombie)
        backend.cancel(zombie)
        logger.warning(
            "g5k_zombie_cancelled run=%s job=%s", zombie.id, zombie.external_job_id,
        )
    except Exception:  # pragma: no cover - l'annulation ne doit jamais bloquer la reprise
        logger.exception(
            "g5k_zombie_cancel_failed run=%s job=%s — annulation manuelle nécessaire "
            "(oardel côté Grid'5000)", zombie.id, zombie.external_job_id,
        )


def run_once() -> bool:
    """Traite un run s'il y en a un. Renvoie True si du travail a été fait."""
    run, zombie = claim_next_run()
    if zombie is not None:
        _cancel_zombie_external_job(zombie)
    if run is None:
        return zombie is not None
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

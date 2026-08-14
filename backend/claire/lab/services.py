"""Cycle de vie des datasets et des runs — orchestration.

Aucun calcul scientifique ici : on file, on dispatche, on ingère. La mécanique
(déduplication par empreinte, heartbeat, reprise de zombie, annulation coopérative) est
calquée sur `claire.analysis.services`, éprouvée en production.
"""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .builder import build_dataset_files
from .contracts import ResultValidationError, validate_results
from .models import (
    ArtifactKind,
    DatasetStatus,
    ExperimentRun,
    LabDataset,
    RunArtifact,
    RunStatus,
)

logger = logging.getLogger("claire.lab")

# Un run sans battement au-delà de ce délai est considéré perdu et repris. Généreux :
# un chargement de poids de transformer peut prendre plusieurs minutes sans écrire.
HEARTBEAT_TIMEOUT = timedelta(minutes=20)
MAX_ATTEMPTS = 3


class DuplicateDataset(Exception):
    """Un dataset de même empreinte existe déjà — on renvoie l'existant."""

    def __init__(self, dataset: LabDataset):
        self.dataset = dataset
        super().__init__(f"dataset déjà construit : {dataset.id}")


class DuplicateRun(Exception):
    """Même (dataset, config) déjà exécuté. Sur des heures de GPU, ce n'est pas un
    confort mais une nécessité."""

    def __init__(self, run: ExperimentRun):
        self.run = run
        super().__init__(f"run déjà exécuté : {run.id}")


def lab_storage_root() -> Path:
    """Racine de stockage des datasets et résultats."""
    root = getattr(settings, "LAB_DIR", None)
    if root:
        return Path(root)
    return Path(settings.BASE_DIR).parent / "var" / "lab"


def build_dataset(
    *,
    project,
    user,
    label: str = "",
    maturity: str = "complete",
    aggregation: str = "consensus",
    scope: dict | None = None,
    k: int = 5,
    seed: int = 42,
    single_annotator: str | None = None,
    force: bool = False,
) -> LabDataset:
    """Construit un dataset et le persiste. Lève `DuplicateDataset` si identique existe.

    La construction se fait D'ABORD à blanc (sans écrire), pour obtenir l'empreinte et
    détecter un doublon avant d'avoir consommé du disque.
    """
    result = build_dataset_files(
        project,
        maturity=maturity,
        aggregation=aggregation,
        scope=scope,
        k=k,
        seed=seed,
        single_annotator=single_annotator,
        out_dir=None,
    )
    manifest = result["manifest"]
    fingerprint = manifest["fingerprint"]

    if not force:
        existing = LabDataset.objects.filter(
            project=project, fingerprint=fingerprint, status=DatasetStatus.READY
        ).first()
        if existing:
            raise DuplicateDataset(existing)

    dataset = LabDataset.objects.create(
        project=project,
        created_by=user,
        label=label.strip()[:200],
        maturity=maturity,
        aggregation=aggregation,
        scope=scope or {},
        manifest=manifest,
        splits=result["splits"],
        fingerprint=fingerprint,
        status=DatasetStatus.BUILDING,
    )

    out_dir = lab_storage_root() / "datasets" / str(dataset.id)
    try:
        build_dataset_files(
            project,
            maturity=maturity,
            aggregation=aggregation,
            scope=scope,
            k=k,
            seed=seed,
            single_annotator=single_annotator,
            out_dir=out_dir,
        )
    except Exception as exc:  # pragma: no cover - défensif
        dataset.status = DatasetStatus.FAILED
        dataset.error = str(exc)[:500]
        dataset.save(update_fields=["status", "error", "updated_at"])
        raise

    dataset.status = DatasetStatus.READY
    dataset.storage_path = str(out_dir)
    dataset.n_documents = manifest["nDocuments"]
    dataset.n_sentences = manifest["nSentences"]
    dataset.n_annotations = manifest["nAnnotations"]
    dataset.save(
        update_fields=[
            "status", "storage_path", "n_documents", "n_sentences",
            "n_annotations", "updated_at",
        ]
    )
    logger.info(
        "lab_dataset_built id=%s docs=%s sentences=%s excluded=%s",
        dataset.id, dataset.n_documents, dataset.n_sentences, len(manifest["excluded"]),
    )
    return dataset


def run_fingerprint(dataset: LabDataset, config: dict) -> str:
    """Empreinte de (dataset, config). Base de la déduplication."""
    blob = json.dumps(
        {"dataset": dataset.fingerprint, "config": config},
        sort_keys=True, ensure_ascii=False, separators=(",", ":"), default=str,
    )
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


@transaction.atomic
def queue_run(*, experiment, config: dict | None = None, force: bool = False) -> ExperimentRun:
    """Met un run en file, sauf s'il a déjà été exécuté à l'identique."""
    config = config or experiment.config
    fingerprint = run_fingerprint(experiment.dataset, config)

    if not force:
        existing = (
            ExperimentRun.objects.filter(
                experiment__dataset=experiment.dataset,
                fingerprint=fingerprint,
                status__in=[RunStatus.SUCCEEDED, RunStatus.RUNNING, RunStatus.QUEUED],
            )
            .order_by("-created_at")
            .first()
        )
        if existing:
            raise DuplicateRun(existing)

    return ExperimentRun.objects.create(
        experiment=experiment, config=config, fingerprint=fingerprint, status=RunStatus.QUEUED
    )


def claim_next_run() -> tuple[ExperimentRun | None, ExperimentRun | None]:
    """Prend le prochain run à traiter, en récupérant au passage les zombies.

    Un run `running` OU `waiting` sans battement depuis `HEARTBEAT_TIMEOUT` est repris :
    sans cela, un worker tué laisse le run bloqué pour toujours. `waiting` compte
    délibérément — bug réel trouvé le 14 août 2026 (revue avant Palier 6) : c'est
    justement la phase la plus longue sur une plateforme partagée (le job attend en
    file OAR avant même de démarrer), et `heartbeat()` y est appelée à chaque sonde
    (`_wait_remote`, `worker.py`) exactement comme en `running` — un `waiting` figé
    signale donc la mort du worker tout aussi sûrement.

    Renvoie `(run_a_traiter, zombie_repris)` — le second sert à l'appelant
    (`worker.run_once`) pour tenter d'annuler le job Grid'5000 sous-jacent APRÈS cette
    transaction (jamais un appel réseau sous un verrou de ligne) : sans ça, l'ancien
    `external_job_id` continuerait de tourner sur le cluster, orphelin, pendant que le
    run repris en soumet un second — un doublon silencieux qui consomme des heures GPU
    partagées pour rien.
    """
    cutoff = timezone.now() - HEARTBEAT_TIMEOUT
    with transaction.atomic():
        zombie = (
            ExperimentRun.objects.select_for_update(skip_locked=True)
            .filter(status__in=[RunStatus.RUNNING, RunStatus.WAITING], heartbeat_at__lt=cutoff)
            .order_by("created_at")
            .first()
        )
        if zombie:
            if zombie.attempt >= MAX_ATTEMPTS:
                zombie.status = RunStatus.FAILED
                zombie.error_code = "heartbeat_lost"
                zombie.error_detail = "run repris trop de fois sans battement"
                zombie.completed_at = timezone.now()
                zombie.save(
                    update_fields=["status", "error_code", "error_detail", "completed_at"]
                )
                logger.warning("lab_run_abandoned id=%s attempts=%s", zombie.id, zombie.attempt)
            else:
                zombie.status = RunStatus.QUEUED
                zombie.heartbeat_at = None
                zombie.save(update_fields=["status", "heartbeat_at"])
                logger.warning("lab_run_requeued id=%s attempt=%s", zombie.id, zombie.attempt)

        run = (
            ExperimentRun.objects.select_for_update(skip_locked=True)
            .filter(status=RunStatus.QUEUED)
            .order_by("created_at")
            .first()
        )
        if run is None:
            return None, zombie
        run.status = RunStatus.RUNNING
        run.attempt += 1
        run.started_at = run.started_at or timezone.now()
        run.heartbeat_at = timezone.now()
        run.save(update_fields=["status", "attempt", "started_at", "heartbeat_at"])
        return run, zombie


def heartbeat(run: ExperimentRun, *, progress: int | None = None, phase: str = "") -> None:
    fields = ["heartbeat_at"]
    run.heartbeat_at = timezone.now()
    if progress is not None:
        run.progress = max(0, min(100, progress))
        fields.append("progress")
    if phase:
        run.phase = phase[:40]
        fields.append("phase")
    run.save(update_fields=fields)


def ingest_results(run: ExperimentRun, out_dir: Path, *, partial: bool = False) -> ExperimentRun:
    """Valide et ingère les résultats. TOUT OU RIEN.

    Un `results.json` non conforme fait échouer le run plutôt que d'entrer en base à
    moitié : un résultat partiel silencieux se retrouverait ensuite dans un tableau de
    l'article sans que personne ne s'en aperçoive.
    """
    results_path = Path(out_dir) / "results.json"
    if not results_path.exists():
        return fail_run(run, "result_missing", f"results.json absent de {out_dir}")

    try:
        payload = json.loads(results_path.read_text(encoding="utf-8"))
        validate_results(payload)
    except (json.JSONDecodeError, ResultValidationError) as exc:
        return fail_run(run, "result_schema_invalid", str(exc)[:500])

    run.metrics = payload
    run.environment = payload.get("environment", {})
    run.storage_path = str(out_dir)
    run.status = RunStatus.PARTIAL if partial else RunStatus.SUCCEEDED
    run.progress = 100
    run.completed_at = timezone.now()
    run.save(
        update_fields=[
            "metrics", "environment", "storage_path", "status", "progress", "completed_at",
        ]
    )
    _register_artifacts(run, Path(out_dir))
    logger.info("lab_run_ingested id=%s status=%s", run.id, run.status)
    return run


def _register_artifacts(run: ExperimentRun, out_dir: Path) -> None:
    """Recense les fichiers produits. Le contenu n'est pas relu : seul le catalogue
    entre en base, les fichiers restent sur le disque."""
    mapping = {
        "figures": (ArtifactKind.FIGURE, "image/svg+xml"),
        "tables": (ArtifactKind.TABLE, "text/csv"),
    }
    RunArtifact.objects.filter(run=run).delete()
    artifacts = []
    for folder, (kind, mime) in mapping.items():
        directory = out_dir / folder
        if not directory.is_dir():
            continue
        for path in sorted(directory.iterdir()):
            if path.is_file():
                artifacts.append(
                    RunArtifact(
                        run=run, kind=kind, name=path.name, path=str(path),
                        mime=mime, bytes=path.stat().st_size,
                        checksum=hashlib.sha256(path.read_bytes()).hexdigest(),
                    )
                )
    for name, kind, mime in (
        ("predictions.jsonl", ArtifactKind.PREDICTIONS, "application/x-ndjson"),
        ("errors.json", ArtifactKind.ERRORS, "application/json"),
        ("run.log", ArtifactKind.LOG, "text/plain"),
    ):
        path = out_dir / name
        if path.is_file():
            artifacts.append(
                RunArtifact(
                    run=run, kind=kind, name=name, path=str(path), mime=mime,
                    bytes=path.stat().st_size,
                    checksum=hashlib.sha256(path.read_bytes()).hexdigest(),
                )
            )
    RunArtifact.objects.bulk_create(artifacts)


def fail_run(run: ExperimentRun, code: str, detail: str) -> ExperimentRun:
    run.status = RunStatus.FAILED
    run.error_code = code[:60]
    run.error_detail = detail[:500]
    run.completed_at = timezone.now()
    run.save(update_fields=["status", "error_code", "error_detail", "completed_at"])
    logger.error("lab_run_failed id=%s code=%s", run.id, code)
    return run


def cancel_run(run: ExperimentRun) -> ExperimentRun:
    """Annulation coopérative : on pose le drapeau, le runner le lit et s'arrête."""
    if run.status in (RunStatus.SUCCEEDED, RunStatus.FAILED, RunStatus.CANCELLED):
        return run
    run.cancel_requested = True
    run.save(update_fields=["cancel_requested"])
    return run


def comparable(runs: list[ExperimentRun]) -> tuple[bool, str]:
    """Deux runs ne sont comparables que sur les MÊMES plis.

    Comparer deux modèles évalués sur des découpages différents produit un écart qui ne
    veut rien dire — c'est une erreur courante et invisible dans un tableau de résultats.
    """
    if len(runs) < 2:
        return False, "au moins deux runs sont nécessaires"
    splits = {json.dumps(run.experiment.dataset.splits.get("folds"), sort_keys=True)
              for run in runs}
    if len(splits) > 1:
        return False, "plis différents : les scores ne sont pas comparables"
    tasks = {run.experiment.task for run in runs}
    if len(tasks) > 1:
        return False, "tâches différentes (T1/T2/T3) : plafonds humains distincts"
    return True, ""

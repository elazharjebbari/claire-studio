"""Orchestration des runs et rapports historiques."""

from __future__ import annotations

import hashlib
import json
import logging
import threading
import time

from django.conf import settings
from django.db import close_old_connections, connection, transaction
from django.utils import timezone

from claire.audit.services import record_event

from .metrics import registry
from .models import AnalysisReport, AnalysisRun, RunStatus

logger = logging.getLogger("claire.analysis")
DEFAULT_METRICS = [
    "overview",
    "actor_profiles",
    "quality",
    "pairwise_agreement",
    "intra_annotator",
    "gold_analysis",
    "taxonomy",
    # Chantier Lab (docs/pactiva-lab/) — enrichissement du module Analyse & Qualité.
    # Additifs : chaque calculateur est PUR et lit le même payload figé, sans requête
    # supplémentaire ; un run existant recalculé avec ce code obtient simplement des
    # clés en plus dans `result`, jamais une régression sur les clés déjà là.
    "alpha_masi",
    "boundary_agreement",
    "label_distribution",
    "cooccurrence",
    "human_llm_matrix",
    "annotator_audit",
    "gold_progress",
    "campaign_readiness",
]


def _hash(value) -> str:
    raw = json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    return hashlib.sha256(raw.encode()).hexdigest()


@transaction.atomic
def queue_run(
    *, snapshot, user, metric_codes: list[str] | None = None, configuration=None
) -> AnalysisRun:
    metric_codes = metric_codes or DEFAULT_METRICS
    definitions = [registry.get(code) for code in metric_codes]
    versions = {definition.code: definition.version for definition in definitions}
    fingerprint = _hash(
        {"snapshot": snapshot.fingerprint, "metrics": versions, "codes": metric_codes}
    )
    existing = AnalysisRun.objects.filter(
        snapshot=snapshot,
        fingerprint=fingerprint,
        status__in=[RunStatus.QUEUED, RunStatus.RUNNING, RunStatus.SUCCEEDED],
    ).first()
    if existing:
        return existing

    run = AnalysisRun.objects.create(
        project=snapshot.project,
        snapshot=snapshot,
        created_by=user,
        metric_codes=metric_codes,
        metric_versions=versions,
        configuration=configuration or {},
        status=RunStatus.QUEUED,
        progress=0,
        fingerprint=fingerprint,
    )
    return run


def run_analysis(run_id) -> AnalysisRun:
    """Réclame puis exécute un run persistant ; sûr face à deux workers concurrents."""

    with transaction.atomic():
        run = (
            AnalysisRun.objects.select_for_update()
            .select_related("snapshot", "created_by")
            .get(pk=run_id)
        )
        if run.status in {RunStatus.SUCCEEDED, RunStatus.CANCELED}:
            return run
        if run.status == RunStatus.RUNNING:
            return run
        if run.cancel_requested:
            run.status = RunStatus.CANCELED
            run.completed_at = timezone.now()
            run.save(update_fields=["status", "completed_at"])
            return run
        run.status = RunStatus.RUNNING
        run.progress = 5
        run.attempt += 1
        run.started_at = run.started_at or timezone.now()
        run.heartbeat_at = timezone.now()
        run.save(update_fields=["status", "progress", "attempt", "started_at", "heartbeat_at"])

    definitions = [registry.get(code) for code in run.metric_codes]
    try:
        result = {}
        for index, definition in enumerate(definitions, start=1):
            run.refresh_from_db(fields=["cancel_requested"])
            if run.cancel_requested:
                run.status = RunStatus.CANCELED
                run.completed_at = timezone.now()
                run.save(update_fields=["status", "completed_at"])
                return run
            started = time.monotonic()
            result[definition.code] = definition.calculator(run.snapshot.payload)
            logger.info(
                "analysis_metric_done run=%s metric=%s duration_ms=%d",
                run.id,
                definition.code,
                int((time.monotonic() - started) * 1000),
            )
            run.progress = 5 + int(index / len(definitions) * 90)
            run.heartbeat_at = timezone.now()
            run.save(update_fields=["progress", "heartbeat_at"])
    except Exception as exc:
        run.status = RunStatus.FAILED
        run.error_code = "metric_calculation_failed"
        run.error_detail = str(exc)[:500]
        run.completed_at = timezone.now()
        run.save(update_fields=["status", "error_code", "error_detail", "completed_at"])
        raise
    run.result = result
    run.status = RunStatus.SUCCEEDED
    run.progress = 100
    run.completed_at = timezone.now()
    run.save(update_fields=["result", "status", "progress", "completed_at"])
    record_event(
        actor=run.created_by,
        verb="analysis.run.completed",
        target=run,
        payload={"snapshot": str(run.snapshot_id), "metrics": run.metric_codes},
    )
    return run


def execute_run(
    *, snapshot, user, metric_codes: list[str] | None = None, configuration=None
) -> AnalysisRun:
    """Compatibilité service : crée puis calcule immédiatement depuis le snapshot."""

    run = queue_run(
        snapshot=snapshot, user=user, metric_codes=metric_codes, configuration=configuration
    )
    return run_analysis(run.id) if run.status != RunStatus.SUCCEEDED else run


def dispatch_run(run_id) -> None:
    """Inline en test, thread en développement, worker DB durable en production."""

    mode = getattr(settings, "ANALYSIS_DISPATCH_MODE", "thread")
    if mode == "inline":
        run_analysis(run_id)
        return
    if mode == "worker":
        return

    def _work():
        close_old_connections()
        try:
            run_analysis(run_id)
        except Exception:  # noqa: BLE001
            logger.exception("analysis_run_crash run=%s", run_id)
        finally:
            connection.close()

    threading.Thread(target=_work, name=f"analysis-{run_id}", daemon=True).start()


@transaction.atomic
def create_report(*, run, user, title: str, description: str = "") -> AnalysisReport:
    overview = run.result.get("overview", {})
    report = AnalysisReport.objects.create(
        project=run.project,
        snapshot=run.snapshot,
        run=run,
        created_by=user,
        title=title.strip()[:200] or f"Rapport du {timezone.localdate():%d/%m/%Y}",
        description=description.strip(),
        visibility=run.snapshot.visibility,
        configuration={
            "metricCodes": run.metric_codes,
            "metricVersions": run.metric_versions,
        },
        summary=overview,
        payload=run.result,
    )
    record_event(
        actor=user,
        verb="analysis.report.created",
        target=report,
        payload={"snapshot": str(run.snapshot_id), "run": str(run.id)},
    )
    return report


def compare_reports(current: AnalysisReport, previous: AnalysisReport) -> dict:
    keys = [
        "documents",
        "annotations",
        "draftAnnotations",
        "publishedAnnotations",
        "eligibleSentences",
        "coveredSentences",
        "coverageRate",
        "goldDecisions",
    ]
    delta = {}
    for key in keys:
        new = current.summary.get(key)
        old = previous.summary.get(key)
        delta[key] = None if new is None or old is None else new - old
    metric_paths = {
        "validationRate": ("quality", "validationRate"),
        "multilabelRate": ("quality", "multilabelRate"),
        "meanKappa": ("pairwise_agreement", "meanKappa"),
        "goldReadinessRate": ("gold_analysis", "readinessRate"),
        "intraStability": ("intra_annotator", "meanStability"),
    }
    metric_delta = {}
    for label, (metric, key) in metric_paths.items():
        new = current.payload.get(metric, {}).get(key)
        old = previous.payload.get(metric, {}).get(key)
        metric_delta[label] = None if new is None or old is None else new - old
    return {
        "current": {"id": str(current.id), "createdAt": current.created_at},
        "previous": {"id": str(previous.id), "createdAt": previous.created_at},
        "delta": delta,
        "metricDelta": metric_delta,
    }

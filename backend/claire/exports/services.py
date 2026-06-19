"""Export service (feature 5) — multi-format with an explanatory manifest.

Implements jsonl + csv (CONTRACT minimum). The export reads the authoritative
DB state in a single read transaction and writes an artifact + manifest.
"""

from __future__ import annotations

import csv
import datetime as dt
import json
import logging
from pathlib import Path

from django.conf import settings
from django.db import transaction

from claire.annotations.models import Annotation
from claire.annotations.services import build_snapshot

from .models import ExportFormat, ExportJob, ExportStatus

logger = logging.getLogger("claire.exports")


def _selected_annotations(job: ExportJob):
    qs = (
        Annotation.objects.filter(project=job.project)
        .select_related("document", "annotator", "project", "project__scheme")
    )
    scope = job.scope or {}
    statuses = scope.get("statuses")
    if statuses:
        qs = qs.filter(status__in=statuses)
    else:
        # Default: gold-grade only.
        qs = qs.filter(status__in=["submitted", "in_review", "approved"])
    documents = scope.get("documents")
    if documents:
        qs = qs.filter(document__external_id__in=documents)
    return qs.order_by("document__external_id", "annotator__username")


def _write_jsonl(path: Path, records: list[dict]) -> None:
    with path.open("w", encoding="utf-8") as fh:
        for rec in records:
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")


def _write_csv(path: Path, records: list[dict]) -> None:
    fieldnames = [
        "doc", "project", "annotator", "schema", "status",
        "global_certainty", "anchor_index", "theme", "legal_nature",
        "evidence_span", "rationale", "certainty",
    ]
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        for rec in records:
            base = {k: rec.get(k) for k in (
                "doc", "project", "annotator", "schema", "status",
                "global_certainty",
            )}
            for clause in rec["clauses"]:
                row = dict(base)
                row.update(clause)
                writer.writerow(row)


@transaction.atomic
def run_export(job: ExportJob) -> ExportJob:
    job.status = ExportStatus.RUNNING
    job.save(update_fields=["status"])

    try:
        records = [build_snapshot(a) for a in _selected_annotations(job)]

        out_dir = Path(settings.EXPORTS_DIR)
        out_dir.mkdir(parents=True, exist_ok=True)
        stamp = dt.datetime.utcnow().strftime("%Y%m%dT%H%M%S")
        fname = f"export_{job.project.slug}_{job.id}_{stamp}.{job.format}"
        path = out_dir / fname

        if job.format == ExportFormat.CSV:
            _write_csv(path, records)
        else:
            # jsonl default (and any other declared format falls back to jsonl
            # pivot, which is the documented explanatory format, CONTRACT §4).
            _write_jsonl(path, records)

        manifest = {
            "project": job.project.slug,
            "format": job.format,
            "scope": job.scope,
            "n_annotations": len(records),
            "n_clauses": sum(len(r["clauses"]) for r in records),
            "schema": job.project.scheme.slug,
            "generated_at": stamp,
            "pivot_format": "CONTRACT §4 clause exchange format",
            "fields": {
                "anchor_index": "0-based sentence index where the clause starts",
                "theme": "closed-vocabulary theme code from the project scheme",
                "certainty": "0=incertain,1=plutot,2=confiant,3=certain",
            },
        }
        job.artifact_path = str(path)
        job.manifest = manifest
        job.status = ExportStatus.DONE
        job.save(update_fields=["artifact_path", "manifest", "status"])
        logger.info(
            "export_done job=%s format=%s annotations=%d path=%s",
            job.id, job.format, len(records), path,
        )
    except Exception as exc:  # pragma: no cover - defensive
        job.status = ExportStatus.FAILED
        job.manifest = {"error": str(exc)}
        job.save(update_fields=["status", "manifest"])
        logger.exception("export_failed job=%s", job.id)
        raise
    return job

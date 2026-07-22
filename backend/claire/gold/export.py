"""Export du gold (scope.gold) — réutilise l'infra ExportJob (async, gating download).

Produit un instantané PAR DOCUMENT : la décision gold de chaque phrase + un bloc additif
``arbitration`` (auto-résolu, décideur, commentaire). Formats jsonl (défaut) ou csv plat.
"""

from __future__ import annotations

import csv
import datetime as dt
import json
from pathlib import Path

from django.conf import settings

from claire.exports.models import ExportStatus

from .models import GoldResolution


def gold_records(project, scope: dict) -> list[dict]:
    """Instantané gold par document (filtrable par scope.documents = external_ids)."""
    wanted = set(scope.get("documents") or [])
    out: list[dict] = []
    qs = (
        GoldResolution.objects.filter(project=project)
        .select_related("document")
        .order_by("document__external_id")
    )
    for res in qs:
        doc = res.document
        if wanted and doc.external_id not in wanted:
            continue
        sentences = []
        for gs in (
            res.sentences.select_related("primary_theme", "decided_by").order_by("index")
        ):
            sentences.append({
                "index": gs.index,
                "primary": gs.primary_theme.code if gs.primary_theme_id else None,
                "secondaries": gs.secondaries,
                "agreement_class": gs.agreement_class,
                "risk_band": gs.risk_band,
                "auto_level": gs.auto_level,
                "confidence": gs.confidence,
                "decided": gs.decided,
                # Bloc additif d'arbitrage (jamais présent dans un snapshot humain).
                "arbitration": {
                    "auto_resolved": gs.auto_resolved,
                    "decided_by": gs.decided_by.username if gs.decided_by_id else None,
                    "comment": gs.comment,
                },
            })
        out.append({
            "document": doc.external_id,
            "title": doc.title,
            "status": res.status,
            "pct_resolved": res.pct_resolved,
            "sentences": sentences,
        })
    return out


def _write_jsonl(path: Path, records: list[dict]) -> None:
    with path.open("w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def _write_csv(path: Path, records: list[dict]) -> None:
    fields = [
        "document", "index", "primary", "secondaries", "agreement_class",
        "risk_band", "auto_level", "confidence", "decided", "auto_resolved", "decided_by",
    ]
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for r in records:
            for s in r["sentences"]:
                w.writerow({
                    "document": r["document"],
                    "index": s["index"],
                    "primary": s["primary"] or "",
                    "secondaries": ",".join(s["secondaries"]),
                    "agreement_class": s["agreement_class"],
                    "risk_band": s["risk_band"],
                    "auto_level": s["auto_level"],
                    "confidence": s["confidence"],
                    "decided": s["decided"],
                    "auto_resolved": s["arbitration"]["auto_resolved"],
                    "decided_by": s["arbitration"]["decided_by"] or "",
                })


def run_gold_export(job):
    """Écrit l'artefact gold + manifeste + statut DONE. Appelé par run_export (scope.gold)."""
    scope = job.scope or {}
    records = gold_records(job.project, scope)

    out_dir = Path(settings.EXPORTS_DIR)
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = dt.datetime.now(dt.UTC).strftime("%Y%m%dT%H%M%S")
    fmt = job.format if job.format in ("csv",) else "jsonl"
    ext = "csv" if fmt == "csv" else "jsonl"
    path = out_dir / f"gold_{job.project.slug}_{job.id}_{stamp}.{ext}"

    if fmt == "csv":
        _write_csv(path, records)
    else:
        _write_jsonl(path, records)

    n_sentences = sum(len(r["sentences"]) for r in records)
    n_decided = sum(1 for r in records for s in r["sentences"] if s["decided"])
    job.artifact_path = str(path)
    job.manifest = {
        "project": job.project.slug,
        "kind": "gold",
        "format_effective": fmt,
        "scope": scope,
        "n_documents": len(records),
        "n_sentences": n_sentences,
        "n_decided": n_decided,
        "schema": job.project.scheme.slug,
        "generated_at": stamp,
    }
    job.status = ExportStatus.DONE
    job.save(update_fields=["artifact_path", "manifest", "status"])
    return job

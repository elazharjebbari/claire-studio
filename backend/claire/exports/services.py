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
    # Scope par annotateur (ADR‑001 §F) : restreint l'export à certaines sessions
    # (utile pour exporter la session d'un annotateur précis, ou comparer). Accepte
    # des usernames OU des pk — comme le reste du contrat (cf. annotations/views).
    annotators = scope.get("annotators")
    if annotators:
        from django.db.models import Q

        q = Q()
        for a in annotators:
            a = str(a)
            q |= Q(annotator__pk=a) if a.isdigit() else Q(annotator__username=a)
        qs = qs.filter(q)
    return qs.order_by("document__external_id", "annotator__username")


def _write_jsonl(path: Path, records: list[dict]) -> None:
    with path.open("w", encoding="utf-8") as fh:
        for rec in records:
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")


def _write_csv(path: Path, records: list[dict]) -> None:
    fieldnames = [
        "doc", "project", "annotator", "schema", "status", "source",
        "global_certainty", "anchor_index", "theme", "legal_nature",
        "evidence_span", "rationale", "certainty", "validated", "order",
    ]
    with path.open("w", encoding="utf-8", newline="") as fh:
        # extrasaction='ignore' : robustesse si build_snapshot gagne d'autres champs.
        writer = csv.DictWriter(fh, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for rec in records:
            base = {k: rec.get(k) for k in (
                "doc", "project", "annotator", "schema", "status", "source",
                "global_certainty",
            )}
            for clause in rec["clauses"]:
                row = dict(base)
                row.update(clause)
                writer.writerow(row)


def _write_md(path: Path, records: list[dict]) -> None:
    """Markdown lisible : un bloc par session (annotateur×document) + clauses."""
    lines: list[str] = ["# Export d'annotations\n"]
    for rec in records:
        lines.append(
            f"## {rec['doc']} — {rec['annotator']} "
            f"({rec['status']}, schéma {rec['schema']})\n"
        )
        if not rec["clauses"]:
            lines.append("_(aucune clause)_\n")
            continue
        lines.append("| phrase | thème | nature | certitude | justification |")
        lines.append("|---|---|---|---|---|")
        for c in rec["clauses"]:
            rationale = (c.get("rationale") or "").replace("\n", " ").replace("|", "\\|")
            lines.append(
                f"| {c['anchor_index']} | {c['theme']} | "
                f"{c.get('legal_nature') or '—'} | {c.get('certainty') if c.get('certainty') is not None else '—'} | "
                f"{rationale} |"
            )
        lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def _write_iaa_matrix(path: Path, project) -> None:
    """CSV de concordance : κ de Cohen pairwise par document (recherche/qualité)."""
    from claire.projects.iaa import project_iaa

    data = project_iaa(project)
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerow(["document", "annotator_a", "annotator_b", "kappa", "n_sentences"])
        for p in data["pairs"]:
            writer.writerow(
                [p["document"], p["annotator_a"], p["annotator_b"], p["kappa"], p["n_sentences"]]
            )


def _write_conll(path: Path, records: list[dict]) -> None:
    """CoNLL-like (colonnes TAB) au niveau phrase : un bloc par session.

    En-tête commentée `# doc / annotator / status` puis, par clause, une ligne
    `anchor_index<TAB>theme<TAB>legal_nature<TAB>certainty<TAB>validated`. Bloc séparé
    par une ligne vide (convention CoNLL). Exploitable pour l'entraînement de modèles
    de segmentation par thème.
    """
    lines: list[str] = []
    for rec in records:
        lines.append(f"# doc = {rec['doc']}")
        lines.append(f"# annotator = {rec['annotator']}")
        lines.append(f"# status = {rec['status']}")
        for c in rec["clauses"]:
            cert = "_" if c.get("certainty") is None else str(c["certainty"])
            lines.append(
                f"{c['anchor_index']}\t{c['theme']}\t{c.get('legal_nature') or '_'}"
                f"\t{cert}\t{'1' if c.get('validated') else '0'}"
            )
        lines.append("")  # séparateur de bloc
    path.write_text("\n".join(lines), encoding="utf-8")


def _write_xml(path: Path, records: list[dict]) -> None:
    """XML structuré (échappé) : <export><annotation …><clause …>rationale</clause>…."""
    from xml.sax.saxutils import escape, quoteattr

    out: list[str] = ['<?xml version="1.0" encoding="UTF-8"?>', "<export>"]
    for rec in records:
        out.append(
            f"  <annotation doc={quoteattr(str(rec['doc']))} "
            f"annotator={quoteattr(str(rec['annotator']))} "
            f"status={quoteattr(str(rec['status']))} "
            f"source={quoteattr(str(rec.get('source') or ''))}>"
        )
        for c in rec["clauses"]:
            out.append(
                f"    <clause anchor_index={quoteattr(str(c['anchor_index']))} "
                f"theme={quoteattr(str(c['theme']))} "
                f"legal_nature={quoteattr(str(c.get('legal_nature') or ''))} "
                f"certainty={quoteattr('' if c.get('certainty') is None else str(c['certainty']))} "
                f"validated={quoteattr('true' if c.get('validated') else 'false')}>"
                f"{escape(c.get('rationale') or '')}</clause>"
            )
        out.append("  </annotation>")
    out.append("</export>")
    path.write_text("\n".join(out), encoding="utf-8")


# Formats réellement implémentés ; tout autre format déclaré retombe sur jsonl
# (le format pivot documenté, CONTRACT §4) — repli TRACÉ dans le manifeste.
_IMPLEMENTED_FORMATS = {
    ExportFormat.JSONL,
    ExportFormat.CSV,
    ExportFormat.MD,
    ExportFormat.CONLL,
    ExportFormat.XML,
    "iaa_matrix",
}


def run_export(job: ExportJob) -> ExportJob:
    """Exécute l'export (idempotent). Les transitions de statut sont écrites en
    AUTOCOMMIT (pas de `@transaction.atomic` global) : un échec doit laisser le job en
    `failed` PERSISTÉ — l'ancien décorateur annulait ce statut au rollback. Seule la
    LECTURE des annotations est enveloppée dans une transaction (snapshot cohérent)."""
    job.status = ExportStatus.RUNNING
    job.error = ""
    job.save(update_fields=["status", "error"])

    try:
        # Export du gold (scope.gold) — voie dédiée (snapshot par phrase, pas par annotateur).
        if (job.scope or {}).get("gold"):
            from claire.gold.export import run_gold_export

            return run_gold_export(job)
        with transaction.atomic():
            records = [build_snapshot(a) for a in _selected_annotations(job)]

        out_dir = Path(settings.EXPORTS_DIR)
        out_dir.mkdir(parents=True, exist_ok=True)
        stamp = dt.datetime.now(dt.UTC).strftime("%Y%m%dT%H%M%S")

        # Format effectif : un format non implémenté retombe sur jsonl, et on TRACE
        # ce repli dans le manifeste (jamais de troncature/repli silencieux, ADR‑001 §F).
        requested = job.format
        warnings: list[str] = []
        if requested in _IMPLEMENTED_FORMATS:
            effective = requested
        else:
            effective = ExportFormat.JSONL
            warnings.append(
                f"format '{requested}' non implémenté → repli sur jsonl (pivot CONTRACT §4)"
            )

        ext_by_format = {
            ExportFormat.CSV: "csv",
            "iaa_matrix": "csv",
            ExportFormat.MD: "md",
            ExportFormat.CONLL: "conll",
            ExportFormat.XML: "xml",
        }
        ext = ext_by_format.get(effective, "jsonl")
        fname = f"export_{job.project.slug}_{job.id}_{stamp}.{ext}"
        path = out_dir / fname

        if effective == ExportFormat.CSV:
            _write_csv(path, records)
        elif effective == ExportFormat.MD:
            _write_md(path, records)
        elif effective == ExportFormat.CONLL:
            _write_conll(path, records)
        elif effective == ExportFormat.XML:
            _write_xml(path, records)
        elif effective == "iaa_matrix":
            _write_iaa_matrix(path, job.project)
        else:
            _write_jsonl(path, records)

        manifest = {
            "project": job.project.slug,
            "format_requested": requested,
            "format_effective": effective,
            "warnings": warnings,
            "scope": job.scope,
            "n_annotations": len(records),
            "n_clauses": sum(len(r["clauses"]) for r in records),
            "annotators": sorted({r["annotator"] for r in records}),
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
        # Statut écrit en autocommit (hors transaction de lecture) → PERSISTE.
        job.status = ExportStatus.FAILED
        job.error = str(exc)[:2000]
        job.manifest = {"error": str(exc)}
        job.save(update_fields=["status", "error", "manifest"])
        logger.exception("export_failed job=%s", job.id)
    return job


def run_export_async(job_id: int) -> None:
    """Lance l'export EN TÂCHE DE FOND (thread daemon) — non bloquant pour la requête.

    `settings.EXPORTS_RUN_INLINE` (vrai en test) exécute en SYNCHRONE pour des tests
    déterministes (et évite les verrous SQLite liés au threading). En prod, un thread
    daemon exécute `run_export` avec une connexion DB propre (close_old_connections au
    début, connection.close à la fin). v2 : remplacer ce corps par `task.delay(job_id)`.
    """
    from django.db import close_old_connections, connection

    def _work() -> None:
        close_old_connections()
        try:
            job = ExportJob.objects.get(pk=job_id)
            run_export(job)
        except ExportJob.DoesNotExist:
            logger.warning("export_async_missing job=%s", job_id)
        except Exception:  # noqa: BLE001 — filet : marque failed même si run_export échoue tôt
            logger.exception("export_async_crash job=%s", job_id)
            ExportJob.objects.filter(
                pk=job_id, status__in=[ExportStatus.PENDING, ExportStatus.RUNNING]
            ).update(status=ExportStatus.FAILED, error="Échec inattendu de la tâche d'export.")
        finally:
            connection.close()

    if getattr(settings, "EXPORTS_RUN_INLINE", False):
        _work()
        return
    import threading

    threading.Thread(target=_work, name=f"export-{job_id}", daemon=True).start()

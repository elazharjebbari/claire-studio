"""Rendu PDF privé et reproductible des rapports Analysis Lab."""

from __future__ import annotations

import hashlib
import logging
import os
import threading
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.db import close_old_connections, connection
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from .models import AnalysisReportArtifact, ArtifactStatus

logger = logging.getLogger("claire.analysis")
NAVY = colors.HexColor("#102A43")
GOLD = colors.HexColor("#B58B35")
PALE = colors.HexColor("#F4F7FA")
INK_MUTED = colors.HexColor("#526777")


def _styles():
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="PactivaTitle", parent=styles["Title"], textColor=NAVY, fontSize=22, leading=27
        )
    )
    styles.add(
        ParagraphStyle(
            name="PactivaH2",
            parent=styles["Heading2"],
            textColor=NAVY,
            fontSize=14,
            leading=18,
            spaceBefore=10,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="PactivaSmall",
            parent=styles["BodyText"],
            textColor=INK_MUTED,
            fontSize=8.5,
            leading=11,
        )
    )
    styles.add(
        ParagraphStyle(name="PactivaRight", parent=styles["PactivaSmall"], alignment=TA_RIGHT)
    )
    return styles


def _percent(value):
    return "-" if value is None else f"{value * 100:.1f} %"


def _header_footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(GOLD)
    canvas.setLineWidth(0.8)
    canvas.line(18 * mm, 282 * mm, 192 * mm, 282 * mm)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(INK_MUTED)
    canvas.drawString(18 * mm, 12 * mm, "Pactiva Analysis Lab - rapport reproductible")
    canvas.drawRightString(192 * mm, 12 * mm, f"Page {doc.page}")
    canvas.restoreState()


def render_report_artifact(artifact_id) -> AnalysisReportArtifact:
    artifact = AnalysisReportArtifact.objects.select_related(
        "report", "report__snapshot", "report__project", "requested_by"
    ).get(pk=artifact_id)
    if artifact.status == ArtifactStatus.READY:
        return artifact
    artifact.status = ArtifactStatus.RUNNING
    artifact.error_detail = ""
    artifact.save(update_fields=["status", "error_detail"])
    try:
        report = artifact.report
        out_dir = Path(settings.ANALYSIS_ARTIFACTS_DIR) / str(report.project_id) / str(report.id)
        out_dir.mkdir(parents=True, exist_ok=True)
        path = out_dir / f"pactiva-analysis-{artifact.id}.pdf"
        styles = _styles()
        story = [
            Spacer(1, 10 * mm),
            Paragraph("Pactiva Analysis Lab", styles["PactivaTitle"]),
            Paragraph(report.title, styles["Heading1"]),
            Paragraph(
                f"Capture du {report.snapshot.created_at:%d/%m/%Y %H:%M} - "
                f"empreinte {report.snapshot.fingerprint[:16]}",
                styles["PactivaSmall"],
            ),
            Spacer(1, 8 * mm),
        ]
        overview = report.payload.get("overview", {})
        kpis = [
            ["Documents", "Annotations", "Brouillons", "Couverture"],
            [
                str(overview.get("documents", 0)),
                str(overview.get("annotations", 0)),
                str(overview.get("draftAnnotations", 0)),
                _percent(overview.get("coverageRate")),
            ],
        ]
        table = Table(kpis, colWidths=[43 * mm] * 4, rowHeights=[9 * mm, 14 * mm])
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("BACKGROUND", (0, 1), (-1, 1), PALE),
                    ("TEXTCOLOR", (0, 1), (-1, 1), NAVY),
                    ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 1), (-1, 1), 16),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#D8E0E7")),
                ]
            )
        )
        story.extend([table, Spacer(1, 6 * mm)])
        if overview.get("draftAnnotations", 0):
            story.extend(
                [
                    Paragraph("Précaution d'interprétation", styles["PactivaH2"]),
                    Paragraph(
                        "Ce rapport inclut des annotations non publiées. Il décrit un état "
                        "provisoire figé et ne constitue pas une évaluation définitive.",
                        styles["BodyText"],
                    ),
                ]
            )
        profiles = report.payload.get("actor_profiles", {}).get("actors", [])
        if profiles:
            rows = [["Acteur", "Affectés", "Brouillons", "Clauses", "Couverture", "Validation"]]
            rows.extend(
                [
                    row.get("pseudonym", "-"),
                    row.get("assignedDocuments", 0),
                    row.get("draftAnnotations", 0),
                    row.get("clauses", 0),
                    _percent(row.get("coverageRate")),
                    _percent(row.get("validationRate")),
                ]
                for row in profiles
            )
            story.extend(
                [
                    Paragraph("Profils pseudonymisés", styles["PactivaH2"]),
                    Table(
                        rows,
                        repeatRows=1,
                        colWidths=[34 * mm, 25 * mm, 27 * mm, 22 * mm, 31 * mm, 31 * mm],
                        style=[
                            ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#CCD6DF")),
                            ("FONTSIZE", (0, 0), (-1, -1), 8),
                            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ],
                    ),
                ]
            )
        pairwise = report.payload.get("pairwise_agreement", {})
        if pairwise.get("pairs"):
            story.extend([PageBreak(), Paragraph("Accords multi-annotations", styles["PactivaH2"])])
            rows = [["Mode", "Acteur A", "Acteur B", "Support", "Accord", "Kappa", "F1 frontières"]]
            for row in pairwise["pairs"]:
                rows.append(
                    [
                        row["mode"],
                        row["actorA"],
                        row["actorB"],
                        row["support"],
                        _percent(row["rawAgreement"]),
                        f"{row['cohenKappa']:.3f}",
                        f"{row['boundaryF1']:.3f}",
                    ]
                )
            story.append(
                Table(
                    rows,
                    repeatRows=1,
                    colWidths=[24 * mm, 28 * mm, 28 * mm, 18 * mm, 23 * mm, 22 * mm, 27 * mm],
                    style=[
                        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#CCD6DF")),
                        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
                    ],
                )
            )
        story.extend(
            [
                Spacer(1, 8 * mm),
                KeepTogether(
                    [
                        Paragraph("Manifeste", styles["PactivaH2"]),
                        Paragraph(
                            "Les calculs utilisent exclusivement le snapshot indiqué. "
                            f"Métriques : {', '.join(report.configuration.get('metricCodes', []))}. "
                            "Les identités sont pseudonymisées et aucun texte contractuel n'est inclus.",
                            styles["PactivaSmall"],
                        ),
                    ]
                ),
            ]
        )
        doc = SimpleDocTemplate(
            str(path),
            pagesize=A4,
            rightMargin=18 * mm,
            leftMargin=18 * mm,
            topMargin=20 * mm,
            bottomMargin=20 * mm,
            title=report.title,
            author="Pactiva Analysis Lab",
        )
        doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)
        raw = path.read_bytes()
        artifact.file_path = str(path)
        artifact.checksum = hashlib.sha256(raw).hexdigest()
        artifact.size_bytes = len(raw)
        artifact.status = ArtifactStatus.READY
        artifact.completed_at = timezone.now()
        artifact.manifest = {
            "renderer": "reportlab",
            "rendererVersion": "1",
            "reportId": str(report.id),
            "snapshotFingerprint": report.snapshot.fingerprint,
            "metricVersions": report.configuration.get("metricVersions", {}),
        }
        artifact.save(
            update_fields=[
                "file_path",
                "checksum",
                "size_bytes",
                "status",
                "completed_at",
                "manifest",
            ]
        )
    except Exception as exc:
        artifact.status = ArtifactStatus.FAILED
        artifact.error_detail = str(exc)[:500]
        artifact.completed_at = timezone.now()
        artifact.save(update_fields=["status", "error_detail", "completed_at"])
        logger.exception("analysis_pdf_failed artifact=%s", artifact.id)
        raise
    return artifact


def create_report_artifact(report, user):
    existing = (
        report.artifacts.filter(
            requested_by=user,
            status__in=[ArtifactStatus.QUEUED, ArtifactStatus.RUNNING, ArtifactStatus.READY],
            expires_at__gt=timezone.now(),
        )
        .order_by("-created_at")
        .first()
    )
    if existing and (existing.status != ArtifactStatus.READY or os.path.isfile(existing.file_path)):
        return existing
    expires = timezone.now() + timedelta(days=settings.ANALYSIS_REPORT_RETENTION_DAYS)
    return AnalysisReportArtifact.objects.create(
        report=report, requested_by=user, expires_at=expires
    )


def dispatch_artifact(artifact_id):
    mode = settings.ANALYSIS_DISPATCH_MODE
    if mode == "inline":
        render_report_artifact(artifact_id)
        return
    if mode == "worker":
        return

    def _work():
        close_old_connections()
        try:
            render_report_artifact(artifact_id)
        except Exception:  # noqa: BLE001
            logger.exception("analysis_pdf_dispatch_crash artifact=%s", artifact_id)
        finally:
            connection.close()

    threading.Thread(target=_work, name=f"analysis-pdf-{artifact_id}", daemon=True).start()


def safe_artifact_path(artifact) -> str | None:
    root = os.path.realpath(str(settings.ANALYSIS_ARTIFACTS_DIR))
    path = os.path.realpath(artifact.file_path)
    if os.path.commonpath([root, path]) != root or not os.path.isfile(path):
        return None
    return path

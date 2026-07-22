"""Worker durable adossé à PostgreSQL pour les runs et artefacts Analysis Lab."""

import time
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from claire.analysis.models import (
    AnalysisReportArtifact,
    AnalysisRun,
    ArtifactStatus,
    RunStatus,
)
from claire.analysis.reports import render_report_artifact
from claire.analysis.services import run_analysis


class Command(BaseCommand):
    help = "Exécute les jobs Analysis Lab persistés en base."

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true")
        parser.add_argument("--poll", type=float, default=1.0)

    def handle(self, *args, **options):
        while True:
            timeout = timezone.now() - timedelta(seconds=settings.ANALYSIS_RUN_TIMEOUT_SECONDS)
            AnalysisRun.objects.filter(status=RunStatus.RUNNING, heartbeat_at__lt=timeout).update(
                status=RunStatus.FAILED,
                error_code="worker_timeout",
                error_detail="Le worker a cessé d'émettre son heartbeat.",
                completed_at=timezone.now(),
            )
            run_id = (
                AnalysisRun.objects.filter(status=RunStatus.QUEUED)
                .order_by("created_at")
                .values_list("id", flat=True)
                .first()
            )
            if run_id:
                run_analysis(run_id)
            artifact_id = (
                AnalysisReportArtifact.objects.filter(status=ArtifactStatus.QUEUED)
                .order_by("created_at")
                .values_list("id", flat=True)
                .first()
            )
            if artifact_id:
                render_report_artifact(artifact_id)
            if options["once"]:
                return
            if not run_id and not artifact_id:
                time.sleep(max(0.1, options["poll"]))

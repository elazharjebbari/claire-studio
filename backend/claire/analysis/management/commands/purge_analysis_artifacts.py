"""Expire et supprime les fichiers PDF au-delà de leur rétention."""

from pathlib import Path

from django.core.management.base import BaseCommand
from django.utils import timezone

from claire.analysis.models import AnalysisReportArtifact, ArtifactStatus
from claire.analysis.reports import safe_artifact_path


class Command(BaseCommand):
    help = "Supprime les PDF Analysis Lab expirés en conservant leur manifeste DB."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        queryset = AnalysisReportArtifact.objects.filter(
            expires_at__lte=timezone.now(), status=ArtifactStatus.READY
        )
        count = 0
        for artifact in queryset.iterator():
            path = safe_artifact_path(artifact)
            if path and not options["dry_run"]:
                Path(path).unlink(missing_ok=True)
            if not options["dry_run"]:
                artifact.status = ArtifactStatus.EXPIRED
                artifact.file_path = ""
                artifact.save(update_fields=["status", "file_path"])
            count += 1
        self.stdout.write(
            f"{count} artefact(s) {'détecté(s)' if options['dry_run'] else 'expiré(s)'}."
        )

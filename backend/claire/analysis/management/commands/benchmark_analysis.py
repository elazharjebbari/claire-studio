"""Micro-benchmark reproductible des calculators purs sur un snapshot existant."""

import time

from django.core.management.base import BaseCommand, CommandError

from claire.analysis.metrics import registry
from claire.analysis.models import AnalysisSnapshot


class Command(BaseCommand):
    help = "Mesure les métriques Analysis Lab sans créer de run."

    def add_arguments(self, parser):
        parser.add_argument("snapshot_id")
        parser.add_argument("--repeat", type=int, default=3)

    def handle(self, *args, **options):
        try:
            snapshot = AnalysisSnapshot.objects.get(pk=options["snapshot_id"])
        except (AnalysisSnapshot.DoesNotExist, ValueError) as exc:
            raise CommandError("Snapshot introuvable.") from exc
        repeat = max(1, options["repeat"])
        for metric in registry.definitions():
            durations = []
            for _ in range(repeat):
                started = time.perf_counter()
                metric.calculator(snapshot.payload)
                durations.append((time.perf_counter() - started) * 1000)
            self.stdout.write(
                f"{metric.code}.v{metric.version}: "
                f"mean={sum(durations) / len(durations):.2f}ms max={max(durations):.2f}ms"
            )

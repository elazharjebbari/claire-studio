"""Worker du Lab — exécute les runs en file.

    manage.py lab_worker            # boucle continue (service systemd)
    manage.py lab_worker --once     # un seul run, pour les tests et le débogage
"""

from __future__ import annotations

from django.core.management.base import BaseCommand

from claire.lab.worker import loop, run_once


class Command(BaseCommand):
    help = "Traite les runs du Lab en attente."

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true", help="traite un seul run")
        parser.add_argument("--interval", type=float, default=5.0)
        parser.add_argument("--max-iterations", type=int, default=None)

    def handle(self, *args, **options):
        if options["once"]:
            done = run_once()
            self.stdout.write(
                self.style.SUCCESS("run traité") if done else "aucun run en attente"
            )
            return
        self.stdout.write("worker du Lab démarré (Ctrl-C pour arrêter)")
        loop(interval=options["interval"], max_iterations=options["max_iterations"])

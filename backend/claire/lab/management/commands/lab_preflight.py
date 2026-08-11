"""Rapport de préfiguration en ligne de commande.

Sert à deux choses : vérifier l'état réel de la campagne sans ouvrir l'UI (ce qui a
demandé des requêtes SQL manuelles pendant toute la préparation de l'article), et
comparer deux critères de maturité côte à côte pour mesurer ce que `complete` apporte
par rapport à `submitted`.

    manage.py lab_preflight --project campagne-pactiva --maturity complete
    manage.py lab_preflight --project campagne-pactiva --compare
"""

from __future__ import annotations

import json

from django.core.management.base import BaseCommand, CommandError

from claire.lab.preflight import preflight
from claire.lab.selectors import MATURITY_LEVELS
from claire.projects.models import Project


class Command(BaseCommand):
    help = "Simule la construction d'un jeu de données du Lab (ne crée rien)."

    def add_arguments(self, parser):
        parser.add_argument("--project", required=True, help="slug du projet")
        parser.add_argument(
            "--maturity", default="complete", choices=list(MATURITY_LEVELS),
            help="niveau de maturité exigé (défaut : complete)",
        )
        parser.add_argument("--k", type=int, default=5, help="nombre de plis visés")
        parser.add_argument(
            "--min-annotators", type=int, default=0,
            help="ne garder que les documents couverts par au moins N annotateurs retenus",
        )
        parser.add_argument(
            "--include-partial", action="store_true",
            help="ne pas écarter les annotations qui ne couvrent pas tout le document",
        )
        parser.add_argument(
            "--completeness", type=float, default=1.0,
            help=(
                "part de phrases validées exigée (défaut 1.0, strict). 0.98 récupère "
                "une annotation finie à un clic près (ex. 192/193) sans laisser passer "
                "un travail réellement inachevé."
            ),
        )
        parser.add_argument(
            "--compare", action="store_true",
            help="affiche les quatre niveaux de maturité côte à côte",
        )
        parser.add_argument("--json", action="store_true", help="sortie JSON brute")

    def handle(self, *args, **options):
        try:
            project = Project.objects.get(slug=options["project"])
        except Project.DoesNotExist as exc:
            raise CommandError(f"projet introuvable : {options['project']}") from exc

        scope = {
            "min_annotators": options["min_annotators"],
            "exclude_partial": not options["include_partial"],
            "completeness_threshold": options["completeness"],
        }

        if options["compare"]:
            self._compare(project, scope, options["k"])
            return

        report = preflight(
            project, maturity=options["maturity"], scope=scope, k=options["k"]
        )
        if options["json"]:
            self.stdout.write(json.dumps(report, indent=2, ensure_ascii=False))
            return
        self._render(report)

    # ------------------------------------------------------------------ #

    def _compare(self, project, scope, k):
        """Le tableau qui montre ce que `complete` récupère par rapport à `submitted`."""
        self.stdout.write(self.style.MIGRATE_HEADING("\nComparaison des maturités\n"))
        self.stdout.write(
            f"{'maturité':<12}{'annot.':>8}{'docs':>7}{'phrases':>10}{'≥2 ann.':>9}{'≥3 ann.':>9}"
        )
        self.stdout.write("-" * 55)
        for maturity in MATURITY_LEVELS:
            r = preflight(project, maturity=maturity, scope=scope, k=k)
            self.stdout.write(
                f"{maturity:<12}{r['n_annotations']:>8}{r['n_documents']:>7}"
                f"{r['n_sentences']:>10}{r['n_multi_annotated']:>9}{r['n_triple_annotated']:>9}"
            )
        self.stdout.write("")

    def _render(self, report):
        c = report["criteria"]
        self.stdout.write(
            self.style.MIGRATE_HEADING(
                f"\nPréfiguration — maturité « {c['maturity']} »\n"
            )
        )
        self.stdout.write(f"  annotations retenues : {report['n_annotations']}")
        self.stdout.write(f"  documents            : {report['n_documents']}")
        self.stdout.write(f"  phrases              : {report['n_sentences']}")
        self.stdout.write(
            f"  documents ≥2 annot.  : {report['n_multi_annotated']}"
            f"   (≥3 : {report['n_triple_annotated']})"
        )
        self.stdout.write(
            f"  répartition          : {report['documents_by_annotator_count']}"
        )
        self.stdout.write(f"  empreinte            : {report['would_fingerprint'][:16]}…")

        splits = report["splits_preview"]
        state = "possible" if splits["feasible"] else self.style.ERROR("IMPOSSIBLE")
        self.stdout.write(f"  GroupKFold({splits['k']})      : {state}")

        if report["excluded"]:
            self.stdout.write(
                self.style.WARNING(f"\n  Écartés ({len(report['excluded'])}) :")
            )
            for reason, count in sorted(report["excluded_summary"].items()):
                self.stdout.write(f"    {reason:<24} {count}")
            # Le détail des dix premiers suffit à comprendre ; au-delà, utiliser --json.
            for row in report["excluded"][:10]:
                self.stdout.write(
                    f"      {row['document']:<18}{row['annotator'] or '—':<16}{row['detail']}"
                )
            if len(report["excluded"]) > 10:
                self.stdout.write(f"      … et {len(report['excluded']) - 10} autres (--json)")

        if report["near_complete"]:
            self.stdout.write(
                self.style.WARNING(
                    f"\n  Retenues sous 100 % ({len(report['near_complete'])}) :"
                )
            )
            for row in report["near_complete"]:
                self.stdout.write(
                    f"      {row['document']:<18}{row['annotator']:<16}"
                    f"{100 * row['completeness']:.1f} %"
                )

        if report["rare_themes"]:
            self.stdout.write(
                self.style.WARNING(
                    f"\n  Thèmes rares ({len(report['rare_themes'])}) : "
                    + ", ".join(report["rare_themes"])
                )
            )

        for warning in report["warnings"]:
            self.stdout.write(self.style.WARNING(f"\n  ⚠ {warning['message']}"))
        self.stdout.write("")

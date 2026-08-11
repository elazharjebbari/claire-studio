"""Construit un jeu de données du Lab depuis la ligne de commande.

    manage.py lab_build_dataset --project campagne-pactiva --maturity complete \
        --completeness 0.98 --label "v1-complete"
"""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from claire.lab.selectors import MATURITY_LEVELS
from claire.lab.services import DuplicateDataset, build_dataset
from claire.projects.models import Project


class Command(BaseCommand):
    help = "Construit un jeu de données figé et signé pour le Lab."

    def add_arguments(self, parser):
        parser.add_argument("--project", required=True)
        parser.add_argument("--maturity", default="complete", choices=list(MATURITY_LEVELS))
        parser.add_argument(
            "--aggregation", default="consensus",
            choices=["single", "consensus", "soft"],
        )
        parser.add_argument("--label", default="")
        parser.add_argument("--k", type=int, default=5)
        parser.add_argument("--seed", type=int, default=42)
        parser.add_argument("--completeness", type=float, default=1.0)
        parser.add_argument("--min-annotators", type=int, default=0)
        parser.add_argument("--single-annotator", default=None)
        parser.add_argument("--user", default=None, help="propriétaire (défaut : 1er admin)")
        parser.add_argument("--force", action="store_true", help="ignore la déduplication")

    def handle(self, *args, **options):
        try:
            project = Project.objects.get(slug=options["project"])
        except Project.DoesNotExist as exc:
            raise CommandError(f"projet introuvable : {options['project']}") from exc

        User = get_user_model()
        user = (
            User.objects.filter(username=options["user"]).first()
            if options["user"]
            else User.objects.filter(is_superuser=True).first() or User.objects.first()
        )
        if user is None:
            raise CommandError("aucun utilisateur disponible pour porter le dataset")

        try:
            dataset = build_dataset(
                project=project,
                user=user,
                label=options["label"],
                maturity=options["maturity"],
                aggregation=options["aggregation"],
                scope={
                    "min_annotators": options["min_annotators"],
                    "exclude_partial": True,
                    "completeness_threshold": options["completeness"],
                },
                k=options["k"],
                seed=options["seed"],
                single_annotator=options["single_annotator"],
                force=options["force"],
            )
        except DuplicateDataset as exc:
            # Ne pas reconstruire : deux datasets identiques aux identifiants différents
            # rendraient les tableaux de l'article ambigus.
            self.stdout.write(
                self.style.WARNING(
                    f"Jeu de données identique déjà présent : {exc.dataset.id}\n"
                    f"  empreinte {exc.dataset.fingerprint[:16]}…  "
                    f"({exc.dataset.n_documents} documents)\n"
                    "  Utiliser --force pour en créer un nouveau malgré tout."
                )
            )
            return
        except ValueError as exc:
            raise CommandError(str(exc)) from exc

        manifest = dataset.manifest
        self.stdout.write(self.style.SUCCESS(f"\nJeu de données {dataset.id}"))
        self.stdout.write(f"  empreinte    : {dataset.fingerprint[:16]}…")
        self.stdout.write(f"  annotations  : {dataset.n_annotations}")
        self.stdout.write(f"  documents    : {dataset.n_documents}")
        self.stdout.write(f"  phrases      : {dataset.n_sentences}")
        self.stdout.write(f"  multi-label  : {manifest['multiLabelRate']:.1%}")
        self.stdout.write(f"  plis         : {dataset.splits['foldSizes']}")
        self.stdout.write(f"  stockage     : {dataset.storage_path}")
        if manifest["excluded"]:
            self.stdout.write(
                self.style.WARNING(f"  écartés      : {manifest['excludedSummary']}")
            )
        self.stdout.write("")

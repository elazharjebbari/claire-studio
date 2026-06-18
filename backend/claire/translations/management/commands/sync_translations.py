"""Re-synchronise les jeux de traduction file-based vers la base (feature F8).

Léger : ne ré-importe NI le corpus NI les pré-annotations (contrairement à feed_db).
Relit les fichiers `<external_id>.txt` de chaque TranslationSet et met à jour les
lignes `Translation` (idempotent).

    python manage.py sync_translations            # tous les jeux
    python manage.py sync_translations --lang fr  # jeux d'une langue
"""

from __future__ import annotations

from django.core.management.base import BaseCommand

from claire.translations.models import TranslationSet
from claire.translations.services import sync_translation_set


class Command(BaseCommand):
    help = "Re-synchronise les TranslationSet file-based vers la base."

    def add_arguments(self, parser):
        parser.add_argument("--lang", default=None, help="Filtrer par langue cible (ex. fr).")

    def handle(self, *args, **options):
        qs = TranslationSet.objects.all()
        if options["lang"]:
            qs = qs.filter(target_language=options["lang"])
        if not qs.exists():
            self.stdout.write(self.style.WARNING("Aucun TranslationSet à synchroniser."))
            return
        for ts in qs:
            res = sync_translation_set(ts)
            self.stdout.write(
                f"  {ts.name} ({ts.target_language}) → status={ts.status} "
                f"docs={res.get('documents', 0)} lignes={res.get('created', 0)}"
            )
        self.stdout.write(self.style.SUCCESS("sync_translations terminé."))

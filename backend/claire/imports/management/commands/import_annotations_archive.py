"""Importe l'ARCHIVE multi-versions d'annotations LLM (tout juge de la nomenclature).

Source : `data/annotations_archive/v<MAJ>[_<MIN>]_session<N>_<judge>/<Doc>_<judge>.json`
(ex. `v9_2_session1_claude/Instagram_claude.json`). La version est dérivée du dossier
(`v9_2` → `v9.2`) et stockée dans `PreAnnotation.schema_version` ; l'unicité
(project, document, judge, schema_version) fait coexister TOUTES les versions pour un
même (doc, juge) → on peut ensuite CHOISIR la version à afficher.

Tolérant : chaque fichier est normalisé selon sa famille (document_plan.segments /
plan.clauses). Les champs en moins → vides ; les champs en plus → conservés dans `raw`.
Idempotent (upsert par clé).

    python manage.py import_annotations_archive [--source DIR] [--project SLUG]
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from claire.imports.models import Judge
from claire.imports.services import ingest_preannotation
from claire.projects.models import Project

# Le nom de juge n'est PAS énuméré ici (sinon une session d'un nouveau juge — fable… —
# serait silencieusement ignorée) : on capture le suffixe et on le confronte à la
# nomenclature `Judge` ; un juge hors nomenclature (ex. gemini) retombe sur `other`.
FOLDER_RE = re.compile(r"^(v\d+(?:_\d+)?)_session\d+_([a-z0-9][a-z0-9._-]*)$")


class Command(BaseCommand):
    help = "Importe l'archive multi-versions d'annotations LLM."

    def add_arguments(self, parser):
        parser.add_argument(
            "--source",
            default=str(settings.DATA_DIR / "annotations_archive"),
            help="Dossier racine de l'archive (défaut: data/annotations_archive).",
        )
        parser.add_argument("--project", default="claudette-gold-v1")

    def handle(self, *args, **options):
        src = Path(options["source"])
        project = (
            Project.objects.filter(slug=options["project"]).first()
            or Project.objects.first()
        )
        if not src.is_dir():
            self.stderr.write(self.style.ERROR(f"Source introuvable: {src}"))
            return
        if project is None:
            self.stderr.write(self.style.ERROR("Aucun projet (lancez feed_db)."))
            return

        docs = {d.external_id: d for d in project.corpus.documents.all()}
        counts: dict[tuple[str, str], int] = {}
        skipped = 0

        for folder in sorted(p for p in src.iterdir() if p.is_dir()):
            m = FOLDER_RE.match(folder.name)
            if not m:
                continue
            version = m.group(1).replace("_", ".")  # v9_2 -> v9.2
            judge_raw = m.group(2)
            judge = judge_raw if judge_raw in Judge.values else Judge.OTHER.value

            for f in sorted(folder.glob("*.json")):
                stem = f.stem
                suffix = f"_{judge_raw}"
                external_id = stem[: -len(suffix)] if stem.endswith(suffix) else stem
                doc = docs.get(external_id)
                if doc is None:
                    continue
                try:
                    raw = json.loads(f.read_text(encoding="utf-8"))
                    ingest_preannotation(project, doc, judge, raw, version=version)
                    counts[(version, judge)] = counts.get((version, judge), 0) + 1
                except Exception as exc:  # tolérant : on saute le fichier illisible
                    skipped += 1
                    self.stderr.write(f"  skip {folder.name}/{f.name}: {exc}")

        self.stdout.write("Archive multi-versions importée :")
        for (version, judge), c in sorted(counts.items()):
            self.stdout.write(f"  {version:<6} {judge:<7}: {c} docs")
        if skipped:
            self.stdout.write(self.style.WARNING(f"  {skipped} fichier(s) ignoré(s)"))
        self.stdout.write(self.style.SUCCESS("import_annotations_archive terminé."))

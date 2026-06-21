"""Importe les pré-annotations LLM (Claude/Codex) depuis ``data/preannotations``.

Pour chaque document du corpus du projet, lit
``<dir>/<judge>/<external_id>_<judge>.json`` et appelle ``ingest_preannotation``
(idempotent : upsert par (project, document, judge, version)). Sert à peupler la
prod pour que les annotateurs puissent pré-remplir / comparer les segments LLM.

Exemple :
    manage.py import_preannotations --project campagne-pactiva
"""

from __future__ import annotations

import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from claire.imports.services import ingest_preannotation
from claire.projects.models import Project


class Command(BaseCommand):
    help = "Importe les pré-annotations LLM (claude/codex) depuis data/preannotations."

    def add_arguments(self, parser):
        parser.add_argument("--project", required=True, help="slug du projet/campagne")
        parser.add_argument(
            "--dir",
            default=None,
            help="racine des pré-annotations (déf. : <repo>/data/preannotations)",
        )
        parser.add_argument(
            "--judges",
            default="claude,codex",
            help="juges à importer, séparés par des virgules",
        )

    def handle(self, *args, **opts):
        try:
            project = Project.objects.select_related("corpus").get(slug=opts["project"])
        except Project.DoesNotExist as exc:
            raise CommandError(f"Projet introuvable : {opts['project']}") from exc

        root = (
            Path(opts["dir"])
            if opts["dir"]
            else Path(settings.BASE_DIR).parent / "data" / "preannotations"
        )
        if not root.exists():
            raise CommandError(f"Dossier introuvable : {root}")

        judges = [j.strip() for j in opts["judges"].split(",") if j.strip()]
        documents = list(project.corpus.documents.all())
        imported = missing = errors = 0

        for judge in judges:
            jdir = root / judge
            for doc in documents:
                path = jdir / f"{doc.external_id}_{judge}.json"
                if not path.exists():
                    missing += 1
                    continue
                try:
                    raw = json.loads(path.read_text(encoding="utf-8"))
                    ingest_preannotation(
                        project=project, document=doc, judge=judge, raw=raw
                    )
                    imported += 1
                except Exception as exc:  # noqa: BLE001
                    errors += 1
                    self.stderr.write(self.style.WARNING(f"  ✗ {path.name}: {exc}"))

        self.stdout.write(
            self.style.SUCCESS(
                f"Pré-annotations : {imported} importées, {missing} fichiers absents, "
                f"{errors} erreurs (projet {project.slug}, {len(documents)} docs, "
                f"juges {judges})."
            )
        )

"""Idempotent import of a real CLAUDETTE-format corpus (feature 12).

Ingests a directory laid out as::

    <source>/
        Sentences/<Doc>.txt        # one tokenised sentence per line
        Labels_<CAT>/<Doc>.txt     # aligned unfairness levels (-1 / 1 / 2 / 3)

via the existing :func:`claire.corpora.loaders.load_claudette_document` loader,
which enforces INV-1 (contiguous sentence indices) inside an atomic
transaction. Re-running the command is safe: documents are matched by
``(corpus, external_id)`` and unchanged documents are skipped by the loader.

Usage::

    python manage.py import_claudette --source path/to/ToS

If ``--source`` is omitted, ``settings.CLAUDETTE_DIR`` is used. When the
directory (or its ``Sentences/`` subfolder) is absent, the command exits with a
clear, non-crashing message explaining where to obtain the archive
(http://claudette.eui.eu/ToS.zip).
"""

from __future__ import annotations

import logging
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from claire.corpora.loaders import list_available_documents, load_claudette_document
from claire.corpora.models import Corpus

logger = logging.getLogger("claire.corpora")


class Command(BaseCommand):
    help = "Import a real CLAUDETTE-format ToS corpus (idempotent)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--source",
            type=str,
            default=None,
            help=(
                "Path to a CLAUDETTE folder (containing Sentences/ and "
                "Labels_<CAT>/). Defaults to settings.CLAUDETTE_DIR."
            ),
        )
        parser.add_argument(
            "--corpus-slug",
            type=str,
            default="claudette-tos",
            help="Slug of the Corpus to populate (created if missing).",
        )
        parser.add_argument(
            "--corpus-name",
            type=str,
            default="CLAUDETTE ToS (UNFAIR-ToS)",
            help="Display name used when the corpus is created.",
        )
        parser.add_argument(
            "--max-docs",
            type=int,
            default=None,
            help="Optional cap on the number of documents to import.",
        )
        parser.add_argument(
            "--docs",
            nargs="*",
            default=None,
            help="Optional explicit list of document names (without .txt).",
        )

    def handle(self, *args, **options):
        source = Path(options["source"] or settings.CLAUDETTE_DIR)

        if not source.exists():
            raise CommandError(
                f"CLAUDETTE source directory not found: {source}\n"
                "Download and unzip http://claudette.eui.eu/ToS.zip, then pass "
                "--source <dir> or set CLAIRE_CLAUDETTE_DIR."
            )
        if not (source / "Sentences").is_dir():
            raise CommandError(
                f"No 'Sentences/' subfolder under {source}. Expected a CLAUDETTE "
                "layout (Sentences/<Doc>.txt + Labels_<CAT>/<Doc>.txt)."
            )

        available = list_available_documents(source)
        if not available:
            self.stdout.write(
                self.style.WARNING(
                    f"No *.txt documents found in {source / 'Sentences'}; nothing "
                    "to import."
                )
            )
            return

        requested = options["docs"]
        if requested:
            unknown = sorted(set(requested) - set(available))
            if unknown:
                raise CommandError(
                    f"Requested documents not present in source: {', '.join(unknown)}"
                )
            names = [n for n in available if n in set(requested)]
        else:
            names = available

        max_docs = options["max_docs"]
        if max_docs is not None:
            names = names[:max_docs]

        corpus, created = Corpus.objects.get_or_create(
            slug=options["corpus_slug"],
            defaults={
                "name": options["corpus_name"],
                "description": (
                    "Terms of Service with unfairness annotations (Lippi 2019)."
                ),
                "source_url": "http://claudette.eui.eu/ToS.zip",
                "license": "research",
                "default_language": "en",
            },
        )
        self.stdout.write(
            f"Corpus {'created' if created else 'reused'}: {corpus.slug}"
        )

        imported = 0
        skipped = 0
        failed: list[str] = []
        for name in names:
            try:
                load_claudette_document(corpus, source, name)
                imported += 1
            except ValueError as exc:
                # e.g. sentences referenced by clauses, or malformed alignment.
                skipped += 1
                failed.append(name)
                self.stderr.write(
                    self.style.WARNING(f"  skipped {name}: {exc}")
                )
                logger.warning("import_claudette_skip doc=%s reason=%s", name, exc)

        self.stdout.write(
            self.style.SUCCESS(
                f"Imported {imported} document(s) into '{corpus.slug}' "
                f"({skipped} skipped)."
            )
        )
        if failed:
            self.stdout.write("  skipped: " + ", ".join(failed))

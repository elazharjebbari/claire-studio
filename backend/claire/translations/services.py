"""Translation sync (feature 8) — file-based mapping.

A TranslationSet points at a folder. The sync reads per-document translation
files and maps them to documents/sentences. Two strategies:

- 'by_external_id': folder/<external_id>.txt with one line per sentence index
  (aligned like CLAUDETTE Sentences). Creates sentence-level Translation rows.
- 'document': folder/<external_id>.txt is a single document-level translation.
"""

from __future__ import annotations

import logging
from pathlib import Path

from django.db import transaction

from claire.corpora.models import Document

from .models import Translation, TranslationSet

logger = logging.getLogger("claire.translations")


@transaction.atomic
def sync_translation_set(translation_set: TranslationSet) -> dict:
    folder = Path(translation_set.folder_path)
    if not folder.exists():
        translation_set.status = "error:folder_missing"
        translation_set.save(update_fields=["status"])
        return {"created": 0, "documents": 0, "error": "folder_missing"}

    corpus = translation_set.corpus
    documents = {d.external_id: d for d in corpus.documents.all()}
    created = 0
    matched_docs = 0

    for path in sorted(folder.glob("*.txt")):
        external_id = path.stem
        document = documents.get(external_id)
        if document is None:
            continue
        matched_docs += 1
        lines = [
            ln for ln in path.read_text(encoding="utf-8").splitlines()
            if ln.strip() != ""
        ]
        # Clear prior translations for this set+document.
        Translation.objects.filter(
            translation_set=translation_set, document=document
        ).delete()

        if translation_set.mapping_strategy == "document":
            Translation.objects.create(
                translation_set=translation_set,
                document=document,
                sentence=None,
                text="\n".join(lines),
                provenance=f"file:{path.name}",
            )
            created += 1
        else:  # by_external_id, sentence-aligned
            sentences = {s.index: s for s in document.sentences.all()}
            rows = []
            for idx, text in enumerate(lines):
                sentence = sentences.get(idx)
                if sentence is None:
                    continue
                rows.append(
                    Translation(
                        translation_set=translation_set,
                        document=document,
                        sentence=sentence,
                        text=text.strip(),
                        provenance=f"file:{path.name}",
                    )
                )
            Translation.objects.bulk_create(rows)
            created += len(rows)

    translation_set.status = "synced"
    translation_set.save(update_fields=["status"])
    logger.info(
        "translations_synced set=%s documents=%d created=%d",
        translation_set.pk, matched_docs, created,
    )
    return {"created": created, "documents": matched_docs}

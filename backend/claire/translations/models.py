"""TranslationSet / Translation (CONTRACT §2) — feature 8 (file-based)."""

from django.db import models

from claire.common.models import TimeStampedModel
from claire.corpora.models import Corpus, Document, Sentence


class TranslationSet(TimeStampedModel):
    corpus = models.ForeignKey(
        Corpus, on_delete=models.CASCADE, related_name="translation_sets"
    )
    name = models.CharField(max_length=200)
    target_language = models.CharField(max_length=12)
    folder_path = models.CharField(max_length=500)
    mapping_strategy = models.CharField(max_length=60, default="by_external_id")
    status = models.CharField(max_length=40, default="declared")

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.name}->{self.target_language}"


class Translation(models.Model):
    translation_set = models.ForeignKey(
        TranslationSet, on_delete=models.CASCADE, related_name="translations"
    )
    document = models.ForeignKey(
        Document, on_delete=models.CASCADE, related_name="translations"
    )
    sentence = models.ForeignKey(
        Sentence, on_delete=models.CASCADE, null=True, blank=True,
        related_name="translations",
    )
    text = models.TextField()
    provenance = models.CharField(max_length=120, default="file")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["translation_set", "document", "sentence"],
                name="uniq_translation_set_doc_sentence",
            )
        ]
        ordering = ["translation_set", "document", "sentence"]

    def __str__(self) -> str:  # pragma: no cover
        return f"tr:{self.document_id}#{self.sentence_id}"

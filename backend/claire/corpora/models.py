"""Corpus / Document / Sentence / ReferenceLabel (CONTRACT §2).

Invariants:
- INV-1: Sentence.index unique per document, contiguous 0..n_sentences-1.
"""

from django.db import models

from claire.common.models import UNFAIRNESS_LEVELS, TimeStampedModel


class Corpus(TimeStampedModel):
    slug = models.SlugField(max_length=120, unique=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    source_url = models.URLField(blank=True)
    license = models.CharField(max_length=120, blank=True)
    default_language = models.CharField(max_length=12, default="en")

    class Meta:
        verbose_name_plural = "corpora"
        ordering = ["slug"]

    def __str__(self) -> str:  # pragma: no cover
        return self.slug


class Document(TimeStampedModel):
    corpus = models.ForeignKey(
        Corpus, on_delete=models.CASCADE, related_name="documents"
    )
    external_id = models.CharField(max_length=200)
    title = models.CharField(max_length=300)
    language = models.CharField(max_length=12, default="en")
    n_sentences = models.PositiveIntegerField(default=0)
    source_meta = models.JSONField(default=dict, blank=True)
    checksum = models.CharField(max_length=64, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["corpus", "external_id"], name="uniq_document_corpus_external"
            )
        ]
        ordering = ["corpus", "external_id"]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.corpus.slug}/{self.external_id}"

    def clauses_exist(self) -> bool:
        """True if any clause anchors a sentence of this document."""
        from claire.annotations.models import Clause

        return Clause.objects.filter(
            anchor_sentence__document=self
        ).exists()


class Sentence(models.Model):
    document = models.ForeignKey(
        Document, on_delete=models.CASCADE, related_name="sentences"
    )
    index = models.PositiveIntegerField()
    raw_text = models.TextField()
    clean_text = models.TextField(blank=True)
    char_start = models.PositiveIntegerField(null=True, blank=True)
    char_end = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        constraints = [
            # INV-1: index unique per document.
            models.UniqueConstraint(
                fields=["document", "index"], name="uniq_sentence_document_index"
            )
        ]
        ordering = ["document", "index"]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.document.external_id}#{self.index}"


class ReferenceLabel(models.Model):
    """Native CLAUDETTE unfairness label per sentence (feature 12)."""

    sentence = models.ForeignKey(
        Sentence, on_delete=models.CASCADE, related_name="reference_labels"
    )
    category = models.CharField(max_length=8)  # A|CH|CR|J|LAW|LTD|TER|USE|...
    level = models.PositiveSmallIntegerField(choices=UNFAIRNESS_LEVELS)
    source = models.CharField(max_length=60, default="claudette")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["sentence", "category"],
                name="uniq_reflabel_sentence_category",
            )
        ]
        ordering = ["sentence", "category"]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.sentence}:{self.category}={self.level}"

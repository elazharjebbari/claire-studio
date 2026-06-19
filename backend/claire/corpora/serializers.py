"""Corpora serializers — output shapes aligned with the frontend CONTRACT.

Field names match frontend/src/types/contract.ts exactly (after the global
camelCase render bridge converts snake_case -> camelCase):

- Corpus      -> {id, slug, name, description, sourceUrl, license,
                  defaultLanguage, documentCount}
- Sentence    -> {id, documentId, index, rawText, cleanText, charStart, charEnd}
- ReferenceLabel -> {id, sentenceId, sentenceIndex, category, level, source}
- DocumentDetail -> {id, corpusId, externalId, title, language, nSentences,
                     checksum, sentences[], referenceLabels[], sourceMeta}
"""

from rest_framework import serializers

from .models import Corpus, Document, ReferenceLabel, Sentence


class CorpusSerializer(serializers.ModelSerializer):
    document_count = serializers.IntegerField(
        source="documents.count", read_only=True
    )

    class Meta:
        model = Corpus
        fields = [
            "id", "slug", "name", "description", "source_url", "license",
            "default_language", "document_count",
        ]


class ReferenceLabelSerializer(serializers.ModelSerializer):
    sentence_id = serializers.PrimaryKeyRelatedField(
        source="sentence", read_only=True
    )
    sentence_index = serializers.IntegerField(
        source="sentence.index", read_only=True
    )

    class Meta:
        model = ReferenceLabel
        fields = ["id", "sentence_id", "sentence_index", "category", "level", "source"]


class SentenceSerializer(serializers.ModelSerializer):
    document_id = serializers.PrimaryKeyRelatedField(
        source="document", read_only=True
    )

    class Meta:
        model = Sentence
        fields = [
            "id", "document_id", "index", "raw_text", "clean_text",
            "char_start", "char_end",
        ]


class DocumentListSerializer(serializers.ModelSerializer):
    corpus_id = serializers.PrimaryKeyRelatedField(
        source="corpus", read_only=True
    )
    # Voyant « traduction disponible » (UI) — vrai si ≥ 1 traduction stockée.
    has_translation = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            "id", "corpus_id", "external_id", "title", "language",
            "n_sentences", "checksum", "has_translation",
        ]

    def get_has_translation(self, obj) -> bool:
        from claire.translations.models import Translation

        return Translation.objects.filter(document=obj).exists()


class DocumentDetailSerializer(serializers.ModelSerializer):
    corpus_id = serializers.PrimaryKeyRelatedField(
        source="corpus", read_only=True
    )
    sentences = SentenceSerializer(many=True, read_only=True)
    reference_labels = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            "id", "corpus_id", "external_id", "title", "language",
            "n_sentences", "checksum", "sentences", "reference_labels",
            "source_meta",
        ]

    def get_reference_labels(self, obj):
        """Flatten reference labels across the document's sentences.

        The frontend DocumentDetail exposes referenceLabels at the document
        level (each carrying sentenceId + sentenceIndex), not nested per
        sentence.
        """
        labels = []
        for sentence in obj.sentences.all():
            labels.extend(sentence.reference_labels.all())
        labels.sort(key=lambda rl: (rl.sentence.index, rl.category))
        return ReferenceLabelSerializer(labels, many=True).data

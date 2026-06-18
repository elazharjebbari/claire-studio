from rest_framework import serializers

from .models import Corpus, Document, ReferenceLabel, Sentence


class CorpusSerializer(serializers.ModelSerializer):
    n_documents = serializers.IntegerField(source="documents.count", read_only=True)

    class Meta:
        model = Corpus
        fields = [
            "id", "slug", "name", "description", "source_url", "license",
            "default_language", "n_documents",
        ]


class ReferenceLabelSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReferenceLabel
        fields = ["id", "category", "level", "source"]


class SentenceSerializer(serializers.ModelSerializer):
    reference_labels = ReferenceLabelSerializer(many=True, read_only=True)

    class Meta:
        model = Sentence
        fields = [
            "id", "index", "raw_text", "clean_text", "char_start", "char_end",
            "reference_labels",
        ]


class DocumentListSerializer(serializers.ModelSerializer):
    corpus = serializers.SlugRelatedField(slug_field="slug", read_only=True)

    class Meta:
        model = Document
        fields = [
            "id", "corpus", "external_id", "title", "language", "n_sentences",
        ]


class DocumentDetailSerializer(serializers.ModelSerializer):
    corpus = serializers.SlugRelatedField(slug_field="slug", read_only=True)
    sentences = SentenceSerializer(many=True, read_only=True)

    class Meta:
        model = Document
        fields = [
            "id", "corpus", "external_id", "title", "language", "n_sentences",
            "source_meta", "checksum", "sentences",
        ]

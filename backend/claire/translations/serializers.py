"""Translation serializers — CONTRACT-aligned shapes.

TranslationSet -> {id, corpusSlug, name, targetLanguage, folderPath,
                   mappingStrategy, status, mappedDocuments?, createdAt}

Write payload (endpoints.ts createTranslationSet) sends ``corpus`` (slug),
``name``, ``target_language``, ``folder_path``, ``mapping_strategy`` — the
camelCase parser normalises ``targetLanguage`` etc. to these snake keys.
"""

from django.conf import settings
from rest_framework import serializers

from claire.common.pathsafety import UnsafePathError, safe_join

from .models import Translation, TranslationSet


class TranslationSetSerializer(serializers.ModelSerializer):
    corpus_slug = serializers.SlugRelatedField(
        source="corpus", slug_field="slug", read_only=True
    )
    mapped_documents = serializers.SerializerMethodField()
    # Write-only input (admin declares a set): corpus slug.
    corpus = serializers.SlugField(write_only=True, required=False)

    class Meta:
        model = TranslationSet
        fields = [
            "id", "corpus_slug", "corpus", "name", "target_language",
            "folder_path", "mapping_strategy", "status", "mapped_documents",
            "created_at",
        ]
        read_only_fields = ["status", "created_at"]

    def get_mapped_documents(self, obj):
        return (
            obj.translations.values("document").distinct().count()
        )

    def validate_folder_path(self, value):
        """Confine declared folders under TRANSLATIONS_ROOT (A10, path-safety)."""
        try:
            safe_join(settings.TRANSLATIONS_ROOT, value)
        except UnsafePathError as exc:
            raise serializers.ValidationError(str(exc))
        return value

    def create(self, validated_data):
        from claire.corpora.models import Corpus

        corpus_slug = validated_data.pop("corpus", None)
        if corpus_slug:
            validated_data["corpus"] = Corpus.objects.get(slug=corpus_slug)
        return super().create(validated_data)


class TranslationSerializer(serializers.ModelSerializer):
    document_id = serializers.PrimaryKeyRelatedField(
        source="document", read_only=True
    )
    sentence_id = serializers.PrimaryKeyRelatedField(
        source="sentence", read_only=True
    )

    class Meta:
        model = Translation
        fields = ["id", "document_id", "sentence_id", "text", "provenance"]

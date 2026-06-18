from django.conf import settings
from rest_framework import serializers

from claire.common.pathsafety import UnsafePathError, safe_join

from .models import Translation, TranslationSet


class TranslationSetSerializer(serializers.ModelSerializer):
    corpus = serializers.SlugRelatedField(slug_field="slug", read_only=True)
    corpus_slug = serializers.SlugField(write_only=True, required=False)
    n_translations = serializers.IntegerField(
        source="translations.count", read_only=True
    )

    class Meta:
        model = TranslationSet
        fields = [
            "id", "corpus", "corpus_slug", "name", "target_language",
            "folder_path", "mapping_strategy", "status", "n_translations",
        ]
        read_only_fields = ["status"]

    def validate_folder_path(self, value):
        """Confine declared folders under TRANSLATIONS_ROOT (A10, path-safety)."""
        try:
            safe_join(settings.TRANSLATIONS_ROOT, value)
        except UnsafePathError as exc:
            raise serializers.ValidationError(str(exc))
        return value

    def create(self, validated_data):
        from claire.corpora.models import Corpus

        corpus_slug = validated_data.pop("corpus_slug", None)
        if corpus_slug:
            validated_data["corpus"] = Corpus.objects.get(slug=corpus_slug)
        return super().create(validated_data)


class TranslationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Translation
        fields = ["id", "document", "sentence", "text", "provenance"]

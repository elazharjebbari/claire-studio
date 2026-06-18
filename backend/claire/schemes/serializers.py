"""LabelScheme serializers — CONTRACT-aligned shapes.

- Theme       -> {id, schemeId, code, label, color, definition, examples, order}
- LegalNature -> {id, schemeId, code, label, definition, order}
- LabelScheme -> {id, slug, name, version, isActive, themes[], legalNatures[]}
"""

from rest_framework import serializers

from .models import LabelScheme, LegalNature, Theme


class ThemeSerializer(serializers.ModelSerializer):
    scheme_id = serializers.PrimaryKeyRelatedField(source="scheme", read_only=True)

    class Meta:
        model = Theme
        fields = [
            "id", "scheme_id", "code", "label", "color", "definition",
            "examples", "order",
        ]


class LegalNatureSerializer(serializers.ModelSerializer):
    scheme_id = serializers.PrimaryKeyRelatedField(source="scheme", read_only=True)

    class Meta:
        model = LegalNature
        fields = ["id", "scheme_id", "code", "label", "definition", "order"]


class LabelSchemeSerializer(serializers.ModelSerializer):
    themes = ThemeSerializer(many=True, read_only=True)
    legal_natures = LegalNatureSerializer(many=True, read_only=True)

    class Meta:
        model = LabelScheme
        fields = [
            "id", "slug", "name", "version", "is_active", "definition",
            "themes", "legal_natures",
        ]


class LabelSchemeListSerializer(serializers.ModelSerializer):
    class Meta:
        model = LabelScheme
        fields = ["id", "slug", "name", "version", "is_active"]

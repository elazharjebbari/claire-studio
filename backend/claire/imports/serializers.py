from rest_framework import serializers

from .models import PreAnnotation, PreClause


class PreClauseSerializer(serializers.ModelSerializer):
    class Meta:
        model = PreClause
        fields = ["id", "anchor_index", "theme_code", "evidence_span",
                  "rationale", "order"]


class PreAnnotationSerializer(serializers.ModelSerializer):
    document = serializers.SlugRelatedField(
        slug_field="external_id", read_only=True
    )
    project = serializers.SlugRelatedField(slug_field="slug", read_only=True)
    preclauses = PreClauseSerializer(many=True, read_only=True)

    class Meta:
        model = PreAnnotation
        fields = [
            "id", "project", "document", "judge", "schema_version",
            "mapped", "imported_at", "preclauses",
        ]

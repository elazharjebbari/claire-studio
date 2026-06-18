"""Pre-annotation serializers — CONTRACT-aligned shapes.

- PreClause     -> {anchorIndex, themeCode, evidenceSpan, rationale}
- PreAnnotation -> {id, projectSlug, documentId, judge, schemaVersion, mapped,
                    importedAt, clauses[]}
"""

from rest_framework import serializers

from .models import PreAnnotation, PreClause


class PreClauseSerializer(serializers.ModelSerializer):
    class Meta:
        model = PreClause
        fields = ["anchor_index", "theme_code", "evidence_span", "rationale"]


class PreAnnotationSerializer(serializers.ModelSerializer):
    project_slug = serializers.SlugRelatedField(
        source="project", slug_field="slug", read_only=True
    )
    document_id = serializers.PrimaryKeyRelatedField(
        source="document", read_only=True
    )
    clauses = PreClauseSerializer(source="preclauses", many=True, read_only=True)

    class Meta:
        model = PreAnnotation
        fields = [
            "id", "project_slug", "document_id", "judge", "schema_version",
            "mapped", "imported_at", "clauses",
        ]

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
    # Métadonnées riches lues depuis le JSON brut (v9.2) — explication globale du
    # juge + nombre de blocs estimé. Absentes en v9.4 → null.
    rationale_global = serializers.SerializerMethodField()
    estimated_n_blocks = serializers.SerializerMethodField()

    class Meta:
        model = PreAnnotation
        fields = [
            "id", "project_slug", "document_id", "judge", "schema_version",
            "mapped", "imported_at", "clauses",
            "rationale_global", "estimated_n_blocks",
        ]

    def _plan(self, obj) -> dict:
        raw = obj.raw if isinstance(obj.raw, dict) else {}
        plan = raw.get("document_plan") or raw.get("plan") or {}
        return plan if isinstance(plan, dict) else {}

    def get_rationale_global(self, obj):
        return self._plan(obj).get("rationale_global")

    def get_estimated_n_blocks(self, obj):
        return self._plan(obj).get("estimated_n_blocks")

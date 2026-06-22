"""Pre-annotation serializers — CONTRACT-aligned shapes.

- PreClause     -> {anchorIndex, themeCode, evidenceSpan, rationale}
- PreAnnotation -> {id, projectSlug, documentId, judge, schemaVersion, mapped,
                    importedAt, clauses[]}
"""

from rest_framework import serializers

from .models import PreAnnotation, PreClause
from .theme_mapping import normalize_theme_code


class PreClauseSerializer(serializers.ModelSerializer):
    # Code de thème NORMALISÉ vers le schéma fermé en sortie : les pré-annotations LLM
    # emploient parfois des codes legacy (THIRD_PARTY, PAYMENT_BILLING, LIABILITY_LIMITATION,
    # INDEMNIFICATION…) absents du schéma. Sans normalisation, le pré-remplissage crée des
    # clauses rejetées (400 « Theme not in scheme »). La BD conserve le code brut (audit).
    theme_code = serializers.SerializerMethodField()

    class Meta:
        model = PreClause
        # `legal_nature` : nature juridique proposée par le juge (consultation LLM, axe 2/3b).
        fields = [
            "anchor_index", "theme_code", "evidence_span", "rationale", "legal_nature",
        ]

    def get_theme_code(self, obj) -> str:
        return normalize_theme_code(obj.theme_code)


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

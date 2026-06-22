"""Annotation / Clause / AnnotationVersion serializers.

Output shapes match frontend/src/types/contract.ts exactly (after the camelCase
render bridge):

- Clause     -> {id, annotationId, anchorIndex, theme, legalNature,
                 evidenceSpan, rationale, certainty, order}
- Annotation -> {id, projectSlug, documentId, annotatorId, status,
                 globalCertainty, source, clauses[], createdAt, updatedAt}
- AnnotationVersion -> {id, annotationId, number, authorId, label,
                        createdAt, snapshot}

Write path: clause writes accept ``anchor_index``, ``theme``, ``legal_nature``
(the camel-case parser normalises incoming ``anchorIndex``/``legalNature`` to
these snake_case keys; bare snake keys from endpoints.ts pass through unchanged).
``theme``/``legal_nature`` carry the scheme *code* on write, the code string on
read (CONTRACT §4 — vocab is a closed code set).
"""

from rest_framework import serializers

from claire.corpora.models import Sentence
from claire.schemes.models import LegalNature, Theme

from .models import Annotation, AnnotationVersion, Clause


class ClauseSerializer(serializers.ModelSerializer):
    # Write-only inputs (frontend sends theme/legalNature codes + anchorIndex).
    theme = serializers.CharField(write_only=True, required=False)
    legal_nature = serializers.CharField(
        write_only=True, required=False, allow_null=True
    )
    anchor_index = serializers.IntegerField(required=False)

    class Meta:
        model = Clause
        # Read output is produced by to_representation() below (contract shape).
        # These are the *write* inputs (+ certainty/evidence/rationale/order).
        fields = [
            "id", "anchor_index", "theme", "legal_nature",
            "evidence_span", "rationale", "certainty", "order", "validated",
        ]

    def to_representation(self, instance):
        """Expose contract field names: anchorIndex, theme, themes[], boundary, ...

        Rétro-compatible : `theme` (scalaire) reste le thème PRIMAIRE. `themes` (liste
        multi-label) provient de `theme_tags` ; à défaut (clause sans tag, transitoire),
        repli sur le primaire scalaire.
        """
        tags = list(instance.theme_tags.all())
        if tags:
            themes = [
                {"label": t.theme.code, "role": t.role, "support": t.support}
                for t in tags
            ]
        else:  # repli mono (clause non encore taguée)
            themes = [{"label": instance.theme.code, "role": "primary", "support": 0}]
        return {
            "id": instance.id,
            "annotation_id": instance.annotation_id,
            "anchor_index": instance.anchor_sentence.index,
            "theme": instance.theme.code,  # miroir du primaire (legacy)
            "themes": themes,
            "boundary": {
                "type": instance.boundary_type,
                "support": instance.boundary_support,
            },
            "triage_level": instance.triage_level or None,
            "legal_nature": (
                instance.legal_nature.code if instance.legal_nature else None
            ),
            "evidence_span": instance.evidence_span,
            "rationale": instance.rationale,
            "certainty": instance.certainty,
            "order": instance.order,
            "validated": instance.validated,
        }

    def _resolve(self, annotation, attrs):
        """Resolve codes/indices to FK objects and enforce INV-2/INV-3."""
        scheme = annotation.project.scheme
        document = annotation.document

        anchor_index = attrs.pop("anchor_index", None)
        theme_code = attrs.pop("theme", None)
        legal_nature_code = attrs.pop("legal_nature", None)

        if anchor_index is not None:
            try:
                attrs["anchor_sentence"] = document.sentences.get(index=anchor_index)
            except Sentence.DoesNotExist:
                raise serializers.ValidationError(
                    {"anchor_index": f"No sentence #{anchor_index} in document."}
                )
        if theme_code is not None:
            try:
                attrs["theme"] = scheme.themes.get(code=theme_code)
            except Theme.DoesNotExist:
                raise serializers.ValidationError(
                    {"theme": f"Theme '{theme_code}' not in scheme "
                              f"{scheme.slug}."}
                )
        if legal_nature_code:
            try:
                attrs["legal_nature"] = scheme.legal_natures.get(
                    code=legal_nature_code
                )
            except LegalNature.DoesNotExist:
                raise serializers.ValidationError(
                    {"legal_nature": f"Legal nature '{legal_nature_code}' "
                                     f"not in scheme."}
                )
        elif legal_nature_code is None and "legal_nature" in self.initial_data:
            attrs["legal_nature"] = None
        return attrs

    def validate_certainty(self, value):
        if value is not None and value not in (0, 1, 2, 3):
            raise serializers.ValidationError("certainty must be in {0,1,2,3}.")
        return value


class AnnotationListSerializer(serializers.ModelSerializer):
    project_slug = serializers.SlugRelatedField(
        source="project", slug_field="slug", read_only=True
    )
    document_id = serializers.PrimaryKeyRelatedField(
        source="document", read_only=True
    )
    annotator_id = serializers.PrimaryKeyRelatedField(
        source="annotator", read_only=True
    )
    n_clauses = serializers.SerializerMethodField()

    def get_n_clauses(self, obj) -> int:
        # Prefer the annotated aggregate (set by the list queryset) to avoid an
        # extra COUNT query per row (N+1, M9 perf audit); fall back otherwise.
        agg = getattr(obj, "n_clauses_agg", None)
        if agg is not None:
            return agg
        return obj.clauses.count()

    class Meta:
        model = Annotation
        fields = [
            "id", "project_slug", "document_id", "annotator_id", "status",
            "global_certainty", "source", "n_clauses", "created_at",
            "updated_at",
        ]


class AnnotationDetailSerializer(AnnotationListSerializer):
    clauses = ClauseSerializer(many=True, read_only=True)

    class Meta(AnnotationListSerializer.Meta):
        fields = AnnotationListSerializer.Meta.fields + ["clauses"]


class AnnotationWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Annotation
        fields = ["status", "global_certainty"]

    def validate_global_certainty(self, value):
        if value is not None and value not in (0, 1, 2, 3):
            raise serializers.ValidationError("global_certainty in {0,1,2,3}.")
        return value


class AnnotationVersionSerializer(serializers.ModelSerializer):
    annotation_id = serializers.PrimaryKeyRelatedField(
        source="annotation", read_only=True
    )
    author_id = serializers.PrimaryKeyRelatedField(
        source="author", read_only=True
    )

    class Meta:
        model = AnnotationVersion
        fields = [
            "id", "annotation_id", "number", "label", "author_id",
            "created_at", "snapshot",
        ]

from rest_framework import serializers

from claire.corpora.models import Sentence
from claire.schemes.models import LegalNature, Theme

from .models import Annotation, AnnotationVersion, Clause


class ClauseSerializer(serializers.ModelSerializer):
    theme_code = serializers.CharField(write_only=True, required=False)
    legal_nature_code = serializers.CharField(
        write_only=True, required=False, allow_null=True
    )
    anchor_index = serializers.IntegerField(write_only=True, required=False)
    # read-only friendly fields
    theme = serializers.SlugRelatedField(slug_field="code", read_only=True)
    legal_nature = serializers.SlugRelatedField(
        slug_field="code", read_only=True
    )
    anchor = serializers.IntegerField(
        source="anchor_sentence.index", read_only=True
    )

    class Meta:
        model = Clause
        fields = [
            "id", "anchor", "anchor_index", "theme", "theme_code",
            "legal_nature", "legal_nature_code", "evidence_span",
            "rationale", "certainty", "order",
        ]

    def _resolve(self, annotation, attrs):
        """Resolve codes/indices to FK objects and enforce INV-2/INV-3."""
        scheme = annotation.project.scheme
        document = annotation.document

        anchor_index = attrs.pop("anchor_index", None)
        theme_code = attrs.pop("theme_code", None)
        legal_nature_code = attrs.pop("legal_nature_code", None)

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
                    {"theme_code": f"Theme '{theme_code}' not in scheme "
                                   f"{scheme.slug}."}
                )
        if legal_nature_code:
            try:
                attrs["legal_nature"] = scheme.legal_natures.get(
                    code=legal_nature_code
                )
            except LegalNature.DoesNotExist:
                raise serializers.ValidationError(
                    {"legal_nature_code": f"Legal nature '{legal_nature_code}' "
                                          f"not in scheme."}
                )
        elif legal_nature_code is None and "legal_nature_code" in self.initial_data:
            attrs["legal_nature"] = None
        return attrs

    def validate_certainty(self, value):
        if value is not None and value not in (0, 1, 2, 3):
            raise serializers.ValidationError("certainty must be in {0,1,2,3}.")
        return value


class AnnotationListSerializer(serializers.ModelSerializer):
    document = serializers.SlugRelatedField(
        slug_field="external_id", read_only=True
    )
    project = serializers.SlugRelatedField(slug_field="slug", read_only=True)
    annotator = serializers.SlugRelatedField(slug_field="username", read_only=True)
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
            "id", "project", "document", "annotator", "status",
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
    author = serializers.SlugRelatedField(slug_field="username", read_only=True)

    class Meta:
        model = AnnotationVersion
        fields = ["id", "number", "label", "author", "created_at", "snapshot"]

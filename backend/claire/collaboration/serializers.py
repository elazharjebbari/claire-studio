"""Comment / Review serializers — CONTRACT-aligned shapes.

- Comment -> {id, annotationId, clauseId, sentenceIndex, authorId, body,
              threadRoot, resolved, createdAt}
- Review  -> {id, annotationId, reviewerId, score, decision, rubric, body,
              createdAt}

Write payloads (endpoints.ts): comments accept ``body``, ``clause`` (clause id),
``sentence_index`` and ``thread_root`` — the camelCase parser normalises
``sentenceIndex``/``threadRoot`` to these snake keys. ``build_comment_kwargs``
resolves ``sentence_index`` (relative to the annotation's document) to a
Sentence FK for the view.
"""

from rest_framework import serializers

from claire.annotations.models import Clause
from claire.corpora.models import Sentence

from .models import Comment, Review


class CommentSerializer(serializers.ModelSerializer):
    annotation_id = serializers.PrimaryKeyRelatedField(
        source="annotation", read_only=True
    )
    author_id = serializers.PrimaryKeyRelatedField(
        source="author", read_only=True
    )
    clause_id = serializers.PrimaryKeyRelatedField(
        source="clause", read_only=True
    )
    sentence_index = serializers.IntegerField(required=False, allow_null=True)
    thread_root = serializers.PrimaryKeyRelatedField(
        queryset=Comment.objects.all(), required=False, allow_null=True
    )
    # Write-only input: clause id.
    clause = serializers.PrimaryKeyRelatedField(
        queryset=Clause.objects.all(), write_only=True, required=False,
        allow_null=True,
    )

    class Meta:
        model = Comment
        fields = [
            "id", "annotation_id", "clause_id", "clause", "sentence_index",
            "author_id", "body", "thread_root", "resolved", "created_at",
        ]
        read_only_fields = ["id", "resolved", "created_at"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["sentence_index"] = (
            instance.sentence.index if instance.sentence_id else None
        )
        return data

    def build_comment_kwargs(self, annotation):
        """Resolve validated write data into Comment(**kwargs)."""
        data = dict(self.validated_data)
        kwargs = {
            "body": data["body"],
            "clause": data.get("clause"),
            "thread_root": data.get("thread_root"),
        }
        sentence_index = data.get("sentence_index")
        if sentence_index is not None:
            kwargs["sentence"] = Sentence.objects.filter(
                document=annotation.document, index=sentence_index
            ).first()
        return kwargs


class ReviewSerializer(serializers.ModelSerializer):
    annotation_id = serializers.PrimaryKeyRelatedField(
        source="annotation", read_only=True
    )
    reviewer_id = serializers.PrimaryKeyRelatedField(
        source="reviewer", read_only=True
    )

    class Meta:
        model = Review
        fields = [
            "id", "annotation_id", "reviewer_id", "score", "decision",
            "rubric", "body", "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate_score(self, value):
        if not 1 <= value <= 5:
            raise serializers.ValidationError("score must be in 1..5.")
        return value

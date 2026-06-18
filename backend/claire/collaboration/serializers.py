from rest_framework import serializers

from .models import Comment, Review


class CommentSerializer(serializers.ModelSerializer):
    author = serializers.SlugRelatedField(slug_field="username", read_only=True)

    class Meta:
        model = Comment
        fields = [
            "id", "annotation", "clause", "sentence", "author", "body",
            "thread_root", "resolved", "created_at",
        ]
        read_only_fields = ["id", "author", "resolved", "created_at", "annotation"]


class ReviewSerializer(serializers.ModelSerializer):
    reviewer = serializers.SlugRelatedField(slug_field="username", read_only=True)

    class Meta:
        model = Review
        fields = [
            "id", "annotation", "reviewer", "score", "decision", "rubric",
            "body", "created_at",
        ]
        read_only_fields = ["id", "reviewer", "created_at", "annotation"]

    def validate_score(self, value):
        if not 1 <= value <= 5:
            raise serializers.ValidationError("score must be in 1..5.")
        return value

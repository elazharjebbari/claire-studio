from rest_framework import serializers

from .models import Assignment, Project, ProjectMembership


class ProjectSerializer(serializers.ModelSerializer):
    corpus = serializers.SlugRelatedField(slug_field="slug", read_only=True)
    scheme = serializers.SlugRelatedField(slug_field="slug", read_only=True)
    corpus_slug = serializers.SlugField(write_only=True, required=False)
    scheme_slug = serializers.SlugField(write_only=True, required=False)

    class Meta:
        model = Project
        fields = [
            "id", "slug", "name", "corpus", "scheme", "guidelines", "status",
            "settings", "corpus_slug", "scheme_slug",
        ]

    def create(self, validated_data):
        from claire.corpora.models import Corpus
        from claire.schemes.models import LabelScheme

        corpus_slug = validated_data.pop("corpus_slug", None)
        scheme_slug = validated_data.pop("scheme_slug", None)
        if corpus_slug:
            validated_data["corpus"] = Corpus.objects.get(slug=corpus_slug)
        if scheme_slug:
            validated_data["scheme"] = LabelScheme.objects.get(slug=scheme_slug)
        return super().create(validated_data)


class AssignmentSerializer(serializers.ModelSerializer):
    document = serializers.SlugRelatedField(
        slug_field="external_id", read_only=True
    )
    assignee = serializers.SlugRelatedField(slug_field="username", read_only=True)

    class Meta:
        model = Assignment
        fields = ["id", "document", "assignee", "status", "due_at"]


class ProjectMembershipSerializer(serializers.ModelSerializer):
    user = serializers.SlugRelatedField(slug_field="username", read_only=True)

    class Meta:
        model = ProjectMembership
        fields = ["id", "user", "role", "joined_at"]

"""Project / Assignment / Membership serializers — CONTRACT-aligned shapes.

- Project    -> {id, slug, name, corpusSlug, schemeSlug, guidelines, status,
                 myRole?, settings}
- Assignment -> {id, projectSlug, document(DocumentSummary), assigneeId,
                 status, annotationId?, dueAt?}
"""

from rest_framework import serializers

from claire.corpora.serializers import DocumentListSerializer

from .models import Assignment, Project, ProjectMembership


class ProjectSerializer(serializers.ModelSerializer):
    corpus_slug = serializers.SlugRelatedField(
        source="corpus", slug_field="slug", read_only=True
    )
    scheme_slug = serializers.SlugRelatedField(
        source="scheme", slug_field="slug", read_only=True
    )
    my_role = serializers.SerializerMethodField()
    # Write-only inputs (admin create/clone).
    corpus = serializers.SlugField(write_only=True, required=False)
    scheme = serializers.SlugField(write_only=True, required=False)

    class Meta:
        model = Project
        fields = [
            "id", "slug", "name", "corpus_slug", "scheme_slug", "guidelines",
            "status", "visibility", "settings", "my_role", "corpus", "scheme",
        ]

    def get_my_role(self, obj):
        request = self.context.get("request")
        if request is None or not request.user.is_authenticated:
            return None
        membership = obj.memberships.filter(user=request.user).first()
        return membership.role if membership else None

    def create(self, validated_data):
        from claire.corpora.models import Corpus
        from claire.schemes.models import LabelScheme

        corpus_slug = validated_data.pop("corpus", None)
        scheme_slug = validated_data.pop("scheme", None)
        if corpus_slug:
            validated_data["corpus"] = Corpus.objects.get(slug=corpus_slug)
        if scheme_slug:
            validated_data["scheme"] = LabelScheme.objects.get(slug=scheme_slug)
        return super().create(validated_data)


class AssignmentSerializer(serializers.ModelSerializer):
    project_slug = serializers.SlugRelatedField(
        source="project", slug_field="slug", read_only=True
    )
    document = DocumentListSerializer(read_only=True)
    assignee_id = serializers.PrimaryKeyRelatedField(
        source="assignee", read_only=True
    )
    annotation_id = serializers.SerializerMethodField()

    class Meta:
        model = Assignment
        fields = [
            "id", "project_slug", "document", "assignee_id", "status",
            "annotation_id", "due_at",
        ]

    def get_annotation_id(self, obj):
        ann = obj.project.annotations.filter(
            document=obj.document, annotator=obj.assignee
        ).first()
        return ann.id if ann else None


class ProjectMembershipSerializer(serializers.ModelSerializer):
    user_id = serializers.PrimaryKeyRelatedField(source="user", read_only=True)

    class Meta:
        model = ProjectMembership
        fields = ["id", "user_id", "role", "joined_at"]

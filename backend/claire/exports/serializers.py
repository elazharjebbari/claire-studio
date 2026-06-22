from rest_framework import serializers

from .models import ExportJob


class ExportJobSerializer(serializers.ModelSerializer):
    project = serializers.SlugRelatedField(slug_field="slug", read_only=True)
    requested_by = serializers.SlugRelatedField(
        slug_field="username", read_only=True
    )

    class Meta:
        model = ExportJob
        fields = [
            "id", "project", "format", "scope", "status", "artifact_path",
            "manifest", "error", "requested_by", "created_at",
        ]
        read_only_fields = ["status", "artifact_path", "manifest", "error"]

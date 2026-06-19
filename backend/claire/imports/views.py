from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets

from claire.common.permissions import IsAdminRole

from .models import PreAnnotation
from .serializers import PreAnnotationSerializer


class PreAnnotationViewSet(viewsets.ReadOnlyModelViewSet):
    """GET /preannotations?project=&document=&judge= and import action."""

    queryset = PreAnnotation.objects.select_related(
        "project", "document"
    ).prefetch_related("preclauses")
    serializer_class = PreAnnotationSerializer
    permission_classes = [IsAdminRole]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["judge"]

    def get_queryset(self):
        qs = super().get_queryset()
        project = self.request.query_params.get("project")
        if project:
            qs = qs.filter(project__slug=project) if not project.isdigit() else (
                qs.filter(project__pk=project)
            )
        document = self.request.query_params.get("document")
        if document:
            # Le frontend envoie l'id numérique ; on tolère aussi l'external_id.
            qs = qs.filter(document__pk=document) if document.isdigit() else (
                qs.filter(document__external_id=document)
            )
        # Sélection de version (multi-versions) : ?version=v9.2
        version = self.request.query_params.get("version")
        if version:
            qs = qs.filter(schema_version=version)
        return qs

    # Note: the import endpoint lives on ProjectViewSet.import_preannotations
    # (POST /api/v1/projects/{slug}/preannotations/import) to match CONTRACT §3.

import os

from django.conf import settings
from django.http import FileResponse, Http404
from rest_framework import viewsets
from rest_framework.decorators import action

from claire.common.permissions import IsAdminRole

from .models import ExportJob
from .serializers import ExportJobSerializer


class ExportJobViewSet(viewsets.ReadOnlyModelViewSet):
    """GET /exports/{id} — status + manifest ; GET /exports/{id}/download — artefact."""

    queryset = ExportJob.objects.select_related("project", "requested_by")
    serializer_class = ExportJobSerializer
    permission_classes = [IsAdminRole]

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        """Télécharge l'artefact (FileResponse). Le chemin est CONFINÉ à EXPORTS_DIR
        (anti path‑traversal) : on refuse tout fichier hors du dossier d'exports."""
        job = self.get_object()
        if not job.artifact_path:
            raise Http404("Aucun artefact pour cet export.")
        exports_dir = os.path.realpath(str(settings.EXPORTS_DIR))
        real = os.path.realpath(job.artifact_path)
        if os.path.commonpath([exports_dir, real]) != exports_dir or not os.path.isfile(real):
            raise Http404("Artefact introuvable.")
        return FileResponse(
            open(real, "rb"),
            as_attachment=True,
            filename=os.path.basename(real),
        )

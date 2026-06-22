import os

from django.conf import settings
from django.http import FileResponse, Http404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from claire.common.permissions import IsAdminRole

from .models import ExportJob, ExportStatus
from .serializers import ExportJobSerializer
from .services import run_export_async

# Délai au-delà duquel un job encore pending/running est considéré « zombie »
# (interruption du process pendant l'export) et auto-réparé en failed à la lecture.
EXPORT_TIMEOUT_S = 900


def _self_heal(job: ExportJob) -> ExportJob:
    """Auto-répare un job périmé : pending/running depuis trop longtemps → failed."""
    if job.status in (ExportStatus.PENDING, ExportStatus.RUNNING):
        age = (timezone.now() - job.created_at).total_seconds()
        if age > getattr(settings, "EXPORT_TIMEOUT_S", EXPORT_TIMEOUT_S):
            job.status = ExportStatus.FAILED
            job.error = "L'export a expiré (interruption serveur probable). Relancez-le."
            job.save(update_fields=["status", "error"])
    return job


class ExportJobViewSet(viewsets.ReadOnlyModelViewSet):
    """GET /exports/{id} (statut, self-heal) ; .../download (artefact) ; .../retry."""

    queryset = ExportJob.objects.select_related("project", "requested_by")
    serializer_class = ExportJobSerializer
    permission_classes = [IsAdminRole]

    def retrieve(self, request, *args, **kwargs):
        job = _self_heal(self.get_object())
        return Response(ExportJobSerializer(job).data)

    @action(detail=True, methods=["post"])
    def retry(self, request, pk=None):
        """Réinitialise un job (pending) et le relance EN TÂCHE DE FOND — idempotent
        (réutilise le même id, pas de doublon)."""
        job = self.get_object()
        job.status = ExportStatus.PENDING
        job.error = ""
        job.artifact_path = ""
        job.manifest = {}
        job.save(update_fields=["status", "error", "artifact_path", "manifest"])
        run_export_async(job.id)
        job.refresh_from_db()
        return Response(ExportJobSerializer(job).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        """Télécharge l'artefact (FileResponse). Le chemin est CONFINÉ à EXPORTS_DIR
        (anti path‑traversal) : on refuse tout fichier hors du dossier d'exports."""
        job = self.get_object()
        if job.status != ExportStatus.DONE or not job.artifact_path:
            raise Http404("L'export n'est pas prêt.")
        exports_dir = os.path.realpath(str(settings.EXPORTS_DIR))
        real = os.path.realpath(job.artifact_path)
        if os.path.commonpath([exports_dir, real]) != exports_dir or not os.path.isfile(real):
            raise Http404("Artefact introuvable.")
        return FileResponse(
            open(real, "rb"),
            as_attachment=True,
            filename=os.path.basename(real),
        )

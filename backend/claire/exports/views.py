from rest_framework import viewsets

from claire.common.permissions import IsAdminRole

from .models import ExportJob
from .serializers import ExportJobSerializer


class ExportJobViewSet(viewsets.ReadOnlyModelViewSet):
    """GET /exports/{id} — status + artifact link/manifest."""

    queryset = ExportJob.objects.select_related("project", "requested_by")
    serializer_class = ExportJobSerializer
    permission_classes = [IsAdminRole]

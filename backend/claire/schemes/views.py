from rest_framework import viewsets

from claire.common.permissions import IsAdminRole

from .models import LabelScheme
from .serializers import LabelSchemeListSerializer, LabelSchemeSerializer


class LabelSchemeViewSet(viewsets.ModelViewSet):
    """GET /schemes, GET /schemes/{slug}, POST /schemes (admin)."""

    queryset = LabelScheme.objects.prefetch_related("themes", "legal_natures")
    permission_classes = [IsAdminRole]
    lookup_field = "slug"

    def get_serializer_class(self):
        if self.action == "list":
            return LabelSchemeListSerializer
        return LabelSchemeSerializer

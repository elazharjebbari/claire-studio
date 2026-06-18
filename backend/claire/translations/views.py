from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from claire.common.permissions import IsAdminRole

from .models import TranslationSet
from .serializers import TranslationSetSerializer
from .services import sync_translation_set


class TranslationSetViewSet(viewsets.ModelViewSet):
    """POST /translations/sets ; POST /translations/sets/{id}/sync."""

    queryset = TranslationSet.objects.select_related("corpus")
    serializer_class = TranslationSetSerializer
    permission_classes = [IsAdminRole]

    @action(detail=True, methods=["post"])
    def sync(self, request, pk=None):
        translation_set = self.get_object()
        result = sync_translation_set(translation_set)
        return Response(
            {"translation_set": translation_set.id, **result,
             "status": translation_set.status}
        )

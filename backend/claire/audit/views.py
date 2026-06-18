from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import ActivityEvent
from .serializers import ActivityEventSerializer


class ActivityEventViewSet(viewsets.ReadOnlyModelViewSet):
    """GET /activity?project=&actor=&verb= (feature 4)."""

    queryset = ActivityEvent.objects.select_related("actor")
    serializer_class = ActivityEventSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["verb", "target_type"]

    def get_queryset(self):
        qs = super().get_queryset()
        actor = self.request.query_params.get("actor")
        if actor:
            qs = qs.filter(actor__username=actor)
        # ?project=<slug> filters annotation-targeted events for that project.
        project = self.request.query_params.get("project")
        if project:
            from claire.annotations.models import Annotation

            ann_ids = list(
                Annotation.objects.filter(project__slug=project)
                .values_list("id", flat=True)
            )
            qs = qs.filter(
                target_type="annotations.annotation",
                target_id__in=[str(i) for i in ann_ids],
            )
        return qs

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
        # Isolation projet (sécurité, audit M9) : un utilisateur non privilégié ne voit
        # que les événements de SES projets (annotations) ou ses propres actions — sans
        # ce filtre, /activity exposait toute l'activité de la plateforme.
        from django.db.models import Q

        user = self.request.user
        if not (
            getattr(user, "is_admin_role", False)
            or getattr(user, "role", None) == "reviewer"
        ):
            from claire.annotations.models import Annotation

            my_ann_ids = [
                str(i)
                for i in Annotation.objects.filter(
                    project__memberships__user=user
                ).values_list("id", flat=True)
            ]
            qs = qs.filter(
                Q(actor=user)
                | Q(target_type="annotations.annotation", target_id__in=my_ann_ids)
            ).distinct()
        return qs

from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Comment
from .serializers import CommentSerializer


class CommentViewSet(viewsets.ModelViewSet):
    """POST /comments/{id}/resolve and basic CRUD on comments."""

    queryset = Comment.objects.select_related("author", "annotation")
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "patch", "delete"]

    def get_queryset(self):
        # Isolation projet (sécurité, audit M9) : un utilisateur ne voit QUE les
        # commentaires des projets dont il est membre (ou les siens). Sans ce filtre,
        # CommentViewSet exposait TOUS les commentaires de la plateforme. Admin/reviewer
        # gardent la portée transverse.
        qs = super().get_queryset()
        user = self.request.user
        if getattr(user, "is_admin_role", False) or getattr(user, "role", None) == "reviewer":
            return qs
        return qs.filter(
            Q(annotation__project__memberships__user=user) | Q(author=user)
        ).distinct()

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        comment = self.get_object()
        comment.resolved = True
        comment.save(update_fields=["resolved", "updated_at"])
        return Response(CommentSerializer(comment).data, status=status.HTTP_200_OK)

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

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        comment = self.get_object()
        comment.resolved = True
        comment.save(update_fields=["resolved", "updated_at"])
        return Response(CommentSerializer(comment).data, status=status.HTTP_200_OK)

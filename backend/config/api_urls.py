"""API v1 router aggregation (CONTRACT §3).

We compose a single DRF router from per-app registrations, then add the
non-ViewSet function/APIView endpoints (auth, nested actions).
"""

from django.urls import include, path
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.routers import DefaultRouter
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenRefreshView

from claire.accounts.views import LoginView, MeView
from claire.annotations.views import (
    AnnotationViewSet,
    ClauseViewSet,
)
from claire.collaboration.views import CommentViewSet
from claire.corpora.views import (
    CorpusViewSet,
    DocumentViewSet,
)
from claire.exports.views import ExportJobViewSet
from claire.imports.views import PreAnnotationViewSet
from claire.projects.views import ProjectViewSet
from claire.schemes.views import LabelSchemeViewSet
from claire.translations.views import TranslationSetViewSet
from claire.audit.views import ActivityEventViewSet

router = DefaultRouter(trailing_slash=False)
router.register("corpora", CorpusViewSet, basename="corpus")
router.register("documents", DocumentViewSet, basename="document")
router.register("schemes", LabelSchemeViewSet, basename="scheme")
router.register("projects", ProjectViewSet, basename="project")
router.register("annotations", AnnotationViewSet, basename="annotation")
router.register("clauses", ClauseViewSet, basename="clause")
router.register("preannotations", PreAnnotationViewSet, basename="preannotation")
router.register("comments", CommentViewSet, basename="comment")
router.register("translations/sets", TranslationSetViewSet, basename="translationset")
router.register("exports", ExportJobViewSet, basename="export")
router.register("activity", ActivityEventViewSet, basename="activity")

class HealthView(APIView):
    """GET /api/v1/health — liveness + état des données (sans auth, pour le debug front)."""

    permission_classes = [AllowAny]
    authentication_classes: list = []

    def get(self, request):
        from claire.annotations.models import Annotation
        from claire.corpora.models import Document

        return Response(
            {
                "status": "ok",
                "documents": Document.objects.count(),
                "annotations": Annotation.objects.count(),
            }
        )


urlpatterns = [
    # Liveness / debug (no auth)
    path("health", HealthView.as_view(), name="health"),
    # Auth (JWT) — CONTRACT §3
    path("auth/login", LoginView.as_view(), name="auth-login"),
    path("auth/refresh", TokenRefreshView.as_view(), name="auth-refresh"),
    path("me", MeView.as_view(), name="me"),
    path("", include(router.urls)),
]

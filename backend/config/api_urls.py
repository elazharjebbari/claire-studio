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

from claire.accounts.views import (
    LoginView,
    MeView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    RegisterView,
    VerifyEmailView,
)
from claire.annotations.views import (
    AnnotationViewSet,
    ClauseViewSet,
)
from claire.audit.views import ActivityEventViewSet
from claire.collaboration.views import CommentViewSet
from claire.corpora.views import (
    CorpusViewSet,
    DocumentViewSet,
)
from claire.exports.views import ExportJobViewSet
from claire.imports.views import PreAnnotationViewSet
from claire.projects.views import (
    ProjectViewSet,
    PublicProjectDetailView,
    PublicProjectListView,
)
from claire.schemes.views import LabelSchemeViewSet
from claire.translations.views import TranslationSetViewSet

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

class ConfigFlagsView(APIView):
    """GET /api/v1/config/flags — feature flags effectifs (l'UI s'y conforme).

    Lus depuis settings.FEATURE_FLAGS (surchargeables par l'admin) avec défauts sûrs.
    Le rendu camelCase convertit les clés (realtime_collaboration → realtimeCollaboration).
    """

    permission_classes = [AllowAny]
    authentication_classes: list = []

    def get(self, request):
        from django.conf import settings

        flags = getattr(settings, "FEATURE_FLAGS", {})
        return Response(
            {
                "realtime_collaboration": flags.get("realtime_collaboration", False),
                "presence": flags.get("presence", True),
                "attribution_overlay": flags.get("attribution_overlay", True),
                "comments_multilevel": flags.get("comments_multilevel", True),
                "undo_redo": flags.get("undo_redo", True),
                "analytics_screen": flags.get("analytics_screen", True),
                "version_explorer": flags.get("version_explorer", True),
            }
        )


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
    # Feature flags (no auth) — points 4b/7 + admin
    path("config/flags", ConfigFlagsView.as_view(), name="config-flags"),
    # Auth (JWT) — CONTRACT §3
    path("auth/login", LoginView.as_view(), name="auth-login"),
    path("auth/refresh", TokenRefreshView.as_view(), name="auth-refresh"),
    # Onboarding (chantier E) — inscription, vérification e-mail, reset mot de passe.
    path("auth/register", RegisterView.as_view(), name="auth-register"),
    path("auth/verify-email", VerifyEmailView.as_view(), name="auth-verify-email"),
    path("auth/password-reset", PasswordResetRequestView.as_view(), name="auth-password-reset"),
    path(
        "auth/password-reset/confirm",
        PasswordResetConfirmView.as_view(),
        name="auth-password-reset-confirm",
    ),
    path("me", MeView.as_view(), name="me"),
    # Publication publique (chantier F) — lecture seule, sans authentification.
    path("public/projects", PublicProjectListView.as_view(), name="public-projects"),
    path(
        "public/projects/<slug:slug>",
        PublicProjectDetailView.as_view(),
        name="public-project-detail",
    ),
    path("", include(router.urls)),
]

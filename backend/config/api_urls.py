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
from claire.lab import views as lab_views
from claire.analysis.views import (
    AnalysisCatalogView,
    AnalysisHealthView,
    PresetDetailView,
    PresetListCreateView,
    ReportArtifactDownloadView,
    ReportArtifactView,
    ReportCompareView,
    ReportDetailView,
    ReportListCreateView,
    ReportRenderView,
    RunCancelView,
    RunCasesView,
    RunDetailView,
    RunListCreateView,
    ScopePreviewView,
    SnapshotDetailView,
    SnapshotListCreateView,
    TaxonomyProposalDetailView,
    TaxonomyProposalListCreateView,
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
    JoinShareLinkView,
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
    # Pactiva Analysis Lab — snapshots de brouillons, runs et rapports historiques.
    path(
        "projects/<slug:slug>/analysis/catalog",
        AnalysisCatalogView.as_view(),
        name="analysis-catalog",
    ),
    path(
        "projects/<slug:slug>/analysis/health",
        AnalysisHealthView.as_view(),
        name="analysis-health",
    ),
    path(
        "projects/<slug:slug>/analysis/scopes/preview",
        ScopePreviewView.as_view(),
        name="analysis-scope-preview",
    ),
    path(
        "projects/<slug:slug>/analysis/snapshots",
        SnapshotListCreateView.as_view(),
        name="analysis-snapshots",
    ),
    path(
        "projects/<slug:slug>/analysis/snapshots/<uuid:snapshot_id>",
        SnapshotDetailView.as_view(),
        name="analysis-snapshot-detail",
    ),
    path(
        "projects/<slug:slug>/analysis/runs",
        RunListCreateView.as_view(),
        name="analysis-runs",
    ),
    path(
        "projects/<slug:slug>/analysis/runs/<uuid:run_id>",
        RunDetailView.as_view(),
        name="analysis-run-detail",
    ),
    path(
        "projects/<slug:slug>/analysis/runs/<uuid:run_id>/cancel",
        RunCancelView.as_view(),
        name="analysis-run-cancel",
    ),
    path(
        "projects/<slug:slug>/analysis/runs/<uuid:run_id>/cases",
        RunCasesView.as_view(),
        name="analysis-run-cases",
    ),
    path(
        "projects/<slug:slug>/analysis/presets",
        PresetListCreateView.as_view(),
        name="analysis-presets",
    ),
    path(
        "projects/<slug:slug>/analysis/presets/<uuid:preset_id>",
        PresetDetailView.as_view(),
        name="analysis-preset-detail",
    ),
    path(
        "projects/<slug:slug>/analysis/taxonomy-proposals",
        TaxonomyProposalListCreateView.as_view(),
        name="analysis-taxonomy-proposals",
    ),
    path(
        "projects/<slug:slug>/analysis/taxonomy-proposals/<uuid:proposal_id>",
        TaxonomyProposalDetailView.as_view(),
        name="analysis-taxonomy-proposal-detail",
    ),
    path(
        "projects/<slug:slug>/analysis/reports",
        ReportListCreateView.as_view(),
        name="analysis-reports",
    ),
    path(
        "projects/<slug:slug>/analysis/reports/<uuid:report_id>",
        ReportDetailView.as_view(),
        name="analysis-report-detail",
    ),
    path(
        "projects/<slug:slug>/analysis/reports/<uuid:report_id>/compare",
        ReportCompareView.as_view(),
        name="analysis-report-compare",
    ),
    path(
        "projects/<slug:slug>/analysis/reports/<uuid:report_id>/render",
        ReportRenderView.as_view(),
        name="analysis-report-render",
    ),
    path(
        "projects/<slug:slug>/analysis/artifacts/<uuid:artifact_id>",
        ReportArtifactView.as_view(),
        name="analysis-artifact-detail",
    ),
    path(
        "projects/<slug:slug>/analysis/artifacts/<uuid:artifact_id>/download",
        ReportArtifactDownloadView.as_view(),
        name="analysis-artifact-download",
    ),
    # Publication publique (chantier F) — lecture seule, sans authentification.
    path("public/projects", PublicProjectListView.as_view(), name="public-projects"),
    path(
        "public/projects/<slug:slug>",
        PublicProjectDetailView.as_view(),
        name="public-project-detail",
    ),
    # Jonction via lien de partage persisté (chantier D) — authentifié.
    path(
        "share-links/<str:token>/join",
        JoinShareLinkView.as_view(),
        name="share-link-join",
    ),
    # ── Pactiva Lab (docs/pactiva-lab/) ─────────────────────────────────────
    # Réservé aux rôles lead/reviewer : un annotateur n'a rien à faire au Lab, et ne
    # doit jamais y découvrir un classement de ses pairs.
    path("projects/<slug:slug>/lab/datasets/preflight", lab_views.dataset_preflight,
         name="lab-dataset-preflight"),
    path("projects/<slug:slug>/lab/datasets", lab_views.datasets, name="lab-datasets"),
    path("projects/<slug:slug>/lab/datasets/<uuid:dataset_id>", lab_views.dataset_detail,
         name="lab-dataset-detail"),
    path("projects/<slug:slug>/lab/presets", lab_views.presets, name="lab-presets"),
    path("projects/<slug:slug>/lab/g5k/clusters", lab_views.g5k_clusters, name="lab-g5k-clusters"),
    path("projects/<slug:slug>/lab/experiments", lab_views.experiments,
         name="lab-experiments"),
    path("projects/<slug:slug>/lab/experiments/<uuid:experiment_id>/estimate",
         lab_views.experiment_estimate, name="lab-experiment-estimate"),
    path("projects/<slug:slug>/lab/experiments/<uuid:experiment_id>/run",
         lab_views.experiment_run, name="lab-experiment-run"),
    path("projects/<slug:slug>/lab/runs", lab_views.runs, name="lab-runs"),
    path("projects/<slug:slug>/lab/runs/<uuid:run_id>", lab_views.run_detail,
         name="lab-run-detail"),
    path("projects/<slug:slug>/lab/runs/<uuid:run_id>/cancel", lab_views.run_cancel,
         name="lab-run-cancel"),
    path("projects/<slug:slug>/lab/compare", lab_views.compare_runs, name="lab-compare"),
    path("projects/<slug:slug>/lab/compare/paired", lab_views.compare_paired,
         name="lab-compare-paired"),
    path("projects/<slug:slug>/lab/experiments/<uuid:experiment_id>/aggregate",
         lab_views.experiment_aggregate, name="lab-experiment-aggregate"),
    path("projects/<slug:slug>/lab/agreement", lab_views.judges_agreement,
         name="lab-agreement"),
    path("me/compute-credentials", lab_views.compute_credentials,
         name="lab-compute-credentials"),
    path("me/compute-credentials/<int:credential_id>/test",
         lab_views.compute_credentials_test, name="lab-compute-credentials-test"),
    path("me/compute-credentials/<int:credential_id>", lab_views.compute_credential_delete,
         name="lab-compute-credential-delete"),
    path("", include(router.urls)),
]

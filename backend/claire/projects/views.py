from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from claire.common.pagination import results_envelope
from claire.common.permissions import IsAdminRole

from .iaa import project_iaa, project_iaa_detail
from .models import Project, ProjectVisibility
from .serializers import AssignmentSerializer, ProjectSerializer


class ProjectViewSet(viewsets.ModelViewSet):
    """Projects visible to the user; POST restricted to admin."""

    serializer_class = ProjectSerializer
    lookup_field = "slug"

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            return [IsAdminRole()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs = Project.objects.select_related("corpus", "scheme")
        if user.is_admin_role:
            return qs
        # Members see their projects.
        return qs.filter(memberships__user=user).distinct()

    @action(detail=True, methods=["get"])
    def assignments(self, request, slug=None):
        project = self.get_object()
        qs = project.assignments.select_related(
            "project", "document", "document__corpus", "assignee"
        )
        if not request.user.is_admin_role:
            qs = qs.filter(assignee=request.user)
        ser = AssignmentSerializer(qs, many=True, context={"request": request})
        return Response(results_envelope(ser.data))

    @action(detail=True, methods=["get"])
    def progress(self, request, slug=None):
        """Return the ProjectProgress shape (CONTRACT)."""
        project = self.get_object()
        total_documents = project.corpus.documents.count()
        # An annotated document is one with at least one annotation in the project.
        annotated_documents = (
            project.annotations.values("document").distinct().count()
        )
        submitted_documents = (
            project.annotations.filter(
                status__in=["submitted", "in_review", "approved"]
            )
            .values("document")
            .distinct()
            .count()
        )
        approved_documents = (
            project.annotations.filter(status="approved")
            .values("document")
            .distinct()
            .count()
        )
        my_assigned = project.assignments.filter(assignee=request.user).count()
        my_done = project.annotations.filter(
            annotator=request.user,
            status__in=["submitted", "in_review", "approved"],
        ).count()

        iaa = project_iaa(project)
        iaa_detail = project_iaa_detail(project)
        return Response(
            {
                "total_documents": total_documents,
                "annotated_documents": annotated_documents,
                "submitted_documents": submitted_documents,
                "approved_documents": approved_documents,
                "my_assigned": my_assigned,
                "my_done": my_done,
                "iaa": iaa["mean_kappa"],
                "iaa_detail": iaa_detail,
            }
        )

    # --- pre-annotations import (feature 2) -------------------------------
    @action(
        detail=True, methods=["post"],
        url_path="preannotations/import", permission_classes=[IsAdminRole],
    )
    def import_preannotations(self, request, slug=None):
        from claire.corpora.models import Document
        from claire.imports.serializers import PreAnnotationSerializer
        from claire.imports.services import ingest_preannotation

        project = self.get_object()
        payloads = request.data.get("items") or [request.data]
        results = []
        for item in payloads:
            document = get_object_or_404(
                Document, external_id=item["document"], corpus=project.corpus
            )
            pre = ingest_preannotation(
                project=project, document=document,
                judge=item["judge"], raw=item["raw"],
            )
            results.append(PreAnnotationSerializer(pre).data)
        return Response(results, status=status.HTTP_201_CREATED)

    # --- translations (feature 8) -----------------------------------------
    @action(detail=True, methods=["get"])
    def translations(self, request, slug=None):
        from claire.translations.serializers import TranslationSetSerializer

        project = self.get_object()
        qs = project.corpus.translation_sets.all()
        return Response(results_envelope(TranslationSetSerializer(qs, many=True).data))

    # --- insights : exploration des annotations humaines (point 5) --------
    @action(detail=True, methods=["get"])
    def insights(self, request, slug=None):
        from django.db.models import Avg, Count

        from claire.annotations.models import Annotation, AnnotationVersion, Clause
        from claire.collaboration.models import Comment
        from claire.common.identity import approx_pages
        from claire.translations.models import Translation

        project = self.get_object()
        docs = list(project.corpus.documents.all())
        anns = Annotation.objects.filter(project=project)

        theme_distribution = [
            {"theme": r["theme__code"], "count": r["count"]}
            for r in Clause.objects.filter(annotation__project=project)
            .values("theme__code")
            .annotate(count=Count("id"))
            .order_by("-count")
        ]
        mean_certainty = Clause.objects.filter(annotation__project=project).aggregate(
            m=Avg("certainty")
        )["m"]
        try:
            kappa = project_iaa(project).get("mean_kappa")
        except Exception:  # noqa: BLE001 — l'IAA ne doit jamais casser l'écran
            kappa = None

        documents = []
        for d in docs:
            d_anns = [a for a in anns if a.document_id == d.id]
            rep = d_anns[0] if d_anns else None
            documents.append(
                {
                    "document_id": d.external_id,
                    "title": d.title,
                    "status": rep.status if rep else "unstarted",
                    "clauses": rep.clauses.count() if rep else 0,
                    "comments": Comment.objects.filter(
                        annotation__document=d, annotation__project=project
                    ).count(),
                    "annotation_id": rep.pk if rep else None,
                    "approx_pages": approx_pages(d.n_sentences),
                    "has_translation": Translation.objects.filter(document=d).exists(),
                }
            )

        return Response(
            {
                "project_slug": project.slug,
                "kpi": {
                    "documents_annotated": anns.values("document").distinct().count(),
                    "documents_total": len(docs),
                    "annotators": anns.values("annotator").distinct().count(),
                    "versions": AnnotationVersion.objects.filter(
                        annotation__project=project
                    ).count(),
                    "mean_certainty": round(mean_certainty, 2) if mean_certainty else None,
                    "kappa": round(kappa, 2) if kappa is not None else None,
                },
                "theme_distribution": theme_distribution,
                "documents": documents,
            }
        )

    @action(detail=True, methods=["get"], url_path=r"insights/(?P<document_id>[^/.]+)")
    def insights_document(self, request, slug=None, document_id=None):
        from django.db.models import Avg, Count

        from claire.annotations.models import Annotation, Clause
        from claire.collaboration.models import Comment
        from claire.common.identity import approx_pages
        from claire.corpora.models import Document

        project = self.get_object()
        document = get_object_or_404(
            Document, external_id=document_id, corpus=project.corpus
        )
        d_anns = Annotation.objects.filter(project=project, document=document)
        rep = d_anns.select_related("annotator").first()
        rep_clauses = (
            rep.clauses.select_related("theme", "anchor_sentence").order_by(
                "anchor_sentence__index"
            )
            if rep
            else []
        )

        theme_distribution = [
            {"theme": r["theme__code"], "count": r["count"]}
            for r in Clause.objects.filter(annotation__in=d_anns)
            .values("theme__code")
            .annotate(count=Count("id"))
            .order_by("-count")
        ]
        mean_certainty = Clause.objects.filter(annotation__in=d_anns).aggregate(
            m=Avg("certainty")
        )["m"]

        return Response(
            {
                "document_id": document.external_id,
                "title": document.title,
                "annotation_id": rep.pk if rep else None,
                "approx_pages": approx_pages(document.n_sentences),
                "n_sentences": document.n_sentences,
                "kpi": {
                    "clauses": len(rep_clauses) if rep else 0,
                    "mean_certainty": round(mean_certainty, 2) if mean_certainty else None,
                    "comments": Comment.objects.filter(annotation__in=d_anns).count(),
                    "contributors": d_anns.values("annotator").distinct().count(),
                    "agreement_with_llm": None,
                    "approx_pages": approx_pages(document.n_sentences),
                },
                "theme_distribution": theme_distribution,
                "clause_certainty": [
                    {
                        "anchor_index": c.anchor_sentence.index,
                        "certainty": c.certainty,
                        "theme": c.theme.code,
                    }
                    for c in rep_clauses
                ],
            }
        )

    # --- partage collaboratif (chantier D) --------------------------------
    @action(
        detail=True, methods=["get", "post"],
        url_path="share-links", permission_classes=[IsAdminRole],
    )
    def share_links(self, request, slug=None):
        """Liens de partage PERSISTÉS (révocables, expirables, à quota). GET liste,
        POST crée. L'invité rejoint via son compte authentifié (cf. JoinShareLinkView)."""
        import secrets

        from django.utils.dateparse import parse_datetime

        from claire.collaboration.models import ShareLink, ShareRole
        from claire.collaboration.serializers import ShareLinkSerializer

        project = self.get_object()
        if request.method == "POST":
            role = request.data.get("role_granted", ShareRole.ANNOTATOR)
            if role not in {ShareRole.ANNOTATOR, ShareRole.REVIEWER}:
                role = ShareRole.ANNOTATOR
            expires_raw = request.data.get("expires_at")
            max_uses = request.data.get("max_uses")
            link = ShareLink.objects.create(
                project=project,
                token=secrets.token_urlsafe(24),
                role_granted=role,
                created_by=request.user,
                expires_at=parse_datetime(expires_raw) if expires_raw else None,
                max_uses=int(max_uses) if max_uses else None,
            )
            return Response(
                ShareLinkSerializer(link, context={"request": request}).data,
                status=status.HTTP_201_CREATED,
            )
        qs = project.share_links.select_related("created_by")
        return Response(
            results_envelope(
                ShareLinkSerializer(qs, many=True, context={"request": request}).data
            )
        )

    @action(
        detail=True, methods=["post"],
        url_path=r"share-links/(?P<token>[^/]+)/revoke",
        permission_classes=[IsAdminRole],
    )
    def revoke_share_link(self, request, slug=None, token=None):
        from claire.collaboration.serializers import ShareLinkSerializer

        project = self.get_object()
        link = get_object_or_404(project.share_links, token=token)
        link.revoked = True
        link.save(update_fields=["revoked"])
        return Response(ShareLinkSerializer(link, context={"request": request}).data)

    # --- exports (feature 5) ----------------------------------------------
    @action(detail=True, methods=["post"], permission_classes=[IsAdminRole])
    def exports(self, request, slug=None):
        from claire.exports.models import ExportJob
        from claire.exports.serializers import ExportJobSerializer
        from claire.exports.services import run_export

        project = self.get_object()
        job = ExportJob.objects.create(
            project=project,
            format=request.data.get("format", "jsonl"),
            scope=request.data.get("scope", {}),
            requested_by=request.user,
        )
        run_export(job)
        return Response(
            ExportJobSerializer(job).data, status=status.HTTP_201_CREATED
        )


# --- Publication publique (chantier F) ---------------------------------------
def _public_aggregates(project):
    """Agrégats lecture seule d'un projet (KPI + distribution de thèmes)."""
    from django.db.models import Avg, Count

    from claire.annotations.models import Annotation, Clause

    anns = Annotation.objects.filter(project=project)
    theme_distribution = [
        {"theme": r["theme__code"], "count": r["count"]}
        for r in Clause.objects.filter(annotation__project=project)
        .values("theme__code")
        .annotate(count=Count("id"))
        .order_by("-count")
    ]
    mean_certainty = Clause.objects.filter(annotation__project=project).aggregate(
        m=Avg("certainty")
    )["m"]
    try:
        kappa = project_iaa(project).get("mean_kappa")
    except Exception:  # noqa: BLE001 — l'IAA ne doit jamais casser l'écran public
        kappa = None
    return {
        "slug": project.slug,
        "name": project.name,
        "corpus_slug": project.corpus.slug,
        "kpi": {
            "documents_total": project.corpus.documents.count(),
            "documents_annotated": anns.values("document").distinct().count(),
            "annotators": anns.values("annotator").distinct().count(),
            "mean_certainty": round(mean_certainty, 2) if mean_certainty else None,
            "kappa": round(kappa, 2) if kappa is not None else None,
        },
        "theme_distribution": theme_distribution,
    }


class PublicProjectListView(APIView):
    """GET /public/projects — projets PUBLIÉS uniquement (lecture seule, sans auth)."""

    permission_classes = [AllowAny]
    authentication_classes: list = []

    def get(self, request):
        qs = Project.objects.filter(
            visibility=ProjectVisibility.PUBLIC
        ).select_related("corpus")
        results = [
            {"slug": p.slug, "name": p.name, "corpus_slug": p.corpus.slug}
            for p in qs
        ]
        return Response(results_envelope(results))


class PublicProjectDetailView(APIView):
    """GET /public/projects/{slug} — agrégats publics (404 si privé/inexistant)."""

    permission_classes = [AllowAny]
    authentication_classes: list = []

    def get(self, request, slug=None):
        project = (
            Project.objects.filter(slug=slug, visibility=ProjectVisibility.PUBLIC)
            .select_related("corpus")
            .first()
        )
        if project is None:
            # Confidentialité : on ne distingue pas « privé » de « inexistant ».
            return Response(
                {"detail": "Projet introuvable ou non publié."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(_public_aggregates(project))


class JoinShareLinkView(APIView):
    """POST /share-links/{token}/join — rejoint un projet via un lien de partage.

    Accès AUTHENTIFIÉ uniquement (jamais anonyme, chantier D) : l'utilisateur connecté
    devient membre du projet avec le rôle accordé. Refuse un lien révoqué / expiré /
    épuisé. Le quota n'est décompté que sur une adhésion réellement nouvelle.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, token=None):
        from django.db.models import F

        from claire.collaboration.models import ShareLink
        from .models import ProjectMembership

        link = (
            ShareLink.objects.filter(token=token).select_related("project").first()
        )
        if link is None:
            return Response(
                {"detail": "Lien de partage invalide."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if not link.is_usable():
            return Response(
                {"detail": "Lien révoqué, expiré ou épuisé."},
                status=status.HTTP_403_FORBIDDEN,
            )
        membership, created = ProjectMembership.objects.get_or_create(
            project=link.project,
            user=request.user,
            defaults={"role": link.role_granted},
        )
        if created:
            ShareLink.objects.filter(pk=link.pk).update(used_count=F("used_count") + 1)
        return Response(
            {
                "project_slug": link.project.slug,
                "role": membership.role,
                "joined": created,
            }
        )

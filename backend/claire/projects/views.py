from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from claire.audit.services import record_event
from claire.common.pagination import results_envelope
from claire.common.permissions import IsAdminRole

from .iaa import project_iaa, project_iaa_detail
from .concordance import project_concordance
from .models import (
    Assignment,
    MembershipRole,
    Project,
    ProjectMembership,
    ProjectVisibility,
)
from .serializers import (
    AssignmentSerializer,
    ProjectMembershipSerializer,
    ProjectSerializer,
)


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

    @action(detail=True, methods=["post"], permission_classes=[IsAdminRole])
    def lock(self, request, slug=None):
        """Verrou NIVEAU PROJET (admin) : gèle l'édition de TOUTES les sessions du
        projet d'un coup. Override du verrou par-annotation ; un annotateur ne peut pas
        déverrouiller sa session tant que le projet est verrouillé. Idempotent."""
        project = self.get_object()
        if not project.locked:
            project.locked = True
            project.locked_at = timezone.now()
            project.locked_by = request.user
            project.save(update_fields=["locked", "locked_at", "locked_by", "updated_at"])
            record_event(
                actor=request.user, verb="project.locked", target=project,
                payload={"sessions": project.annotations.count()},
            )
        return Response(ProjectSerializer(project, context={"request": request}).data)

    @action(detail=True, methods=["post"], permission_classes=[IsAdminRole])
    def unlock(self, request, slug=None):
        """Lève le verrou projet (admin). Les verrous par-annotation (soumission)
        restent inchangés : chaque annotateur redevient libre de gérer SA session.
        Idempotent."""
        project = self.get_object()
        if project.locked:
            project.locked = False
            project.locked_at = None
            project.locked_by = None
            project.save(update_fields=["locked", "locked_at", "locked_by", "updated_at"])
            record_event(
                actor=request.user, verb="project.unlocked", target=project, payload={},
            )
        return Response(ProjectSerializer(project, context={"request": request}).data)

    @action(detail=True, methods=["get", "post"])
    def assignments(self, request, slug=None):
        project = self.get_object()
        if request.method == "POST":
            if not request.user.is_admin_role:
                return Response(
                    {"detail": "Réservé aux administrateurs."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            from claire.corpora.models import Document

            User = get_user_model()
            document = get_object_or_404(
                Document, external_id=request.data.get("document"), corpus=project.corpus
            )
            assignee = get_object_or_404(User, pk=request.data.get("assignee"))
            obj, created = Assignment.objects.get_or_create(
                project=project, document=document, assignee=assignee
            )
            return Response(
                AssignmentSerializer(obj, context={"request": request}).data,
                status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
            )
        qs = project.assignments.select_related(
            "project", "document", "document__corpus", "assignee"
        )
        if not request.user.is_admin_role:
            qs = qs.filter(assignee=request.user)
        ser = AssignmentSerializer(qs, many=True, context={"request": request})
        return Response(results_envelope(ser.data))

    @action(
        detail=True, methods=["delete"],
        url_path=r"assignments/(?P<assignment_id>\d+)",
        permission_classes=[IsAdminRole],
    )
    def delete_assignment(self, request, slug=None, assignment_id=None):
        project = self.get_object()
        get_object_or_404(project.assignments, pk=assignment_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(
        detail=True, methods=["post"],
        url_path="assignments/bulk", permission_classes=[IsAdminRole],
    )
    def assignments_bulk(self, request, slug=None):
        """Assignation en masse. Corps :
        - {documents: [external_id]|"all", assignees: [user_id]} → produit cartésien
        - {documents: [...]|"all", overlap: k} → k annotateurs/doc (round-robin équilibré)
        """
        from claire.corpora.models import Document

        User = get_user_model()
        project = self.get_object()
        docs_param = request.data.get("documents")
        if docs_param in (None, "all", "*"):
            docs = list(project.corpus.documents.all().order_by("external_id"))
        else:
            docs = list(
                Document.objects.filter(corpus=project.corpus, external_id__in=docs_param)
            )
        assignees_ids = request.data.get("assignees")
        overlap = request.data.get("overlap")
        if assignees_ids:
            assignees = list(User.objects.filter(pk__in=assignees_ids))
            pairs = [(d, a) for d in docs for a in assignees]
        elif overlap:
            members = [
                m.user
                for m in project.memberships.filter(role=MembershipRole.ANNOTATOR)
                .select_related("user")
                .order_by("user_id")
            ] or [
                m.user
                for m in project.memberships.select_related("user").order_by("user_id")
            ]
            if not members:
                return Response(
                    {"detail": "Aucun membre annotateur."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            k = max(1, min(int(overlap), len(members)))
            pairs = [
                (d, members[(i + j) % len(members)])
                for i, d in enumerate(docs)
                for j in range(k)
            ]
        else:
            return Response(
                {"detail": "Fournir 'assignees' ou 'overlap'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        created = 0
        with transaction.atomic():
            for d, a in pairs:
                _, c = Assignment.objects.get_or_create(
                    project=project, document=d, assignee=a
                )
                created += int(c)
        return Response(
            {"created": created, "requested": len(pairs)},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["get", "post"])
    def members(self, request, slug=None):
        project = self.get_object()
        if request.method == "POST":
            if not request.user.is_admin_role:
                return Response(
                    {"detail": "Réservé aux administrateurs."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            User = get_user_model()
            ident = (
                request.data.get("user")
                or request.data.get("username")
                or request.data.get("user_id")
            )
            user = User.objects.filter(username=ident).first()
            if user is None and str(ident).isdigit():
                user = User.objects.filter(pk=int(ident)).first()
            if user is None:
                return Response(
                    {"detail": "Utilisateur introuvable."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            role = request.data.get("role", MembershipRole.ANNOTATOR)
            m, created = ProjectMembership.objects.get_or_create(
                project=project, user=user, defaults={"role": role}
            )
            if not created and m.role != role:
                m.role = role
                m.save(update_fields=["role"])
            return Response(
                ProjectMembershipSerializer(m).data,
                status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
            )
        qs = project.memberships.select_related("user").order_by("user__username")
        return Response(
            results_envelope(ProjectMembershipSerializer(qs, many=True).data)
        )

    @action(
        detail=True, methods=["delete"],
        url_path=r"members/(?P<user_id>\d+)", permission_classes=[IsAdminRole],
    )
    def delete_member(self, request, slug=None, user_id=None):
        project = self.get_object()
        get_object_or_404(project.memberships, user_id=user_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(
        detail=True, methods=["get"],
        url_path="annotators-progress", permission_classes=[IsAdminRole],
    )
    def annotators_progress(self, request, slug=None):
        """Avancement par annotateur (supervision admin) — assigné / démarré / soumis."""
        project = self.get_object()
        submitted = ["submitted", "in_review", "approved"]
        rows = []
        for m in project.memberships.select_related("user").order_by("user__username"):
            u = m.user
            assigned = project.assignments.filter(assignee=u).count()
            anns = project.annotations.filter(annotator=u)
            done = anns.filter(status__in=submitted).count()
            rows.append(
                {
                    "user_id": u.id,
                    "username": u.username,
                    "display_name": u.display_name,
                    "role": m.role,
                    "assigned": assigned,
                    "started": anns.count(),
                    "submitted": done,
                    "pct": round(100 * done / assigned) if assigned else 0,
                }
            )
        return Response(results_envelope(rows))

    @action(detail=True, methods=["get"], url_path="documents")
    def documents(self, request, slug=None):
        """Documents du projet — **une ligne PAR document** (jamais dupliqué, ADR‑001).

        Ressource document‑centrée qui remplace l'usage de ``/assignments`` pour
        bâtir les listes de documents (la duplication ×N venait de l'affichage
        d'assignations, 1 ligne par couple document×annotateur).

        Chaque entrée porte :
        - ``document`` : le résumé du document ;
        - ``my_session`` : MA session sur ce document (l'``Annotation`` de
          l'utilisateur courant), avec statut/avancement — ``None`` si anonyme ;
        - ``sessions`` + ``sessions_summary`` : matrice document × annotateur
          (avancement de chaque membre) — **réservés admin/lead** (supervision),
          omis sinon. ``?mine=1`` force la vue annotateur même pour un admin.
        """
        from django.db.models import Count

        from claire.annotations.models import Annotation
        from claire.common.identity import display_name, user_color
        from claire.translations.models import Translation

        project = self.get_object()
        user = request.user
        is_lead = project.memberships.filter(
            user=user, role=MembershipRole.LEAD
        ).exists()
        is_supervisor = bool(getattr(user, "is_admin_role", False)) or is_lead
        mine_only = request.query_params.get("mine") in ("1", "true", "True")
        expose_sessions = is_supervisor and not mine_only

        documents = list(project.corpus.documents.all().order_by("external_id"))

        # Index (document_id, assignee_id) -> True : présence d'assignation.
        assign_idx = {
            (a["document_id"], a["assignee_id"])
            for a in project.assignments.values("document_id", "assignee_id")
        }
        # Index (document_id, annotator_id) -> annotation (id, status, n_clauses).
        ann_idx = {
            (an["document_id"], an["annotator_id"]): an
            for an in Annotation.objects.filter(project=project)
            .annotate(n_clauses=Count("clauses", distinct=True))
            .values(
                "id", "document_id", "annotator_id", "status", "n_clauses", "locked"
            )
        }
        # Une seule requête pour le voyant « traduction disponible » (évite le N+1).
        translated_ids = set(
            Translation.objects.filter(document__in=documents)
            .values_list("document_id", flat=True)
            .distinct()
        )
        # Membres qui ANNOTENT (annotator + lead). Le reviewer ne tient pas de session.
        session_members = [
            m.user
            for m in project.memberships.select_related("user")
            .filter(role__in=[MembershipRole.ANNOTATOR, MembershipRole.LEAD])
            .order_by("user__username")
        ]
        submitted = {"submitted", "in_review", "approved"}

        def session_for(doc, member):
            an = ann_idx.get((doc.id, member.id))
            return {
                "annotator_id": member.id,
                "username": member.username,
                "display_name": display_name(member),
                "color": user_color(member.id),
                "assigned": (doc.id, member.id) in assign_idx,
                "status": an["status"] if an else "unstarted",
                "annotation_id": an["id"] if an else None,
                "n_clauses": an["n_clauses"] if an else 0,
                # Verrou de la session (soumission auto OU verrou manuel) : permet
                # d'afficher « verrouillé » sur les pages projet, indépendamment du statut.
                "locked": bool(an["locked"]) if an else False,
            }

        def doc_summary(doc):
            return {
                "id": doc.id,
                "external_id": doc.external_id,
                "title": doc.title,
                "language": doc.language,
                "n_sentences": doc.n_sentences,
                "has_translation": doc.id in translated_ids,
            }

        results = []
        for doc in documents:
            row = {
                "document": doc_summary(doc),
                "my_session": (
                    session_for(doc, user)
                    if getattr(user, "is_authenticated", False)
                    else None
                ),
            }
            if expose_sessions:
                sessions = [session_for(doc, m) for m in session_members]
                row["sessions"] = sessions
                row["sessions_summary"] = {
                    "assigned": sum(1 for s in sessions if s["assigned"]),
                    "started": sum(1 for s in sessions if s["status"] != "unstarted"),
                    "submitted": sum(1 for s in sessions if s["status"] in submitted),
                }
            results.append(row)

        return Response(results_envelope(results))

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
        # Concordance de MON annotation avec les modèles LLM (point 4) — agrégée sur
        # mes documents de la campagne ; None si rien à comparer.
        concordance = (
            project_concordance(project, request.user)
            if getattr(request.user, "is_authenticated", False)
            else None
        )
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
                "concordance": concordance,
            }
        )

    @action(detail=True, methods=["get"])
    def iaa(self, request, slug=None):
        """IAA détaillé (R3) : moyenne + matrice PAIRE-À-PAIRE par document + détail.

        `pairs` = [{document, annotatorA, annotatorB, kappa, nSentences}] permet de
        repérer OÙ l'accord chute (quel document, quelle paire) ; l'export CSV est
        fait côté client à partir de ce tableau.
        """
        project = self.get_object()
        data = project_iaa(project)
        return Response(
            {
                "mean_kappa": data["mean_kappa"],
                "pairs": data["pairs"],
                "detail": project_iaa_detail(project),
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

    # --- exports (feature 5) : EN TÂCHE DE FOND -----------------------------
    @action(detail=True, methods=["get", "post"], permission_classes=[IsAdminRole])
    def exports(self, request, slug=None):
        """GET = historique des jobs récents ; POST = lance un export EN TÂCHE DE FOND
        (202, non bloquant). L'UI suit ensuite le statut via GET /exports/{id}."""
        from claire.exports.models import ExportJob
        from claire.exports.serializers import ExportJobSerializer
        from claire.exports.services import run_export_async

        project = self.get_object()
        if request.method == "POST":
            job = ExportJob.objects.create(
                project=project,
                format=request.data.get("format", "jsonl"),
                scope=request.data.get("scope", {}),
                requested_by=request.user,
            )
            run_export_async(job.id)  # thread daemon (ou inline en test) — ne bloque pas
            job.refresh_from_db()
            return Response(
                ExportJobSerializer(job).data, status=status.HTTP_202_ACCEPTED
            )
        qs = project.export_jobs.select_related("requested_by")[:50]
        return Response(results_envelope(ExportJobSerializer(qs, many=True).data))

    # --- résolution GOLD (module de décision du gold standard) ---------------
    # NB : DRF ordonne les @action alphabétiquement par NOM de méthode pour bâtir les
    # URLs. `gold_cockpit` doit trier AVANT `gold_detail` (regex `gold/<id>`) pour que
    # le chemin littéral `gold/documents` matche en premier (sinon capturé comme id).
    @action(detail=True, methods=["get"], url_path="gold/documents")
    def gold_cockpit(self, request, slug=None):
        """Cockpit GOLD : une ligne PAR document (statut/avancement/verrou/répartition)."""
        from django.db.models import Count, Q

        from claire.annotations.models import Annotation
        from claire.gold.config import annotation_statuses
        from claire.gold.models import GoldSentence
        from claire.gold.services import lock_state

        project = self.get_object()
        documents = list(project.corpus.documents.all().order_by("external_id"))
        res_by_doc = {
            r.document_id: r
            for r in project.gold_resolutions.select_related("locked_by").prefetch_related("arbiters")
        }
        # Une SEULE agrégation GROUP BY pour tous les documents (pas de N+1).
        counts = {
            row["resolution_id"]: {k: v for k, v in row.items() if k != "resolution_id"}
            for row in GoldSentence.objects.filter(resolution__project=project)
            .values("resolution_id")
            .annotate(
                decided=Count("id", filter=Q(decided=True)),
                auto=Count("id", filter=Q(auto_resolved=True)),
                strict=Count("id", filter=Q(agreement_class="strict")),
                majority=Count("id", filter=Q(agreement_class="majority")),
                divergence=Count("id", filter=Q(agreement_class="divergence")),
                high_risk=Count("id", filter=Q(risk_band="high")),
            )
        }
        # Complétude des annotations (batch) : annotateurs attendus vs soumis, par document.
        member_ids = set(
            project.memberships.filter(role=MembershipRole.ANNOTATOR).values_list("user_id", flat=True)
        )
        assigned_by_doc: dict = {}
        for a in project.assignments.filter(assignee_id__in=member_ids).values("document_id", "assignee_id"):
            assigned_by_doc.setdefault(a["document_id"], set()).add(a["assignee_id"])
        gold_grade = annotation_statuses(project)
        # Annotateurs ayant RÉELLEMENT une annotation (repli sans assignation) + soumis.
        annotated_by_doc: dict = {}
        submitted_by_doc: dict = {}
        for an in Annotation.objects.filter(project=project, annotator_id__in=member_ids).values(
            "document_id", "annotator_id", "status"
        ):
            annotated_by_doc.setdefault(an["document_id"], set()).add(an["annotator_id"])
            if an["status"] in gold_grade:
                submitted_by_doc.setdefault(an["document_id"], set()).add(an["annotator_id"])

        rows = []
        for doc in documents:
            r = res_by_doc.get(doc.id)
            lock = lock_state(r) if r else {"locked": False, "locked_by": None}
            expected = assigned_by_doc.get(doc.id) or annotated_by_doc.get(doc.id, set())
            submitted = (submitted_by_doc.get(doc.id, set()) & expected)
            ready = bool(expected) and len(submitted) >= len(expected)
            decided = (counts.get(r.id, {}).get("decided", 0) if r else 0)
            n = doc.n_sentences or 0
            if not ready:
                status_eff = "awaiting"
            elif r and r.finalized_at is not None:
                status_eff = "resolved"
            elif decided == 0:
                status_eff = "ready"
            else:
                status_eff = "in_progress"
            rows.append({
                "document": {
                    "id": doc.id,
                    "external_id": doc.external_id,
                    "title": doc.title,
                    "n_sentences": doc.n_sentences,
                },
                "status": status_eff,
                "pct_resolved": r.pct_resolved if r else 0.0,
                "readiness": {
                    "expected": len(expected),
                    "submitted": len(submitted),
                    "missing": len(expected) - len(submitted),
                    "ready": ready,
                },
                "finalized": bool(r and r.finalized_at is not None),
                "locked": lock["locked"],          # tient compte de l'expiration du bail
                "locked_by": lock["locked_by"],
                "counts": counts.get(r.id, {}) if r else {},
                "arbiters": [u.username for u in r.arbiters.all()] if r else [],
            })
        return Response(results_envelope(rows))

    # NB : `gold_concordance` (chemin gold/stats) doit trier AVANT `gold_detail`
    # (regex gold/<id>) — nom de méthode 'gold_co…' < 'gold_de…'.
    @action(detail=True, methods=["get"], url_path="gold/stats")
    def gold_concordance(self, request, slug=None):
        """Stats de concordance : A↔GOLD (qui est le plus proche), LLM↔GOLD, et A↔A (IAA)."""
        from claire.gold.stats import gold_stats

        project = self.get_object()
        data = gold_stats(project)
        try:
            data["iaa"] = project_iaa(project)
        except Exception:  # noqa: BLE001 — l'IAA ne doit jamais casser l'écran stats
            data["iaa"] = None
        return Response(data)

    # NB : nom de méthode `gold_annotators_llm` (trie AVANT `gold_detail`) pour que le
    # chemin littéral `gold/llm-annotators` matche avant la regex `gold/<id>`.
    @action(detail=True, methods=["get", "post"], url_path="gold/llm-annotators")
    def gold_annotators_llm(self, request, slug=None):
        """Promouvoir des juges LLM en COMPTES ANNOTATEURS (ou les retirer). Admin/lead.

        POST body {judge, action: 'add'|'remove'} → crée le compte <judge> + annotations
        SOUMISES dérivées de ses pré-annotations, ou les retire."""
        from claire.gold.llm_seed import (
            add_llm_annotator,
            llm_annotator_status,
            remove_llm_annotator,
        )

        project = self.get_object()
        if request.method == "GET":
            return Response(results_envelope(llm_annotator_status(project)))

        is_lead = project.memberships.filter(
            user=request.user, role=MembershipRole.LEAD
        ).exists()
        if not (getattr(request.user, "is_admin_role", False) or is_lead):
            return Response(
                {"detail": "Réservé aux administrateurs et leads."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if project.locked:
            from claire.common.exceptions import Locked

            raise Locked("Projet verrouillé : configuration gelée.")
        judge = request.data.get("judge")
        action_ = request.data.get("action")
        if judge not in {"claude", "codex", "mistral"}:
            return Response({"detail": "juge inconnu."}, status=status.HTTP_400_BAD_REQUEST)
        if action_ == "add":
            return Response(add_llm_annotator(project, judge))
        if action_ == "remove":
            return Response(remove_llm_annotator(project, judge))
        return Response({"detail": "action invalide (add|remove)."}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["get", "patch"], url_path="gold/config")
    def gold_config(self, request, slug=None):
        """Studio de config de la résolution (admin/lead) : GET la config, PATCH la met à jour.

        Le champ `arbiters` (usernames) définit NOMINATIVEMENT qui peut arbitrer ; il est
        validé contre les membres du projet (l'autocomplétion ne propose qu'eux)."""
        from claire.gold.config import (
            resolution_config_full,
            save_resolution_config,
            validate_resolution_config,
        )

        project = self.get_object()
        if request.method == "GET":
            return Response(resolution_config_full(project))

        # PATCH — réservé admin/lead, refusé si projet gelé.
        is_lead = project.memberships.filter(
            user=request.user, role=MembershipRole.LEAD
        ).exists()
        if not (getattr(request.user, "is_admin_role", False) or is_lead):
            return Response(
                {"detail": "Réservé aux administrateurs et leads."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if project.locked:
            from claire.common.exceptions import Locked

            raise Locked("Projet verrouillé : configuration gelée.")
        try:
            cfg = validate_resolution_config(request.data, project)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(save_resolution_config(project, cfg, actor=request.user))

    # ── helper commun : (project, document, resolution|None) SANS création ──
    def _gold_ctx(self, document_id):
        project = self.get_object()
        document = get_object_or_404(project.corpus.documents, external_id=document_id)
        resolution = (
            project.gold_resolutions.select_related("locked_by")
            .filter(document=document).first()
        )
        return project, document, resolution

    @action(detail=True, methods=["get"], url_path=r"gold/(?P<document_id>[^/.]+)")
    def gold_detail(self, request, slug=None, document_id=None):
        """Atelier de résolution d'un document : votes par phrase + proposition du moteur.

        Recalcule (synchrone, pur) la proposition et applique l'auto-résolution des cas
        peu risqués, sans jamais écraser une décision humaine."""
        from claire.gold.services import resolve_and_payload

        project = self.get_object()
        document = get_object_or_404(project.corpus.documents, external_id=document_id)
        return Response(resolve_and_payload(project, document, user=request.user))

    @action(detail=True, methods=["post"], url_path=r"gold/(?P<document_id>[^/.]+)/decide")
    def gold_decide(self, request, slug=None, document_id=None):
        """Décision gold HUMAINE d'une phrase (réservé arbitres ; refusé si projet gelé)."""
        from claire.common.exceptions import Locked
        from claire.gold.services import (
            assert_resolution_ready,
            decide_sentence,
            get_or_create_resolution,
            is_arbiter,
        )

        project, document, resolution = self._gold_ctx(document_id)
        # Contrôles AVANT toute écriture (pas de création de résolution sur refus).
        if not is_arbiter(request.user, project, resolution):
            return Response(
                {"detail": "Réservé aux arbitres (lead, reviewer ou administrateur)."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if project.locked:
            raise Locked("Projet verrouillé par un administrateur : arbitrage gelé.")
        assert_resolution_ready(project, document)  # 409 si annotations incomplètes
        # Validation de la requête (400) AVANT de matérialiser / contrôler le verrou.
        try:
            index = int(request.data.get("index"))
        except (TypeError, ValueError):
            return Response({"detail": "index requis."}, status=status.HTTP_400_BAD_REQUEST)
        primary = request.data.get("primary")
        if not primary:
            return Response({"detail": "primary requis."}, status=status.HTTP_400_BAD_REQUEST)
        if index < 0 or index >= (document.n_sentences or 0):
            return Response({"detail": "index hors document."}, status=status.HTTP_400_BAD_REQUEST)
        secondaries = request.data.get("secondaries") or []

        if resolution is None:
            resolution = get_or_create_resolution(project, document)
        try:
            gs = decide_sentence(  # exclusivité + écriture sous verrou de ligne (409 si autre)
                resolution, index, primary, secondaries,
                request.data.get("comment", ""), request.user,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({
            "index": gs.index,
            "decided": gs.decided,
            "auto_resolved": gs.auto_resolved,
            "primary": gs.primary_theme.code if gs.primary_theme else "",
            "secondaries": gs.secondaries,
            "status": resolution.status,
            "pct_resolved": resolution.pct_resolved,
        })

    @action(detail=True, methods=["post"], url_path=r"gold/(?P<document_id>[^/.]+)/auto-resolve")
    def gold_auto_resolve(self, request, slug=None, document_id=None):
        """Applique l'auto-résolution (accord absolu + cas peu risqués) sur tout le document."""
        from claire.common.exceptions import Locked
        from claire.gold.services import (
            assert_resolution_ready,
            auto_resolve_document,
            get_or_create_resolution,
            is_arbiter,
        )

        project, document, resolution = self._gold_ctx(document_id)
        if not is_arbiter(request.user, project, resolution):
            return Response(
                {"detail": "Réservé aux arbitres (lead, reviewer ou administrateur)."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if project.locked:
            raise Locked("Projet verrouillé par un administrateur : arbitrage gelé.")
        assert_resolution_ready(project, document)  # 409 si annotations incomplètes
        if resolution is None:
            resolution = get_or_create_resolution(project, document)
        summary = auto_resolve_document(resolution, request.user)  # exclusivité sous verrou
        return Response({**summary, "status": resolution.status, "pct_resolved": resolution.pct_resolved})

    @action(detail=True, methods=["post"], url_path=r"gold/(?P<document_id>[^/.]+)/submit")
    def gold_finalize(self, request, slug=None, document_id=None):
        """Soumet (finalise) la résolution du document — statut « résolu »."""
        from claire.common.exceptions import Locked
        from claire.gold.services import finalize_resolution, get_or_create_resolution, is_arbiter

        project, document, resolution = self._gold_ctx(document_id)
        if not is_arbiter(request.user, project, resolution):
            return Response({"detail": "Réservé aux arbitres."}, status=status.HTTP_403_FORBIDDEN)
        if project.locked:
            raise Locked("Projet verrouillé par un administrateur : arbitrage gelé.")
        if resolution is None:
            resolution = get_or_create_resolution(project, document)
        finalize_resolution(resolution, request.user)
        return Response({"status": "resolved", "finalized": True})

    @action(detail=True, methods=["post"], url_path=r"gold/(?P<document_id>[^/.]+)/reopen")
    def gold_reopen(self, request, slug=None, document_id=None):
        """Rouvre une résolution finalisée (corrections) — réservé lead/admin."""
        from claire.gold.services import get_or_create_resolution, reopen_resolution

        project, document, resolution = self._gold_ctx(document_id)
        is_lead = project.memberships.filter(user=request.user, role=MembershipRole.LEAD).exists()
        if not (getattr(request.user, "is_admin_role", False) or is_lead):
            return Response({"detail": "Réservé aux leads et administrateurs."}, status=status.HTTP_403_FORBIDDEN)
        if resolution is None:
            resolution = get_or_create_resolution(project, document)
        reopen_resolution(resolution, request.user)
        return Response({"status": "in_progress", "finalized": False})

    # --- verrou d'arbitrage exclusif (bail auto-expirant ; temps réel) -------
    def _gold_arbiter_guard(self, request, document_id, *, check_project_lock):
        """(project, document, resolution, None) si OK, sinon (…, Response). Pas de création
        de résolution sur refus. `check_project_lock` lève Locked (423) si projet gelé."""
        from claire.common.exceptions import Locked
        from claire.gold.services import get_or_create_resolution, is_arbiter

        project, document, resolution = self._gold_ctx(document_id)
        if not is_arbiter(request.user, project, resolution):
            return None, None, None, Response(
                {"detail": "Réservé aux arbitres (lead, reviewer ou administrateur)."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if check_project_lock and project.locked:
            raise Locked("Projet verrouillé par un administrateur : arbitrage gelé.")
        if resolution is None:
            resolution = get_or_create_resolution(project, document)
        return project, document, resolution, None

    @action(detail=True, methods=["post"], url_path=r"gold/(?P<document_id>[^/.]+)/lock")
    def gold_lock_acquire(self, request, slug=None, document_id=None):
        """Acquiert le verrou d'arbitrage (bail 90 s). 409 si tenu par un autre arbitre."""
        from claire.common.exceptions import Conflict
        from claire.gold.services import acquire_lock, lock_state

        _, _, resolution, err = self._gold_arbiter_guard(request, document_id, check_project_lock=True)
        if err:
            return err
        ok, resolution = acquire_lock(resolution, request.user)
        if not ok:
            holder = resolution.locked_by
            raise Conflict(
                f"Document en cours d'arbitrage par {holder.username if holder else 'un autre arbitre'}."
            )
        return Response(lock_state(resolution, request.user))

    @action(detail=True, methods=["post"], url_path=r"gold/(?P<document_id>[^/.]+)/lock/heartbeat")
    def gold_lock_heartbeat(self, request, slug=None, document_id=None):
        """Prolonge le bail. 409 si le verrou a été perdu (expiré/repris)."""
        from claire.common.exceptions import Conflict
        from claire.gold.services import heartbeat_lock, lock_state

        _, _, resolution, err = self._gold_arbiter_guard(request, document_id, check_project_lock=True)
        if err:
            return err
        ok, resolution = heartbeat_lock(resolution, request.user)
        if not ok:
            raise Conflict("Verrou d'arbitrage perdu (expiré ou repris).")
        return Response(lock_state(resolution, request.user))

    @action(detail=True, methods=["post"], url_path=r"gold/(?P<document_id>[^/.]+)/lock/release")
    def gold_lock_release(self, request, slug=None, document_id=None):
        """Libère le verrou (idempotent ; autorisé même projet gelé). 409 si tenu par un autre."""
        from claire.common.exceptions import Conflict
        from claire.gold.services import lock_state, release_lock

        _, _, resolution, err = self._gold_arbiter_guard(request, document_id, check_project_lock=False)
        if err:
            return err
        ok, resolution = release_lock(resolution, request.user)
        if not ok:
            raise Conflict("Verrou tenu par un autre arbitre.")
        return Response(lock_state(resolution, request.user))

    @action(detail=True, methods=["post"], url_path=r"gold/(?P<document_id>[^/.]+)/lock/steal")
    def gold_lock_steal(self, request, slug=None, document_id=None):
        """Reprise du verrou — réservée aux leads/admin (tracée ; refusée si projet gelé)."""
        from claire.common.exceptions import Locked
        from claire.gold.services import get_or_create_resolution, lock_state, steal_lock

        project, document, resolution = self._gold_ctx(document_id)
        is_lead = project.memberships.filter(
            user=request.user, role=MembershipRole.LEAD
        ).exists()
        if not (getattr(request.user, "is_admin_role", False) or is_lead):
            return Response(
                {"detail": "Reprise réservée aux leads et administrateurs."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if project.locked:
            raise Locked("Projet verrouillé par un administrateur : arbitrage gelé.")
        if resolution is None:
            resolution = get_or_create_resolution(project, document)
        resolution = steal_lock(resolution, request.user)
        return Response(lock_state(resolution, request.user))


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

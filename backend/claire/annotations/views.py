import logging

from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from claire.collaboration.models import Comment, Review, ReviewDecision
from claire.collaboration.serializers import CommentSerializer, ReviewSerializer
from claire.common.exceptions import Conflict
from claire.common.pagination import results_envelope
from claire.common.permissions import (
    IsAnnotationOwnerOrReviewer,
    IsReviewerOrAdmin,
)
from claire.imports.models import PreAnnotation
from claire.imports.services import seed_annotation_from_preannotation

from .models import Annotation, AnnotationStatus, Clause
from .serializers import (
    AnnotationDetailSerializer,
    AnnotationListSerializer,
    AnnotationVersionSerializer,
    AnnotationWriteSerializer,
    ClauseSerializer,
)
from .services import (
    create_version,
    diff_versions,
    transition_status,
)

logger = logging.getLogger("claire.annotations")


class AnnotationViewSet(viewsets.ModelViewSet):
    queryset = Annotation.objects.select_related(
        "project", "project__scheme", "document", "annotator"
    ).prefetch_related("clauses__theme", "clauses__anchor_sentence")
    permission_classes = [IsAnnotationOwnerOrReviewer]
    filter_backends = [DjangoFilterBackend]
    # project/document/annotator are handled manually in get_queryset so they
    # accept BOTH a numeric PK and the human key the frontend sends (project
    # slug, document external_id, annotator username — see endpoints.ts).
    filterset_fields = {
        "status": ["exact"],
    }

    def get_serializer_class(self):
        if self.action == "list":
            return AnnotationListSerializer
        if self.action in {"update", "partial_update"}:
            return AnnotationWriteSerializer
        return AnnotationDetailSerializer

    def get_queryset(self):
        from django.db.models import Count

        qs = super().get_queryset()
        # Avoid N+1 on the list serializer's clause count (perf audit M9):
        # one annotated COUNT instead of one query per row. Keep a stable
        # ordering for pagination (annotate can otherwise drop Meta ordering).
        qs = qs.annotate(n_clauses_agg=Count("clauses", distinct=True)).order_by(
            "-updated_at"
        )
        # Project isolation (A01 / security.md §2): non-privileged users only
        # see annotations of projects they belong to (or that they authored).
        # Admins/owners and reviewers (cross-project quality role) keep full
        # reach.
        from django.db.models import Q

        user = self.request.user
        if not (
            getattr(user, "is_admin_role", False)
            or getattr(user, "role", None) == "reviewer"
        ):
            qs = qs.filter(
                Q(project__memberships__user=user) | Q(annotator=user)
            ).distinct()
        # support ?project=<slug|pk>, ?document=<external_id|pk>,
        # ?annotator=<username|pk> (frontend sends the human keys).
        project = self.request.query_params.get("project")
        if project:
            qs = qs.filter(project__pk=project) if project.isdigit() else (
                qs.filter(project__slug=project)
            )
        document = self.request.query_params.get("document")
        if document:
            qs = qs.filter(document__pk=document) if document.isdigit() else (
                qs.filter(document__external_id=document)
            )
        annotator = self.request.query_params.get("annotator")
        if annotator:
            qs = qs.filter(annotator__pk=annotator) if annotator.isdigit() else (
                qs.filter(annotator__username=annotator)
            )
        return qs

    def create(self, request, *args, **kwargs):
        """POST /annotations — optional seed=preannotation:<judge> (INV-4 idempotent)."""
        from claire.corpora.models import Document
        from claire.projects.models import Project

        data = request.data
        project = get_object_or_404(
            Project, slug=data.get("project") or data.get("project_slug")
        )
        document = get_object_or_404(
            Document, external_id=data.get("document") or data.get("document_id"),
            corpus=project.corpus,
        )

        seed = data.get("seed")  # e.g. "preannotation:claude"
        if seed and seed.startswith("preannotation:"):
            judge = seed.split(":", 1)[1]
            pre = get_object_or_404(
                PreAnnotation, project=project, document=document, judge=judge
            )
            annotation = seed_annotation_from_preannotation(pre, request.user)
            return Response(
                AnnotationDetailSerializer(annotation).data,
                status=status.HTTP_201_CREATED,
            )

        # Plain human annotation; enforce INV-4 idempotency.
        annotation, created = Annotation.objects.get_or_create(
            project=project, document=document, annotator=request.user
        )
        code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(AnnotationDetailSerializer(annotation).data, status=code)

    def partial_update(self, request, *args, **kwargs):
        annotation = self.get_object()
        ser = AnnotationWriteSerializer(annotation, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        new_status = ser.validated_data.get("status")
        certainty = ser.validated_data.get("global_certainty", "__nochange__")

        if certainty != "__nochange__":
            annotation.global_certainty = certainty
            annotation.save(update_fields=["global_certainty", "updated_at"])
        if new_status and new_status != annotation.status:
            transition_status(annotation, new_status, request.user)
        return Response(AnnotationDetailSerializer(annotation).data)

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        annotation = self.get_object()
        transition_status(annotation, AnnotationStatus.SUBMITTED, request.user)
        return Response(AnnotationDetailSerializer(annotation).data)

    # --- clauses ----------------------------------------------------------
    @action(detail=True, methods=["post"], url_path="clauses")
    def add_clause(self, request, pk=None):
        annotation = self.get_object()
        ser = ClauseSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        attrs = ser._resolve(annotation, dict(ser.validated_data))
        if "anchor_sentence" not in attrs or "theme" not in attrs:
            return Response(
                {"detail": "anchorIndex and theme are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if annotation.clauses.filter(
            anchor_sentence=attrs["anchor_sentence"]
        ).exists():
            raise Conflict("A clause already starts on this sentence (INV-2).")
        attrs.setdefault("order", annotation.clauses.count())
        clause = Clause.objects.create(annotation=annotation, **attrs)
        return Response(
            ClauseSerializer(clause).data, status=status.HTTP_201_CREATED
        )

    # --- versions ---------------------------------------------------------
    @action(detail=True, methods=["get", "post"])
    def versions(self, request, pk=None):
        annotation = self.get_object()
        if request.method == "POST":
            version = create_version(
                annotation, author=request.user,
                label=request.data.get("label", ""),
            )
            return Response(
                AnnotationVersionSerializer(version).data,
                status=status.HTTP_201_CREATED,
            )
        qs = annotation.versions.select_related("author")
        return Response(results_envelope(AnnotationVersionSerializer(qs, many=True).data))

    @action(
        detail=True, methods=["get"],
        url_path=r"versions/(?P<number>\d+)/diff",
    )
    def version_diff(self, request, pk=None, number=None):
        """Diff au format CONTRAT (consommé par DiffView) :
        {from:{number,label}, to:{number,label}, clauses:[{anchorIndex,status,
        before,after,changedFields}], summary:{added,removed,modified,unchanged}}.
        `?against=` choisit la base (0/absent → version précédente ; sinon ce numéro)."""
        annotation = self.get_object()
        n = int(number)
        target = get_object_or_404(annotation.versions, number=n)

        against = request.query_params.get("against")
        if against not in (None, "", "0"):
            base = annotation.versions.filter(number=int(against)).first()
        else:
            base = annotation.versions.filter(number__lt=n).order_by("-number").first()

        # Champs comparés → nom camelCase exposé dans changed_fields.
        fields = {
            "theme": "theme",
            "legal_nature": "legalNature",
            "evidence_span": "evidenceSpan",
            "rationale": "rationale",
            "certainty": "certainty",
        }

        def by_anchor(snap):
            return {c["anchor_index"]: c for c in (snap or {}).get("clauses", [])}

        old = by_anchor(base.snapshot) if base else {}
        new = by_anchor(target.snapshot)
        clauses = []
        added = removed = modified = unchanged = 0
        for k in sorted(set(old) | set(new)):
            o, nw = old.get(k), new.get(k)
            if o is None:
                status_ = "added"; added += 1
            elif nw is None:
                status_ = "removed"; removed += 1
            else:
                changed = [camel for snake, camel in fields.items() if o.get(snake) != nw.get(snake)]
                if changed:
                    status_ = "modified"; modified += 1
                else:
                    status_ = "unchanged"; unchanged += 1
            clauses.append(
                {
                    "anchor_index": k,
                    "status": status_,
                    "before": o,
                    "after": nw,
                    "changed_fields": (
                        [camel for snake, camel in fields.items() if (o or {}).get(snake) != (nw or {}).get(snake)]
                        if (o and nw)
                        else []
                    ),
                }
            )
        return Response(
            {
                "annotation_id": annotation.pk,
                "from": {"number": base.number if base else 0, "label": base.label if base else "∅"},
                "to": {"number": target.number, "label": target.label},
                "clauses": clauses,
                "summary": {
                    "added": added,
                    "removed": removed,
                    "modified": modified,
                    "unchanged": unchanged,
                },
            }
        )

    # --- comments ---------------------------------------------------------
    @action(detail=True, methods=["get", "post"])
    def comments(self, request, pk=None):
        annotation = self.get_object()
        if request.method == "POST":
            ser = CommentSerializer(data=request.data)
            ser.is_valid(raise_exception=True)
            comment = Comment.objects.create(
                annotation=annotation, author=request.user,
                **ser.build_comment_kwargs(annotation),
            )
            return Response(
                CommentSerializer(comment).data, status=status.HTTP_201_CREATED
            )
        qs = annotation.comments.select_related("author")
        return Response(results_envelope(CommentSerializer(qs, many=True).data))

    # --- attribution (point 3) -------------------------------------------
    @action(detail=True, methods=["get"])
    def attribution(self, request, pk=None):
        """GET /annotations/{id}/attribution?by=clause|sentence — dernier auteur par
        cible. Dérivé des clauses (auteur = annotateur de l'annotation), couleur
        d'identité déterministe. Renvoie {by, results:[{index,actorId,...}]}."""
        from claire.common.identity import display_name, user_color

        annotation = self.get_object()
        by = "sentence" if request.query_params.get("by") == "sentence" else "clause"
        actor = annotation.annotator
        results = [
            {
                "index": c.anchor_sentence.index,
                "actor_id": actor.pk if actor else None,
                "actor_name": display_name(actor),
                "actor_color": user_color(actor.pk if actor else 0),
                "verb": "clause.create",
                "at": annotation.updated_at.isoformat(),
            }
            for c in annotation.clauses.select_related("anchor_sentence").all()
        ]
        return Response({"by": by, "results": results})

    # --- présence (points 4b/7) ------------------------------------------
    @action(detail=True, methods=["get"])
    def presence(self, request, pk=None):
        """GET /annotations/{id}/presence — participants actifs. Sans backend WS, on
        renvoie l'utilisateur courant (présence minimale, non temps réel)."""
        from claire.common.identity import display_name, user_color

        self.get_object()
        u = request.user
        results = [
            {
                "user_id": u.pk,
                "name": display_name(u),
                "color": user_color(u.pk),
                "focus_sentence": None,
                "active": True,
            }
        ]
        return Response({"count": len(results), "results": results})

    # --- reviews ----------------------------------------------------------
    @action(
        detail=True, methods=["get", "post"],
        permission_classes=[IsReviewerOrAdmin],
    )
    def reviews(self, request, pk=None):
        annotation = self.get_object()
        if request.method == "POST":
            ser = ReviewSerializer(data=request.data)
            ser.is_valid(raise_exception=True)
            review = Review.objects.create(
                annotation=annotation, reviewer=request.user,
                **ser.validated_data,
            )
            # Drive the state machine from the review decision.
            if annotation.status == AnnotationStatus.SUBMITTED:
                transition_status(
                    annotation, AnnotationStatus.IN_REVIEW, request.user
                )
            if review.decision == ReviewDecision.APPROVE:
                transition_status(
                    annotation, AnnotationStatus.APPROVED, request.user
                )
            elif review.decision == ReviewDecision.REJECT:
                transition_status(
                    annotation, AnnotationStatus.REJECTED, request.user
                )
            return Response(
                ReviewSerializer(review).data, status=status.HTTP_201_CREATED
            )
        qs = annotation.reviews.select_related("reviewer")
        return Response(results_envelope(ReviewSerializer(qs, many=True).data))


class ClauseViewSet(viewsets.ModelViewSet):
    """PATCH /clauses/{id}, DELETE /clauses/{id}."""

    queryset = Clause.objects.select_related(
        "annotation", "annotation__project__scheme", "theme", "anchor_sentence"
    )
    serializer_class = ClauseSerializer
    permission_classes = [IsAnnotationOwnerOrReviewer]
    http_method_names = ["get", "patch", "delete"]

    def get_object(self):
        obj = super().get_object()
        # Object-level permission keyed on the parent annotation.
        self.check_object_permissions(self.request, obj.annotation)
        return obj

    def partial_update(self, request, *args, **kwargs):
        clause = self.get_object()
        ser = ClauseSerializer(clause, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        attrs = ser._resolve(clause.annotation, dict(ser.validated_data))
        new_anchor = attrs.get("anchor_sentence")
        if new_anchor and clause.annotation.clauses.exclude(pk=clause.pk).filter(
            anchor_sentence=new_anchor
        ).exists():
            raise Conflict("Another clause already starts on this sentence (INV-2).")
        for field, value in attrs.items():
            setattr(clause, field, value)
        clause.save()
        return Response(ClauseSerializer(clause).data)

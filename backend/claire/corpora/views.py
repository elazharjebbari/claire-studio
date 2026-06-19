from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from claire.common.permissions import IsAdminRole

from .models import Corpus, Document
from .serializers import (
    CorpusSerializer,
    DocumentDetailSerializer,
    DocumentListSerializer,
    SentenceSerializer,
)


class CorpusViewSet(viewsets.ModelViewSet):
    """GET /corpora ; GET /corpora/{slug}/documents."""

    queryset = Corpus.objects.all()
    serializer_class = CorpusSerializer
    permission_classes = [IsAdminRole]
    lookup_field = "slug"

    @action(detail=True, methods=["get"])
    def documents(self, request, slug=None):
        corpus = self.get_object()
        qs = corpus.documents.all()
        page = self.paginate_queryset(qs)
        ser = DocumentListSerializer(page or qs, many=True)
        if page is not None:
            return self.get_paginated_response(ser.data)
        return Response(ser.data)


class DocumentViewSet(viewsets.ReadOnlyModelViewSet):
    """GET /documents/{id} (+ sentences & reference_labels) ; .../sentences."""

    queryset = Document.objects.select_related("corpus").prefetch_related(
        "sentences__reference_labels"
    )
    permission_classes = [IsAdminRole]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return DocumentDetailSerializer
        return DocumentListSerializer

    @action(detail=True, methods=["get"])
    def sentences(self, request, pk=None):
        document = self.get_object()
        qs = document.sentences.prefetch_related("reference_labels")
        page = self.paginate_queryset(qs)
        ser = SentenceSerializer(page or qs, many=True)
        if page is not None:
            return self.get_paginated_response(ser.data)
        return Response(ser.data)

    @action(detail=True, methods=["get"], url_path="annotation-versions")
    def annotation_versions(self, request, pk=None):
        """GET /documents/{id}/annotation-versions — versions LLM disponibles pour
        ce document : liste de {version, judge, nClauses}, triée. Permet à l'UI de
        proposer le choix de version (multi-versions)."""
        from django.db.models import Count

        from claire.imports.models import PreAnnotation

        document = self.get_object()
        rows = (
            PreAnnotation.objects.filter(document=document)
            .annotate(n_clauses=Count("preclauses"))
            .values("schema_version", "judge", "n_clauses")
            .order_by("schema_version", "judge")
        )
        results = [
            {"version": r["schema_version"], "judge": r["judge"], "nClauses": r["n_clauses"]}
            for r in rows
        ]
        versions = sorted({r["version"] for r in results})
        return Response({"versions": versions, "count": len(results), "results": results})

    @action(detail=True, methods=["get"])
    def translations(self, request, pk=None):
        """GET /documents/{id}/translations?lang=fr — textes traduits STOCKÉS,
        par index de phrase. Aucune traduction en ligne : on lit les `Translation`
        du jeu de la langue demandée (feature F8). Renvoie {language, results}.
        """
        from claire.translations.models import Translation

        document = self.get_object()
        lang = request.query_params.get("lang", "fr")
        rows = (
            Translation.objects.filter(
                document=document,
                translation_set__target_language=lang,
                sentence__isnull=False,
            )
            .select_related("sentence")
            .order_by("sentence__index")
        )
        results = [
            {"sentenceIndex": t.sentence.index, "text": t.text} for t in rows
        ]
        return Response({"language": lang, "count": len(results), "results": results})

    @action(detail=True, methods=["get"])
    def contributors(self, request, pk=None):
        """GET /documents/{id}/contributors — annotateurs ayant contribué (+ couleurs).
        Point 3 (attribution multi-annotateurs)."""
        from claire.annotations.models import Annotation
        from claire.common.identity import display_name, user_color

        document = self.get_object()
        seen, results = set(), []
        for ann in (
            Annotation.objects.filter(document=document).select_related("annotator")
        ):
            u = ann.annotator
            if u is None or u.pk in seen:
                continue
            seen.add(u.pk)
            results.append(
                {
                    "user_id": u.pk,
                    "name": display_name(u),
                    "color": user_color(u.pk),
                    "role": getattr(u, "role", "annotator") or "annotator",
                }
            )
        return Response({"count": len(results), "results": results})

    @action(detail=True, methods=["get"], url_path="sentence-history")
    def sentence_history(self, request, pk=None):
        """GET /documents/{id}/sentence-history?index=N — évolution de l'annotation
        d'une phrase à travers annotateurs & versions (point 6). Projection des
        snapshots de versions (immuables) à l'ancre demandée."""
        from claire.annotations.models import Annotation
        from claire.common.identity import display_name, user_color

        document = self.get_object()
        try:
            index = int(request.query_params.get("index", "-1"))
        except (TypeError, ValueError):
            index = -1

        results = []
        if index >= 0:
            pairs = []
            for ann in Annotation.objects.filter(document=document).select_related(
                "annotator"
            ):
                for v in ann.versions.select_related("author").all():
                    pairs.append((ann, v))
            pairs.sort(key=lambda av: av[1].created_at)
            for ann, v in pairs:
                clauses = (v.snapshot or {}).get("clauses", [])
                match = next(
                    (c for c in clauses if c.get("anchor_index") == index), None
                )
                if not match:
                    continue
                actor = v.author or ann.annotator
                results.append(
                    {
                        "version": v.number,
                        "actor_id": actor.pk if actor else None,
                        "actor_name": display_name(actor),
                        "actor_color": user_color(actor.pk if actor else 0),
                        "verb": "clause.snapshot",
                        "before": None,
                        "after": match.get("theme"),
                        "rationale": match.get("rationale"),
                        "created_at": v.created_at.isoformat(),
                    }
                )
        return Response({"index": index, "count": len(results), "results": results})

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

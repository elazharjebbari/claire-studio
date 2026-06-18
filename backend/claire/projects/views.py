from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from claire.common.permissions import IsAdminRole

from .iaa import project_iaa
from .models import Project
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
        qs = project.assignments.select_related("document", "assignee")
        if not request.user.is_admin_role:
            qs = qs.filter(assignee=request.user)
        ser = AssignmentSerializer(qs, many=True)
        return Response(ser.data)

    @action(detail=True, methods=["get"])
    def progress(self, request, slug=None):
        project = self.get_object()
        status_counts = dict(
            project.annotations.values_list("status")
            .annotate(c=Count("id"))
            .values_list("status", "c")
        )
        totals = project.annotations.aggregate(
            total=Count("id"),
            submitted=Count("id", filter=Q(status="submitted")),
            approved=Count("id", filter=Q(status="approved")),
        )
        return Response(
            {
                "project": project.slug,
                "status_counts": status_counts,
                "totals": totals,
                "iaa": project_iaa(project),
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
        return Response(TranslationSetSerializer(qs, many=True).data)

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

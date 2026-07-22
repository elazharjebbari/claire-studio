from django.conf import settings
from django.db import IntegrityError
from django.db.models import Q
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from claire.common.pagination import DefaultPagination
from claire.projects.models import Project

from .metrics import registry
from .models import (
    AnalysisPreset,
    AnalysisReportArtifact,
    AnalysisTaxonomyProposal,
    ArtifactStatus,
    RunStatus,
)
from .policy import access_for, can_read_artifact
from .reports import create_report_artifact, dispatch_artifact, safe_artifact_path
from .serializers import (
    AnalysisPresetSerializer,
    AnalysisRunSerializer,
    ReportArtifactSerializer,
    ReportDetailSerializer,
    ReportListSerializer,
    SnapshotDetailSerializer,
    SnapshotListSerializer,
    TaxonomyProposalSerializer,
)
from .services import compare_reports, create_report, dispatch_run, queue_run
from .snapshots import create_snapshot


def _project_for(user, slug: str) -> Project:
    project = get_object_or_404(Project.objects.select_related("scheme"), slug=slug)
    try:
        access_for(user, project)
    except PermissionError:
        # 404 évite de révéler l'existence d'un projet privé.
        raise Http404
    return project


def _visible(queryset, user):
    if user.is_admin_role:
        return queryset
    visibility_field = (
        "visibility" if hasattr(queryset.model, "visibility") else "snapshot__visibility"
    )
    return queryset.filter(created_by=user) | queryset.filter(
        **{
            visibility_field: "project",
            "project__memberships__user": user,
            "project__memberships__role__in": ["reviewer", "lead"],
        }
    )


def _paginated(view, request, queryset, serializer_class):
    """Garde l'historique fluide sans charger tous les snapshots ou rapports."""

    paginator = DefaultPagination()
    page = paginator.paginate_queryset(queryset, request, view=view)
    return paginator.get_paginated_response(serializer_class(page, many=True).data)


class AnalysisCatalogView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        _project_for(request.user, slug)
        return Response({"contract_version": 1, "metrics": registry.catalog()})


class AnalysisHealthView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        project = _project_for(request.user, slug)
        access = access_for(request.user, project)
        runs = project.analysis_runs.all()
        artifacts = AnalysisReportArtifact.objects.filter(report__project=project)
        if access.personal_only:
            runs = runs.filter(created_by=request.user)
            artifacts = artifacts.filter(requested_by=request.user)
        return Response(
            {
                "runs": {
                    key: runs.filter(status=key).count()
                    for key in [RunStatus.QUEUED, RunStatus.RUNNING, RunStatus.FAILED]
                },
                "artifacts": {
                    key: artifacts.filter(status=key).count()
                    for key in [
                        ArtifactStatus.QUEUED,
                        ArtifactStatus.RUNNING,
                        ArtifactStatus.FAILED,
                    ]
                },
                "workerMode": settings.ANALYSIS_DISPATCH_MODE,
            }
        )


class ScopePreviewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, slug):
        project = _project_for(request.user, slug)
        access = access_for(request.user, project)
        annotations = project.annotations.all()
        if access.personal_only:
            annotations = annotations.filter(annotator=request.user)
        elif not access.may_include_other_drafts:
            annotations = annotations.filter(Q(annotator=request.user) | ~Q(status="draft"))
        include_drafts = request.data.get("include_drafts", True)
        if not isinstance(include_drafts, bool):
            return Response({"detail": "include_drafts doit être un booléen."}, status=400)
        if not include_drafts:
            annotations = annotations.exclude(status="draft")
        return Response(
            {
                "personal_only": access.personal_only,
                "includes_drafts": include_drafts,
                "annotations": annotations.count(),
                "drafts": annotations.filter(status="draft").count(),
                "documents": annotations.values("document_id").distinct().count(),
                "warnings": ["provisional_drafts"]
                if annotations.filter(status="draft").exists()
                else [],
            }
        )


class SnapshotListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        project = _project_for(request.user, slug)
        qs = _visible(project.analysis_snapshots.all(), request.user).distinct()
        return _paginated(self, request, qs, SnapshotListSerializer)

    def post(self, request, slug):
        project = _project_for(request.user, slug)
        include_drafts = request.data.get("include_drafts", True)
        if not isinstance(include_drafts, bool):
            return Response(
                {"detail": "include_drafts doit être un booléen."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        scope = request.data.get("scope", {})
        if not isinstance(scope, dict):
            return Response({"detail": "scope doit être un objet."}, status=400)
        snapshot = create_snapshot(
            project=project,
            user=request.user,
            label=str(request.data.get("label", "")),
            include_drafts=include_drafts,
            scope=scope,
        )
        return Response(SnapshotDetailSerializer(snapshot).data, status=status.HTTP_201_CREATED)


class SnapshotDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, slug, snapshot_id):
        project = _project_for(request.user, slug)
        snapshot = get_object_or_404(project.analysis_snapshots, pk=snapshot_id)
        if not can_read_artifact(request.user, snapshot):
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(SnapshotDetailSerializer(snapshot).data)


class RunListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        project = _project_for(request.user, slug)
        qs = _visible(project.analysis_runs.select_related("snapshot"), request.user).distinct()
        return _paginated(self, request, qs, AnalysisRunSerializer)

    def post(self, request, slug):
        project = _project_for(request.user, slug)
        snapshot = get_object_or_404(project.analysis_snapshots, pk=request.data.get("snapshot_id"))
        if not can_read_artifact(request.user, snapshot):
            return Response(status=status.HTTP_404_NOT_FOUND)
        metric_codes = request.data.get("metric_codes")
        if metric_codes is not None and not isinstance(metric_codes, list):
            return Response(
                {"detail": "metric_codes doit être une liste."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            run = queue_run(
                snapshot=snapshot,
                user=request.user,
                metric_codes=metric_codes,
                configuration=request.data.get("configuration", {}),
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        dispatch_run(run.id)
        run.refresh_from_db()
        response_status = (
            status.HTTP_201_CREATED
            if run.status == RunStatus.SUCCEEDED
            else status.HTTP_202_ACCEPTED
        )
        return Response(AnalysisRunSerializer(run).data, status=response_status)


class RunDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, slug, run_id):
        project = _project_for(request.user, slug)
        run = get_object_or_404(project.analysis_runs.select_related("snapshot"), pk=run_id)
        if not can_read_artifact(request.user, run.snapshot):
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(AnalysisRunSerializer(run).data)


class RunCancelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, slug, run_id):
        project = _project_for(request.user, slug)
        run = get_object_or_404(project.analysis_runs.select_related("snapshot"), pk=run_id)
        if not can_read_artifact(request.user, run.snapshot):
            return Response(status=404)
        if run.status in {RunStatus.QUEUED, RunStatus.RUNNING}:
            run.cancel_requested = True
            if run.status == RunStatus.QUEUED:
                run.status = RunStatus.CANCELED
            run.save(update_fields=["cancel_requested", "status"])
        return Response(AnalysisRunSerializer(run).data)


class RunCasesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, slug, run_id):
        project = _project_for(request.user, slug)
        run = get_object_or_404(project.analysis_runs.select_related("snapshot"), pk=run_id)
        if not can_read_artifact(request.user, run.snapshot):
            return Response(status=404)
        cases = run.result.get("pairwise_agreement", {}).get("cases", [])
        return _paginated(self, request, cases, _PlainSerializer)


class _PlainSerializer:
    def __init__(self, value, many=False):
        self.data = value


class PresetListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        project = _project_for(request.user, slug)
        qs = project.analysis_presets.filter(
            Q(created_by=request.user) | Q(is_shared=True)
        ).distinct()
        return _paginated(self, request, qs, AnalysisPresetSerializer)

    def post(self, request, slug):
        project = _project_for(request.user, slug)
        name = str(request.data.get("name", "")).strip()
        configuration = request.data.get("configuration", {})
        if not name or not isinstance(configuration, dict):
            return Response({"detail": "Nom et configuration valides requis."}, status=400)
        is_shared = request.data.get("is_shared", False)
        if not isinstance(is_shared, bool):
            return Response({"detail": "is_shared doit être un booléen."}, status=400)
        try:
            preset = AnalysisPreset.objects.create(
                project=project,
                created_by=request.user,
                name=name[:120],
                configuration=configuration,
                is_shared=is_shared and not access_for(request.user, project).personal_only,
            )
        except IntegrityError:
            return Response({"detail": "Un preset porte déjà ce nom."}, status=409)
        return Response(AnalysisPresetSerializer(preset).data, status=201)


class PresetDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get(self, request, slug, preset_id):
        project = _project_for(request.user, slug)
        return get_object_or_404(project.analysis_presets, pk=preset_id, created_by=request.user)

    def patch(self, request, slug, preset_id):
        preset = self._get(request, slug, preset_id)
        if "name" in request.data:
            preset.name = str(request.data["name"]).strip()[:120] or preset.name
        if "configuration" in request.data and isinstance(request.data["configuration"], dict):
            preset.configuration = request.data["configuration"]
        preset.save()
        return Response(AnalysisPresetSerializer(preset).data)

    def delete(self, request, slug, preset_id):
        self._get(request, slug, preset_id).delete()
        return Response(status=204)


class TaxonomyProposalListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    kinds = {"new", "rename", "merge", "split", "retire"}

    def _project(self, request, slug):
        project = _project_for(request.user, slug)
        if access_for(request.user, project).personal_only:
            raise Http404
        return project

    def get(self, request, slug):
        project = self._project(request, slug)
        return _paginated(
            self,
            request,
            project.analysis_taxonomy_proposals.select_related("report"),
            TaxonomyProposalSerializer,
        )

    def post(self, request, slug):
        project = self._project(request, slug)
        kind = request.data.get("kind")
        evidence = request.data.get("evidence", {})
        title = str(request.data.get("title", "")).strip()
        if kind not in self.kinds or not title or not isinstance(evidence, dict):
            return Response({"detail": "Proposition invalide."}, status=400)
        report = None
        if request.data.get("report"):
            report = get_object_or_404(project.analysis_reports, pk=request.data["report"])
            if not can_read_artifact(request.user, report):
                raise Http404
        proposal = AnalysisTaxonomyProposal.objects.create(
            project=project,
            report=report,
            created_by=request.user,
            kind=kind,
            theme_code=str(request.data.get("theme_code", ""))[:60],
            title=title[:200],
            rationale=str(request.data.get("rationale", "")),
            evidence=evidence,
        )
        return Response(TaxonomyProposalSerializer(proposal).data, status=201)


class TaxonomyProposalDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, slug, proposal_id):
        project = _project_for(request.user, slug)
        if access_for(request.user, project).personal_only:
            raise Http404
        proposal = get_object_or_404(project.analysis_taxonomy_proposals, pk=proposal_id)
        new_status = request.data.get("status")
        if new_status not in {"draft", "reviewed", "rejected"}:
            return Response({"detail": "Statut invalide."}, status=400)
        proposal.status = new_status
        proposal.save(update_fields=["status", "updated_at"])
        return Response(TaxonomyProposalSerializer(proposal).data)


class ReportListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        project = _project_for(request.user, slug)
        qs = _visible(project.analysis_reports.all(), request.user).distinct()
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return _paginated(self, request, qs, ReportListSerializer)

    def post(self, request, slug):
        project = _project_for(request.user, slug)
        run = get_object_or_404(
            project.analysis_runs.select_related("snapshot"), pk=request.data.get("run_id")
        )
        if run.status != RunStatus.SUCCEEDED or not can_read_artifact(request.user, run.snapshot):
            return Response(
                {"detail": "Le run doit être terminé et accessible."},
                status=status.HTTP_409_CONFLICT,
            )
        report = create_report(
            run=run,
            user=request.user,
            title=str(request.data.get("title", "")),
            description=str(request.data.get("description", "")),
        )
        return Response(ReportDetailSerializer(report).data, status=status.HTTP_201_CREATED)


class ReportDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get(self, request, slug, report_id):
        project = _project_for(request.user, slug)
        report = get_object_or_404(project.analysis_reports, pk=report_id)
        return report if can_read_artifact(request.user, report) else None

    def get(self, request, slug, report_id):
        report = self._get(request, slug, report_id)
        if report is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(ReportDetailSerializer(report).data)

    def patch(self, request, slug, report_id):
        report = self._get(request, slug, report_id)
        if report is None or report.created_by_id != request.user.id:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if "title" in request.data:
            report.title = str(request.data["title"]).strip()[:200] or report.title
        if request.data.get("status") in {"ready", "archived"}:
            report.status = request.data["status"]
        report.save(update_fields=["title", "status"])
        return Response(ReportDetailSerializer(report).data)


class ReportCompareView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, slug, report_id):
        project = _project_for(request.user, slug)
        current = get_object_or_404(project.analysis_reports, pk=report_id)
        if not can_read_artifact(request.user, current):
            return Response(status=status.HTTP_404_NOT_FOUND)
        against_id = request.query_params.get("against")
        if against_id:
            previous = get_object_or_404(project.analysis_reports, pk=against_id)
        else:
            previous = (
                _visible(
                    project.analysis_reports.filter(created_at__lt=current.created_at),
                    request.user,
                )
                .distinct()
                .first()
            )
        if previous is None or not can_read_artifact(request.user, previous):
            return Response(
                {"detail": "Aucun rapport antérieur comparable."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(compare_reports(current, previous))


class ReportRenderView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, slug, report_id):
        project = _project_for(request.user, slug)
        report = get_object_or_404(project.analysis_reports, pk=report_id)
        if not can_read_artifact(request.user, report):
            return Response(status=404)
        artifact = create_report_artifact(report, request.user)
        dispatch_artifact(artifact.id)
        artifact.refresh_from_db()
        code = 201 if artifact.status == ArtifactStatus.READY else 202
        return Response(ReportArtifactSerializer(artifact).data, status=code)


class ReportArtifactView(APIView):
    permission_classes = [IsAuthenticated]

    def _get(self, request, slug, artifact_id):
        project = _project_for(request.user, slug)
        artifact = get_object_or_404(
            AnalysisReportArtifact.objects.select_related("report"),
            pk=artifact_id,
            report__project=project,
        )
        return artifact if can_read_artifact(request.user, artifact.report) else None

    def get(self, request, slug, artifact_id):
        artifact = self._get(request, slug, artifact_id)
        if artifact is None:
            return Response(status=404)
        return Response(ReportArtifactSerializer(artifact).data)


class ReportArtifactDownloadView(ReportArtifactView):
    def get(self, request, slug, artifact_id):
        artifact = self._get(request, slug, artifact_id)
        if artifact is None or artifact.status != ArtifactStatus.READY:
            raise Http404
        path = safe_artifact_path(artifact)
        if path is None:
            raise Http404
        return FileResponse(
            open(path, "rb"),
            as_attachment=True,
            filename=f"pactiva-analysis-{artifact.report_id}.pdf",
        )

from rest_framework import serializers

from .models import (
    AnalysisPreset,
    AnalysisReport,
    AnalysisReportArtifact,
    AnalysisRun,
    AnalysisSnapshot,
    AnalysisTaxonomyProposal,
)


class SnapshotListSerializer(serializers.ModelSerializer):
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = AnalysisSnapshot
        fields = [
            "id",
            "label",
            "visibility",
            "includes_drafts",
            "fingerprint",
            "document_count",
            "annotation_count",
            "draft_count",
            "created_by",
            "created_at",
        ]


class SnapshotDetailSerializer(SnapshotListSerializer):
    class Meta(SnapshotListSerializer.Meta):
        fields = SnapshotListSerializer.Meta.fields + ["scope", "manifest", "payload"]


class AnalysisRunSerializer(serializers.ModelSerializer):
    snapshot_id = serializers.UUIDField(read_only=True)
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = AnalysisRun
        fields = [
            "id",
            "snapshot_id",
            "metric_codes",
            "metric_versions",
            "configuration",
            "status",
            "progress",
            "result",
            "fingerprint",
            "error_code",
            "error_detail",
            "cancel_requested",
            "attempt",
            "created_by",
            "started_at",
            "heartbeat_at",
            "completed_at",
            "created_at",
        ]


class ReportListSerializer(serializers.ModelSerializer):
    snapshot_id = serializers.UUIDField(read_only=True)
    run_id = serializers.UUIDField(read_only=True)
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = AnalysisReport
        fields = [
            "id",
            "snapshot_id",
            "run_id",
            "title",
            "description",
            "visibility",
            "status",
            "summary",
            "created_by",
            "created_at",
        ]


class ReportDetailSerializer(ReportListSerializer):
    class Meta(ReportListSerializer.Meta):
        fields = ReportListSerializer.Meta.fields + ["configuration", "payload"]


class AnalysisPresetSerializer(serializers.ModelSerializer):
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = AnalysisPreset
        fields = [
            "id",
            "name",
            "configuration",
            "is_shared",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]


class ReportArtifactSerializer(serializers.ModelSerializer):
    report_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = AnalysisReportArtifact
        fields = [
            "id",
            "report_id",
            "status",
            "checksum",
            "size_bytes",
            "manifest",
            "error_detail",
            "expires_at",
            "created_at",
            "completed_at",
        ]


class TaxonomyProposalSerializer(serializers.ModelSerializer):
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = AnalysisTaxonomyProposal
        fields = [
            "id",
            "report",
            "kind",
            "theme_code",
            "title",
            "rationale",
            "evidence",
            "status",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]

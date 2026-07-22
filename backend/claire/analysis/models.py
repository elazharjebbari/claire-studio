"""Modèles persistants du Pactiva Analysis Lab.

La vérité métier reste dans les apps sources. Un snapshot est une projection immuable,
sans texte contractuel, sur laquelle les runs et rapports sont calculés.
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from claire.projects.models import Project


class SnapshotVisibility(models.TextChoices):
    PERSONAL = "personal", "Personnel"
    PROJECT = "project", "Projet"


class RunStatus(models.TextChoices):
    QUEUED = "queued", "En attente"
    RUNNING = "running", "En cours"
    SUCCEEDED = "succeeded", "Terminé"
    FAILED = "failed", "Échec"
    STALE = "stale", "Obsolète"
    CANCELED = "canceled", "Annulé"


class ReportStatus(models.TextChoices):
    READY = "ready", "Disponible"
    ARCHIVED = "archived", "Archivé"


class ArtifactStatus(models.TextChoices):
    QUEUED = "queued", "En attente"
    RUNNING = "running", "En cours"
    READY = "ready", "Disponible"
    FAILED = "failed", "Échec"
    EXPIRED = "expired", "Expiré"


class AnalysisSnapshot(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="analysis_snapshots"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="analysis_snapshots",
    )
    label = models.CharField(max_length=200, blank=True, default="")
    visibility = models.CharField(
        max_length=12,
        choices=SnapshotVisibility.choices,
        default=SnapshotVisibility.PERSONAL,
    )
    includes_drafts = models.BooleanField(default=True)
    scope = models.JSONField(default=dict)
    manifest = models.JSONField(default=dict)
    payload = models.JSONField(default=dict)
    fingerprint = models.CharField(max_length=64, db_index=True)
    document_count = models.PositiveIntegerField(default=0)
    annotation_count = models.PositiveIntegerField(default=0)
    draft_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["project", "created_at"]),
            models.Index(fields=["project", "visibility", "created_at"]),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"snapshot#{self.id}:{self.project_id}:{self.fingerprint[:8]}"

    def save(self, *args, **kwargs):
        """Interdit toute mutation après la création du snapshot.

        Les nouvelles observations doivent toujours produire un nouveau snapshot. Cette
        protection complète l'absence d'endpoint PATCH et évite une modification accidentelle
        depuis l'admin, un shell ou un futur service.
        """

        if not self._state.adding:
            raise ValidationError("Un snapshot analytique est immuable.")
        return super().save(*args, **kwargs)


class AnalysisRun(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="analysis_runs")
    snapshot = models.ForeignKey(AnalysisSnapshot, on_delete=models.PROTECT, related_name="runs")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="analysis_runs"
    )
    metric_codes = models.JSONField(default=list)
    metric_versions = models.JSONField(default=dict)
    configuration = models.JSONField(default=dict)
    status = models.CharField(max_length=12, choices=RunStatus.choices, default=RunStatus.QUEUED)
    progress = models.PositiveSmallIntegerField(default=0)
    result = models.JSONField(default=dict)
    fingerprint = models.CharField(max_length=64, db_index=True)
    error_code = models.CharField(max_length=60, blank=True, default="")
    error_detail = models.CharField(max_length=500, blank=True, default="")
    cancel_requested = models.BooleanField(default=False)
    attempt = models.PositiveSmallIntegerField(default=0)
    started_at = models.DateTimeField(null=True, blank=True)
    heartbeat_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["project", "status", "created_at"]),
            models.Index(fields=["snapshot", "created_at"]),
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["status", "heartbeat_at"]),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"analysis-run#{self.id}:{self.status}"


class AnalysisReport(models.Model):
    """Rapport historique instantanément consultable, dérivé d'un run immuable."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="analysis_reports")
    snapshot = models.ForeignKey(AnalysisSnapshot, on_delete=models.PROTECT, related_name="reports")
    run = models.ForeignKey(AnalysisRun, on_delete=models.PROTECT, related_name="reports")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="analysis_reports",
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    visibility = models.CharField(
        max_length=12,
        choices=SnapshotVisibility.choices,
        default=SnapshotVisibility.PERSONAL,
    )
    status = models.CharField(
        max_length=12, choices=ReportStatus.choices, default=ReportStatus.READY
    )
    configuration = models.JSONField(default=dict)
    summary = models.JSONField(default=dict)
    payload = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["project", "status", "created_at"]),
            models.Index(fields=["project", "visibility", "created_at"]),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"analysis-report#{self.id}:{self.title}"


class AnalysisPreset(models.Model):
    """Configuration réutilisable ; aucune donnée analytique n'y est stockée."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="analysis_presets")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="analysis_presets"
    )
    name = models.CharField(max_length=120)
    configuration = models.JSONField(default=dict)
    is_shared = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name", "created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["project", "created_by", "name"], name="uniq_analysis_preset_owner_name"
            )
        ]


class AnalysisReportArtifact(models.Model):
    """PDF privé dérivé d'un rapport ; le chemin n'est jamais exposé par l'API."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    report = models.ForeignKey(AnalysisReport, on_delete=models.CASCADE, related_name="artifacts")
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="analysis_report_artifacts",
    )
    status = models.CharField(
        max_length=12, choices=ArtifactStatus.choices, default=ArtifactStatus.QUEUED
    )
    file_path = models.CharField(max_length=700, blank=True, default="")
    checksum = models.CharField(max_length=64, blank=True, default="")
    size_bytes = models.PositiveBigIntegerField(default=0)
    manifest = models.JSONField(default=dict)
    error_detail = models.CharField(max_length=500, blank=True, default="")
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["status", "expires_at"]),
        ]


class AnalysisTaxonomyProposal(models.Model):
    """Proposition séparée du schéma métier ; jamais appliquée automatiquement."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="analysis_taxonomy_proposals"
    )
    report = models.ForeignKey(
        AnalysisReport,
        on_delete=models.PROTECT,
        related_name="taxonomy_proposals",
        null=True,
        blank=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="analysis_taxonomy_proposals",
    )
    kind = models.CharField(max_length=20)
    theme_code = models.CharField(max_length=60, blank=True, default="")
    title = models.CharField(max_length=200)
    rationale = models.TextField(blank=True, default="")
    evidence = models.JSONField(default=dict)
    status = models.CharField(max_length=16, default="draft")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["project", "status", "created_at"])]

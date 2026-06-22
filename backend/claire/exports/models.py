"""ExportJob (CONTRACT §2) — feature 5 (multi-format export)."""

from django.conf import settings
from django.db import models

from claire.projects.models import Project


class ExportFormat(models.TextChoices):
    JSONL = "jsonl", "JSONL"
    CSV = "csv", "CSV"
    CONLL = "conll", "CoNLL"
    XML = "xml", "XML"
    MD = "md", "Markdown"
    HUGGINGFACE = "huggingface", "HuggingFace"
    IAA_MATRIX = "iaa_matrix", "Matrice de concordance (IAA)"


class ExportStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    RUNNING = "running", "Running"
    DONE = "done", "Done"
    FAILED = "failed", "Failed"


class ExportJob(models.Model):
    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="export_jobs"
    )
    format = models.CharField(max_length=20, choices=ExportFormat.choices)
    scope = models.JSONField(default=dict, blank=True)
    status = models.CharField(
        max_length=16, choices=ExportStatus.choices, default=ExportStatus.PENDING
    )
    artifact_path = models.CharField(max_length=600, blank=True)
    manifest = models.JSONField(default=dict, blank=True)
    # Message d'erreur lisible si status=failed (export en tâche de fond). Persiste
    # même après rollback de la transaction de lecture (cf. services.run_export).
    error = models.TextField(blank=True, default="")
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="export_jobs",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:  # pragma: no cover
        return f"export#{self.pk}:{self.format}:{self.status}"

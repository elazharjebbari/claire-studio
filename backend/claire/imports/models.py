"""PreAnnotation / PreClause (CONTRACT §2) — feature 2 (LLM pre-annotations).

Append-only; never mixed with human gold. Used as a pre-filled starting point.
"""

from django.db import models

from claire.corpora.models import Document
from claire.projects.models import Project


class Judge(models.TextChoices):
    CLAUDE = "claude", "Claude"
    CODEX = "codex", "Codex"
    MISTRAL = "mistral", "Mistral"
    OTHER = "other", "Other"


class PreAnnotation(models.Model):
    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="preannotations"
    )
    document = models.ForeignKey(
        Document, on_delete=models.CASCADE, related_name="preannotations"
    )
    judge = models.CharField(max_length=20, choices=Judge.choices)
    schema_version = models.CharField(max_length=40)  # e.g. v9.4 / v9.2
    raw = models.JSONField()
    imported_at = models.DateTimeField(auto_now_add=True)
    mapped = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["project", "document", "judge", "schema_version"],
                name="uniq_preannotation_proj_doc_judge_version",
            )
        ]
        ordering = ["project", "document", "judge"]

    def __str__(self) -> str:  # pragma: no cover
        return f"pre[{self.judge}@{self.schema_version}]:{self.document_id}"


class PreClause(models.Model):
    preannotation = models.ForeignKey(
        PreAnnotation, on_delete=models.CASCADE, related_name="preclauses"
    )
    anchor_index = models.PositiveIntegerField()
    theme_code = models.CharField(max_length=60)
    evidence_span = models.TextField(blank=True)
    rationale = models.TextField(blank=True)
    # Nature juridique proposée par le juge (vocab LLM, ex. OBLIGATION/PROHIBITION/
    # RIGHT_GRANT…), dérivée par phrase dans `annotations[]` du JSON v9.2. Sert la
    # CONSULTATION LLM de la nature (axe 2/3b) — informatif, jamais appliqué d'office.
    legal_nature = models.CharField(max_length=40, blank=True, default="")
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["preannotation", "order"]

    def __str__(self) -> str:  # pragma: no cover
        return f"preclause:{self.theme_code}@{self.anchor_index}"

"""Modèles du Lab — orchestration seulement (aucun calcul scientifique ici).

Calqués sur `claire.analysis` (snapshot immuable + run avec heartbeat/retry/annulation),
mécanique déjà éprouvée en production : mieux vaut la réutiliser que d'en inventer une
seconde, forcément moins testée.
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from claire.common.models import TimeStampedModel
from claire.projects.models import Project


class Maturity(models.TextChoices):
    ANY = "any", "Toutes"
    COMPLETE = "complete", "Complètes"
    SUBMITTED = "submitted", "Soumises"
    GOLD = "gold", "Gold finalisé"


class Aggregation(models.TextChoices):
    SINGLE = "single", "Un annotateur"
    CONSENSUS = "consensus", "Consensus (cascade)"
    SOFT = "soft", "Soft labels"


class DatasetStatus(models.TextChoices):
    BUILDING = "building", "Construction"
    READY = "ready", "Prêt"
    FAILED = "failed", "Échec"


class RunStatus(models.TextChoices):
    QUEUED = "queued", "En file"
    WAITING = "waiting", "En attente d'allocation"
    RUNNING = "running", "En cours"
    SUCCEEDED = "succeeded", "Terminé"
    PARTIAL = "partial", "Partiel"
    FAILED = "failed", "Échec"
    CANCELLED = "cancelled", "Annulé"


class Task(models.TextChoices):
    T1 = "T1_primary", "T1 — thème primaire"
    T2 = "T2_multilabel", "T2 — multi-label"
    T3 = "T3_boundary", "T3 — frontières"
    M1 = "M1_agreement", "M1 — mesures d'accord (E1–E4)"
    M2 = "M2_gold_cascade", "M2 — cascade gold (E5)"
    G2 = "G2_cooccurrence", "G2 — anomalie de co-occurrence"
    U1 = "U1_unfair", "U1 — abusivité CLAUDETTE (texte seul)"


class ComputeKind(models.TextChoices):
    LOCAL = "local", "Local"
    G5K = "g5k", "Grid'5000"


class LabDataset(TimeStampedModel):
    """Jeu de données figé et signé — l'identité citable dans l'article.

    IMMUABLE après création, comme `AnalysisSnapshot` : une nouvelle observation produit
    un nouveau dataset. Sans cela, un tableau de l'article pourrait référencer un
    identifiant dont le contenu a changé depuis.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="lab_datasets")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="lab_datasets"
    )
    label = models.CharField(max_length=200, blank=True, default="")
    maturity = models.CharField(max_length=12, choices=Maturity.choices, default=Maturity.COMPLETE)
    aggregation = models.CharField(
        max_length=12, choices=Aggregation.choices, default=Aggregation.CONSENSUS
    )
    scope = models.JSONField(default=dict, blank=True)
    manifest = models.JSONField(default=dict, blank=True)
    splits = models.JSONField(default=dict, blank=True)
    fingerprint = models.CharField(max_length=64, db_index=True)
    status = models.CharField(
        max_length=12, choices=DatasetStatus.choices, default=DatasetStatus.BUILDING
    )
    storage_path = models.CharField(max_length=500, blank=True, default="")
    n_documents = models.PositiveIntegerField(default=0)
    n_sentences = models.PositiveIntegerField(default=0)
    n_annotations = models.PositiveIntegerField(default=0)
    error = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["project", "created_at"]),
            models.Index(fields=["project", "fingerprint"]),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"dataset#{self.id}:{self.maturity}:{self.fingerprint[:8]}"

    def save(self, *args, **kwargs):
        """Immuable, à l'exception des champs de construction.

        On autorise le passage `building → ready|failed` et le remplissage des compteurs :
        le contenu scientifique (critères, empreinte, plis) est figé dès la création.
        """
        if not self._state.adding:
            allowed = {
                "status", "storage_path", "manifest", "splits", "error",
                "n_documents", "n_sentences", "n_annotations", "updated_at",
            }
            fields = kwargs.get("update_fields")
            if fields is None or not set(fields).issubset(allowed):
                raise ValidationError(
                    "Un jeu de données du Lab est immuable : produire un nouveau dataset."
                )
        return super().save(*args, **kwargs)


class ComputeTarget(TimeStampedModel):
    """Où exécuter un run. Ajouter une cible (SLURM, cloud) ne touche que `runners/`."""

    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="compute_targets"
    )
    name = models.CharField(max_length=120)
    kind = models.CharField(max_length=8, choices=ComputeKind.choices, default=ComputeKind.LOCAL)
    config = models.JSONField(default=dict, blank=True)
    is_default = models.BooleanField(default=False)

    class Meta:
        ordering = ["project", "name"]
        constraints = [
            models.UniqueConstraint(fields=["project", "name"], name="uniq_compute_target_name")
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.name} ({self.kind})"


class Experiment(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="experiments")
    dataset = models.ForeignKey(LabDataset, on_delete=models.PROTECT, related_name="experiments")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="experiments"
    )
    name = models.CharField(max_length=200)
    task = models.CharField(max_length=16, choices=Task.choices, default=Task.T1)
    config = models.JSONField(default=dict)
    compute_target = models.ForeignKey(
        ComputeTarget, on_delete=models.SET_NULL, null=True, blank=True, related_name="experiments"
    )
    preset = models.CharField(max_length=80, blank=True, default="")
    tags = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:  # pragma: no cover
        return f"exp#{self.id}:{self.name}"


class ExperimentRun(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    experiment = models.ForeignKey(Experiment, on_delete=models.CASCADE, related_name="runs")
    status = models.CharField(max_length=12, choices=RunStatus.choices, default=RunStatus.QUEUED)
    progress = models.PositiveSmallIntegerField(default=0)
    phase = models.CharField(max_length=40, blank=True, default="")
    config = models.JSONField(default=dict)
    # Empreinte de (dataset, config) : deux runs identiques ne se relancent pas. Sur des
    # entraînements GPU de plusieurs heures, la déduplication n'est pas un confort.
    fingerprint = models.CharField(max_length=64, db_index=True)
    metrics = models.JSONField(default=dict, blank=True)
    environment = models.JSONField(default=dict, blank=True)
    external_job_id = models.CharField(max_length=80, blank=True, default="")
    storage_path = models.CharField(max_length=500, blank=True, default="")
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
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["status", "heartbeat_at"]),
            models.Index(fields=["experiment", "created_at"]),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"run#{self.id}:{self.status}"


class ArtifactKind(models.TextChoices):
    FIGURE = "figure", "Figure"
    TABLE = "table", "Tableau"
    MODEL = "model", "Modèle"
    PREDICTIONS = "predictions", "Prédictions"
    ERRORS = "errors", "Analyse d'erreurs"
    LOG = "log", "Journal"


class RunArtifact(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run = models.ForeignKey(ExperimentRun, on_delete=models.CASCADE, related_name="artifacts")
    kind = models.CharField(max_length=12, choices=ArtifactKind.choices)
    name = models.CharField(max_length=200)
    path = models.CharField(max_length=500)
    mime = models.CharField(max_length=80, blank=True, default="")
    bytes = models.PositiveIntegerField(default=0)
    checksum = models.CharField(max_length=64, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["run", "kind", "name"]

    def __str__(self) -> str:  # pragma: no cover
        return f"artifact#{self.id}:{self.kind}:{self.name}"


class ComputeCredential(TimeStampedModel):
    """Identifiants d'une cible de calcul distante.

    DEUX secrets distincts, chiffrés séparément (`claire.lab.crypto`), ni l'un ni
    l'autre jamais renvoyé par l'API, même au propriétaire : `secret_encrypted` (mot
    de passe, authentifie l'API REST en HTTP Basic) et `ssh_key_encrypted` (clé privée
    SSH, sert EXCLUSIVEMENT au transfert de fichiers). Ce sont deux mécanismes
    d'authentification indépendants côté Grid'5000 — l'authentification par mot de
    passe y est désactivée pour SSH, voir `docs/pactiva-g5k/07_ARCHITECTURE.md` §1.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="compute_credentials"
    )
    kind = models.CharField(max_length=8, choices=ComputeKind.choices, default=ComputeKind.G5K)
    login = models.CharField(max_length=120)
    secret_encrypted = models.TextField(blank=True, default="")
    ssh_key_encrypted = models.TextField(blank=True, default="")
    last_tested_at = models.DateTimeField(null=True, blank=True)
    last_test_ok = models.BooleanField(null=True, blank=True)
    last_test_ssh_ok = models.BooleanField(null=True, blank=True)
    last_test_detail = models.CharField(max_length=300, blank=True, default="")

    class Meta:
        ordering = ["user", "kind"]
        constraints = [
            models.UniqueConstraint(fields=["user", "kind"], name="uniq_credential_user_kind")
        ]

    def __str__(self) -> str:  # pragma: no cover
        # Jamais le secret, même en représentation de débogage.
        return f"credential#{self.pk}:{self.kind}:{self.login}"

"""Modèles GOLD — résolution des conflits inter-annotateurs vers le gold standard.

Modèles DÉDIÉS (ADR-006) : on ne surcharge PAS `Annotation`. Le gold est matérialisé
PAR PHRASE (`GoldSentence`) à partir du moteur PUR `claire.projects.gold_scoring`, recalculé
à la demande (recompute synchrone — pur CPU). La décision humaine (`decided_by`) est sacrée :
le recompute ne l'écrase jamais. Verrou d'arbitrage porté ici (DB = source de vérité, ADR-002 ;
endpoints temps réel en V3). Traçabilité append-only via `ArbitrationEvent`.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models

from claire.common.models import TimeStampedModel
from claire.corpora.models import Document
from claire.projects.models import Project
from claire.schemes.models import Theme


class ResolutionStatus(models.TextChoices):
    UNRESOLVED = "unresolved", "Non résolu"
    IN_PROGRESS = "in_progress", "En cours"
    RESOLVED = "resolved", "Résolu"


class AgreementClass(models.TextChoices):
    STRICT = "strict", "Accord strict"
    MAJORITY = "majority", "Accord majoritaire"
    DIVERGENCE = "divergence", "Divergence"
    EMPTY = "empty", "Non couvert"


class RiskBand(models.TextChoices):
    LOW = "low", "Faible"
    MEDIUM = "medium", "Moyen"
    HIGH = "high", "Élevé"


class AutoLevel(models.TextChoices):
    AUTO_1CLICK = "auto_1click", "Accord absolu (1 clic)"
    AUTO = "auto", "Auto (peu risqué)"
    MANUAL = "manual", "Manuel"


class GoldResolution(TimeStampedModel):
    """État de résolution d'UN document pour un projet (1 par projet×document)."""

    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="gold_resolutions"
    )
    document = models.ForeignKey(
        Document, on_delete=models.CASCADE, related_name="gold_resolutions"
    )
    status = models.CharField(
        max_length=16, choices=ResolutionStatus.choices,
        default=ResolutionStatus.UNRESOLVED,
    )
    pct_resolved = models.FloatField(default=0.0)
    # Qui peut arbitrer ce document (en plus des leads/admin). Vide = politique par défaut.
    arbiters = models.ManyToManyField(
        settings.AUTH_USER_MODEL, blank=True, related_name="gold_arbitrations"
    )
    finalized_at = models.DateTimeField(null=True, blank=True)

    # ── Verrou d'arbitrage exclusif (DB source de vérité ; endpoints en V3) ──
    locked = models.BooleanField(default=False)
    locked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="+",
    )
    locked_at = models.DateTimeField(null=True, blank=True)
    lock_expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["project", "document"], name="uniq_gold_resolution_proj_doc"
            )
        ]
        ordering = ["project", "document"]

    def __str__(self) -> str:  # pragma: no cover
        return f"gold[{self.status}]:{self.project_id}:{self.document_id}"


class GoldSentence(models.Model):
    """Décision gold d'UNE phrase + proposition du moteur (recalculée à la demande)."""

    resolution = models.ForeignKey(
        GoldResolution, on_delete=models.CASCADE, related_name="sentences"
    )
    index = models.PositiveIntegerField()

    # ── Proposition du moteur (toujours rafraîchie au recompute) ──
    agreement_class = models.CharField(
        max_length=12, choices=AgreementClass.choices, default=AgreementClass.EMPTY
    )
    risk_band = models.CharField(
        max_length=8, choices=RiskBand.choices, default=RiskBand.MEDIUM
    )
    auto_level = models.CharField(
        max_length=12, choices=AutoLevel.choices, default=AutoLevel.MANUAL
    )
    confidence = models.FloatField(default=0.0)
    human_dissent = models.BooleanField(default=False)
    proposed_primary = models.CharField(max_length=60, blank=True, default="")
    proposed_secondaries = models.JSONField(default=list, blank=True)
    human_block = models.CharField(max_length=60, blank=True, default="")
    llm_block = models.CharField(max_length=60, blank=True, default="")
    tally = models.JSONField(default=dict, blank=True)

    # ── Décision gold (humaine OU auto) ──
    decided = models.BooleanField(default=False)
    auto_resolved = models.BooleanField(default=False)
    primary_theme = models.ForeignKey(
        Theme, on_delete=models.PROTECT, null=True, blank=True,
        related_name="gold_sentences",
    )
    secondaries = models.JSONField(default=list, blank=True)  # codes de thème
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="+",
    )
    decided_at = models.DateTimeField(null=True, blank=True)
    comment = models.TextField(blank=True, default="")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["resolution", "index"], name="uniq_gold_sentence_res_index"
            )
        ]
        ordering = ["resolution", "index"]

    def __str__(self) -> str:  # pragma: no cover
        return f"goldsent#{self.resolution_id}@{self.index}:{self.agreement_class}"


class ArbitrationVerb(models.TextChoices):
    DECIDE = "decide", "Décision"
    AUTO = "auto", "Auto-résolution"
    OVERRIDE = "override", "Révision"
    COMMENT = "comment", "Commentaire"
    LOCK = "lock", "Verrou"
    UNLOCK = "unlock", "Déverrou"
    STEAL = "steal", "Reprise"


class ArbitrationEvent(models.Model):
    """Trace append-only « qui a arbitré quoi » (traçabilité)."""

    resolution = models.ForeignKey(
        GoldResolution, on_delete=models.CASCADE, related_name="events"
    )
    index = models.PositiveIntegerField(null=True, blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="+",
    )
    verb = models.CharField(max_length=12, choices=ArbitrationVerb.choices)
    payload = models.JSONField(default=dict, blank=True)
    note = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:  # pragma: no cover
        return f"arb[{self.verb}]:{self.resolution_id}@{self.index}"


class GoldRun(models.Model):
    """Snapshot horodaté du gold d'un document (audit / export figé, V6)."""

    resolution = models.ForeignKey(
        GoldResolution, on_delete=models.CASCADE, related_name="runs"
    )
    kind = models.CharField(max_length=8, default="draft")  # draft | final
    payload = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:  # pragma: no cover
        return f"goldrun[{self.kind}]:{self.resolution_id}"

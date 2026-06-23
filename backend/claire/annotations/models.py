"""Annotation / Clause / AnnotationVersion (CONTRACT §2).

Invariants:
- INV-2: Clause.anchor_sentence in annotation document; one clause-start per sentence.
- INV-3: Clause.theme in project's scheme (enforced in service/validation + FK).
- INV-4: Annotation unique per (project, document, annotator).
- INV-5: status transitions go through annotations.state_machine.
- INV-6: certainty in {0,1,2,3}.
"""

from django.conf import settings
from django.core.validators import MaxValueValidator
from django.db import models

from claire.common.models import CERTAINTY_CHOICES, TimeStampedModel
from claire.corpora.models import Document, Sentence
from claire.projects.models import Project
from claire.schemes.models import LegalNature, Theme


class AnnotationStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    SUBMITTED = "submitted", "Submitted"
    IN_REVIEW = "in_review", "In review"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"
    ARCHIVED = "archived", "Archived"


class AnnotationSource(models.TextChoices):
    HUMAN = "human", "Human"
    PREANNOTATION_SEED = "preannotation_seed", "Pre-annotation seed"


class BoundaryType(models.TextChoices):
    HARD = "hard", "Frontière dure"
    SOFT = "soft", "Frontière molle"


class ClauseRole(models.TextChoices):
    PRIMARY = "primary", "Primaire"
    SECONDARY = "secondary", "Secondaire"


# Thèmes-refuges (protocole multi-label) : jamais en étiquette secondaire.
REFUGE_CODES = {"PREAMBLE_SCOPE", "MISC_BOILERPLATE"}


class Annotation(TimeStampedModel):
    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="annotations"
    )
    document = models.ForeignKey(
        Document, on_delete=models.CASCADE, related_name="annotations"
    )
    annotator = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="annotations",
    )
    status = models.CharField(
        max_length=16, choices=AnnotationStatus.choices,
        default=AnnotationStatus.DRAFT,
    )
    global_certainty = models.PositiveSmallIntegerField(
        null=True, blank=True, choices=CERTAINTY_CHOICES,
        validators=[MaxValueValidator(3)],
    )
    source = models.CharField(
        max_length=24, choices=AnnotationSource.choices,
        default=AnnotationSource.HUMAN,
    )
    # Verrouillage (édition gelée) — orthogonal au statut : posé AUTOMATIQUEMENT à la
    # soumission (entrée en `submitted`) et MANUELLEMENT via lock/unlock. Tant que
    # `locked`, toute écriture de clause est refusée (423). Le déverrouillage d'un
    # document soumis le ROUVRE en `draft` (cf. services.transition_status + vues).
    locked = models.BooleanField(default=False)
    locked_at = models.DateTimeField(null=True, blank=True)
    locked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="+",
    )

    class Meta:
        constraints = [
            # INV-4
            models.UniqueConstraint(
                fields=["project", "document", "annotator"],
                name="uniq_annotation_project_doc_annotator",
            ),
            # INV-6
            models.CheckConstraint(
                condition=models.Q(global_certainty__isnull=True)
                | models.Q(global_certainty__in=[0, 1, 2, 3]),
                name="ck_annotation_global_certainty_range",
            ),
        ]
        ordering = ["-updated_at"]

    def __str__(self) -> str:  # pragma: no cover
        return f"ann#{self.pk}:{self.document_id}:{self.annotator_id}"


class Clause(models.Model):
    annotation = models.ForeignKey(
        Annotation, on_delete=models.CASCADE, related_name="clauses"
    )
    anchor_sentence = models.ForeignKey(
        Sentence, on_delete=models.PROTECT, related_name="anchored_clauses"
    )
    theme = models.ForeignKey(
        Theme, on_delete=models.PROTECT, related_name="clauses"
    )
    legal_nature = models.ForeignKey(
        LegalNature, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="clauses",
    )
    evidence_span = models.TextField(blank=True)
    rationale = models.TextField(blank=True)
    certainty = models.PositiveSmallIntegerField(
        null=True, blank=True, choices=CERTAINTY_CHOICES,
        validators=[MaxValueValidator(3)],
    )
    order = models.PositiveIntegerField(default=0)
    # Validation humaine explicite (point d) : l'annotateur a validé cette clause
    # (qu'il l'ait saisie ou adoptée d'un modèle). Les pré-annotations ne valent JAMAIS
    # référence : seule une clause validated=True compte pour la soumission complète.
    validated = models.BooleanField(default=False)
    # Idempotence des écritures (chantier C) : identifiant d'opération côté client.
    # Un même op réémis (retry réseau) ne crée pas de doublon. Vide = pas
    # d'idempotence (écritures serveur / héritées).
    client_op_id = models.CharField(max_length=64, blank=True, default="")
    # Multi-label / frontières non rigides (protocole confiance graduée). Additifs et
    # rétro-compatibles : `theme` (FK scalaire) reste le MIROIR du thème primaire ; la
    # vérité multi-label vit dans `theme_tags` (ClauseTheme). `triage_level` (C1–C5) est
    # DÉRIVÉ de l'accord inter-juges et ORTHOGONAL à `certainty` (0–3, subjective).
    boundary_type = models.CharField(
        max_length=4, choices=BoundaryType.choices, default=BoundaryType.HARD
    )
    boundary_support = models.PositiveSmallIntegerField(default=1)
    triage_level = models.CharField(max_length=2, blank=True, default="")

    class Meta:
        constraints = [
            # INV-2: one clause-start per sentence per annotation.
            models.UniqueConstraint(
                fields=["annotation", "anchor_sentence"],
                name="uniq_clause_annotation_anchor",
            ),
            # Idempotence (chantier C) : un client_op_id non vide est unique par
            # annotation — un retry retombe sur la même clause.
            models.UniqueConstraint(
                fields=["annotation", "client_op_id"],
                condition=~models.Q(client_op_id=""),
                name="uniq_clause_client_op",
            ),
            # INV-6
            models.CheckConstraint(
                condition=models.Q(certainty__isnull=True)
                | models.Q(certainty__in=[0, 1, 2, 3]),
                name="ck_clause_certainty_range",
            ),
        ]
        ordering = ["annotation", "order"]

    def __str__(self) -> str:  # pragma: no cover
        return f"clause#{self.pk}:{self.theme_id}@{self.anchor_sentence_id}"


class ClauseTheme(models.Model):
    """Étiquette de thème portée par une clause (multi-label natif).

    Une clause mono-label a exactement 1 ClauseTheme (role=primary), strictement
    équivalent au format legacy. Le multi-label ajoute des secondaires (jamais un refuge).
    Invariants (validés par `validate_clause_theme_set`) : exactement un primary ;
    aucun refuge en secondary.
    """

    clause = models.ForeignKey(
        Clause, on_delete=models.CASCADE, related_name="theme_tags"
    )
    theme = models.ForeignKey(
        Theme, on_delete=models.PROTECT, related_name="clause_tags"
    )
    role = models.CharField(max_length=9, choices=ClauseRole.choices)
    # Nombre de juges ayant proposé ce thème (provenance / explication). 0 = saisie humaine.
    support = models.PositiveSmallIntegerField(default=0)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["clause", "theme"], name="uniq_clause_theme"
            ),
        ]
        ordering = ["clause", "order"]

    def __str__(self) -> str:  # pragma: no cover
        return f"tag#{self.pk}:{self.theme_id}/{self.role}"


def validate_clause_theme_set(tags) -> None:
    """Valide les invariants multi-label d'un ensemble de ClauseTheme.

    `tags` = itérable de ClauseTheme (ou objets ayant .role et .theme.code).
    Lève ``django.core.exceptions.ValidationError`` si violé.
    """
    from django.core.exceptions import ValidationError

    tags = list(tags)
    if not tags:
        raise ValidationError("une clause doit porter au moins un thème.")
    primaries = [t for t in tags if t.role == ClauseRole.PRIMARY]
    if len(primaries) != 1:
        raise ValidationError("exactement un thème primaire est requis.")
    for t in tags:
        if t.role == ClauseRole.SECONDARY and t.theme.code in REFUGE_CODES:
            raise ValidationError(
                f"un refuge ({t.theme.code}) ne peut pas être secondaire."
            )


class AnnotationVersion(models.Model):
    """Immutable snapshot of an annotation (feature 3). Append-only."""

    annotation = models.ForeignKey(
        Annotation, on_delete=models.CASCADE, related_name="versions"
    )
    number = models.PositiveIntegerField()
    snapshot = models.JSONField()
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="annotation_versions",
    )
    label = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["annotation", "number"],
                name="uniq_version_annotation_number",
            )
        ]
        ordering = ["annotation", "number"]

    def __str__(self) -> str:  # pragma: no cover
        return f"v{self.number} of ann#{self.annotation_id}"

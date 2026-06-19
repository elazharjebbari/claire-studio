"""Comment / Review / ShareLink (CONTRACT §2) — features 9, 10 & collaboration."""

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from claire.annotations.models import Annotation, Clause
from claire.common.models import TimeStampedModel
from claire.corpora.models import Sentence
from claire.projects.models import Project


class Comment(TimeStampedModel):
    annotation = models.ForeignKey(
        Annotation, on_delete=models.CASCADE, related_name="comments"
    )
    clause = models.ForeignKey(
        Clause, on_delete=models.CASCADE, null=True, blank=True,
        related_name="comments",
    )
    sentence = models.ForeignKey(
        Sentence, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="comments",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="comments",
    )
    body = models.TextField()  # markdown
    thread_root = models.ForeignKey(
        "self", on_delete=models.CASCADE, null=True, blank=True,
        related_name="replies",
    )
    resolved = models.BooleanField(default=False)

    class Meta:
        ordering = ["created_at"]

    def __str__(self) -> str:  # pragma: no cover
        return f"comment#{self.pk} on ann#{self.annotation_id}"


class ReviewDecision(models.TextChoices):
    APPROVE = "approve", "Approve"
    REQUEST_CHANGES = "request_changes", "Request changes"
    REJECT = "reject", "Reject"


class Review(models.Model):
    annotation = models.ForeignKey(
        Annotation, on_delete=models.CASCADE, related_name="reviews"
    )
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="reviews",
    )
    score = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    decision = models.CharField(max_length=20, choices=ReviewDecision.choices)
    rubric = models.JSONField(default=dict, blank=True)
    body = models.TextField(blank=True)  # markdown
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(score__gte=1) & models.Q(score__lte=5),
                name="ck_review_score_range",
            )
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"review#{self.pk}:{self.decision}"


class ShareRole(models.TextChoices):
    ANNOTATOR = "annotator", "Annotator"
    REVIEWER = "reviewer", "Reviewer"


class ShareLink(TimeStampedModel):
    """Lien de partage PERSISTÉ (chantier D) : révocable, expirable, à quota.

    À l'ouverture, l'utilisateur AUTHENTIFIÉ rejoint le projet (jamais d'accès
    anonyme). Remplace l'ancien jeton signé sans état (pas de révocation/quota).
    """

    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="share_links"
    )
    token = models.CharField(max_length=64, unique=True)
    role_granted = models.CharField(
        max_length=16, choices=ShareRole.choices, default=ShareRole.ANNOTATOR
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="share_links",
    )
    expires_at = models.DateTimeField(null=True, blank=True)
    max_uses = models.PositiveIntegerField(null=True, blank=True)
    used_count = models.PositiveIntegerField(default=0)
    revoked = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    def is_expired(self) -> bool:
        return self.expires_at is not None and timezone.now() >= self.expires_at

    def is_exhausted(self) -> bool:
        return self.max_uses is not None and self.used_count >= self.max_uses

    def is_usable(self) -> bool:
        return not self.revoked and not self.is_expired() and not self.is_exhausted()

    def __str__(self) -> str:  # pragma: no cover
        return f"sharelink#{self.pk}:{self.project_id}:{self.role_granted}"

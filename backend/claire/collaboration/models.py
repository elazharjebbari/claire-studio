"""Comment / Review (CONTRACT §2) — features 9 & 10."""

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from claire.annotations.models import Annotation, Clause
from claire.common.models import TimeStampedModel
from claire.corpora.models import Sentence


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
                check=models.Q(score__gte=1) & models.Q(score__lte=5),
                name="ck_review_score_range",
            )
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"review#{self.pk}:{self.decision}"

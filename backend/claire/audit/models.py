"""ActivityEvent (CONTRACT §2) — append-only audit trail (feature 4)."""

from django.conf import settings
from django.db import models


class ActivityEvent(models.Model):
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="activity_events",
    )
    verb = models.CharField(max_length=60)  # e.g. annotation.submitted
    target_type = models.CharField(max_length=60)
    target_id = models.CharField(max_length=64)
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["target_type", "target_id"]),
            models.Index(fields=["verb"]),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.verb} {self.target_type}#{self.target_id}"

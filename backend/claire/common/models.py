"""Shared abstract models."""

from django.db import models


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


# Shared choice constants (CONTRACT §2 / vocabulary.yaml).
CERTAINTY_CHOICES = [
    (0, "Incertain"),
    (1, "Plutôt"),
    (2, "Confiant"),
    (3, "Certain"),
]

UNFAIRNESS_CATEGORIES = ["A", "CH", "CR", "J", "LAW", "LTD", "TER", "USE"]
UNFAIRNESS_LEVELS = [(1, "1"), (2, "2"), (3, "3")]

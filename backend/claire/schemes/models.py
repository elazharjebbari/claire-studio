"""LabelScheme / Theme / LegalNature (CONTRACT §2) — closed versioned vocab.

INV-3: Clause.theme must belong to the project's scheme.
"""

from django.db import models

from claire.common.models import TimeStampedModel


class LabelScheme(TimeStampedModel):
    slug = models.SlugField(max_length=120, unique=True)
    name = models.CharField(max_length=200)
    version = models.CharField(max_length=40)
    is_active = models.BooleanField(default=True)
    definition = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["slug"]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.slug}@{self.version}"


class Theme(models.Model):
    scheme = models.ForeignKey(
        LabelScheme, on_delete=models.CASCADE, related_name="themes"
    )
    code = models.CharField(max_length=60)
    label = models.CharField(max_length=200)
    color = models.CharField(max_length=16, blank=True)
    definition = models.TextField(blank=True)
    examples = models.JSONField(default=list, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["scheme", "code"], name="uniq_theme_scheme_code"
            )
        ]
        ordering = ["scheme", "order"]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.scheme.slug}:{self.code}"


class LegalNature(models.Model):
    scheme = models.ForeignKey(
        LabelScheme, on_delete=models.CASCADE, related_name="legal_natures"
    )
    code = models.CharField(max_length=60)
    label = models.CharField(max_length=200)
    definition = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["scheme", "code"], name="uniq_legalnature_scheme_code"
            )
        ]
        ordering = ["scheme", "order"]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.scheme.slug}:{self.code}"

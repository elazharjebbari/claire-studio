"""Load a LabelScheme (themes + legal_natures) from vocabulary.yaml."""

from __future__ import annotations

import logging
from pathlib import Path

import yaml
from django.db import transaction

from .models import LabelScheme, LegalNature, Theme

logger = logging.getLogger("claire.schemes")


@transaction.atomic
def load_scheme_from_yaml(vocab_path: Path) -> LabelScheme:
    data = yaml.safe_load(Path(vocab_path).read_text(encoding="utf-8"))
    scheme_def = data["scheme"]

    scheme, _ = LabelScheme.objects.update_or_create(
        slug=scheme_def["slug"],
        defaults={
            "name": scheme_def["name"],
            "version": str(scheme_def["version"]),
            "is_active": scheme_def.get("is_active", True),
            "definition": {
                "unfairness_categories": data.get("unfairness_categories", []),
                "unfairness_levels": data.get("unfairness_levels", []),
                "certainty_scale": data.get("certainty_scale", []),
            },
        },
    )

    for t in data.get("themes", []):
        Theme.objects.update_or_create(
            scheme=scheme,
            code=t["code"],
            defaults={
                "label": t.get("label", t["code"]),
                "color": t.get("color", ""),
                "definition": t.get("definition", ""),
                "examples": t.get("examples", []),
                "order": t.get("order", 0),
            },
        )

    for ln in data.get("legal_natures", []):
        LegalNature.objects.update_or_create(
            scheme=scheme,
            code=ln["code"],
            defaults={
                "label": ln.get("label", ln["code"]),
                "definition": ln.get("definition", ""),
                "order": ln.get("order", 0),
            },
        )

    logger.info(
        "scheme_loaded slug=%s themes=%d legal_natures=%d",
        scheme.slug, scheme.themes.count(), scheme.legal_natures.count(),
    )
    return scheme

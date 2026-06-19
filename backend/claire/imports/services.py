"""Import services: persist pre-annotations and seed human annotations."""

from __future__ import annotations

import logging

from django.db import transaction

from claire.annotations.models import (
    Annotation,
    AnnotationSource,
    Clause,
)
from claire.common.exceptions import Conflict
from claire.corpora.models import Document, Sentence
from claire.projects.models import Project
from claire.schemes.models import Theme

from .loaders import normalize_preannotation
from .models import PreAnnotation, PreClause
from .theme_mapping import normalize_theme_code

logger = logging.getLogger("claire.imports")


@transaction.atomic
def ingest_preannotation(
    project: Project, document: Document, judge: str, raw: dict,
    version: str | None = None,
) -> PreAnnotation:
    """Normalise & persist a single pre-annotation (idempotent par clé).

    `version` (optionnel) force la version stockée (ex. import d'archive multi-versions
    « v9 / v9.1 / v9.2 / v9.3 ») ; sinon on détecte la famille (v9.2 / v9.4). L'unicité
    inclut la version → plusieurs versions coexistent pour un même (doc, juge).
    """
    detected, pivot = normalize_preannotation(raw)
    schema_version = version or detected

    pre, created = PreAnnotation.objects.get_or_create(
        project=project,
        document=document,
        judge=judge,
        schema_version=schema_version,
        defaults={"raw": raw, "mapped": True},
    )
    if not created:
        # Refresh preclauses idempotently.
        pre.preclauses.all().delete()
        pre.raw = raw
        pre.mapped = True
        pre.save(update_fields=["raw", "mapped"])

    PreClause.objects.bulk_create(
        [
            PreClause(
                preannotation=pre,
                anchor_index=c["anchor_index"],
                theme_code=c["theme"],
                evidence_span=c["evidence_span"],
                rationale=c["rationale"],
                order=c["order"],
            )
            for c in pivot
        ]
    )
    logger.info(
        "preannotation_ingested judge=%s version=%s doc=%s clauses=%d",
        judge, schema_version, document.external_id, len(pivot),
    )
    return pre


@transaction.atomic
def seed_annotation_from_preannotation(
    preannotation: PreAnnotation, annotator
) -> Annotation:
    """Create a human-editable Annotation pre-filled from an LLM pre-annotation.

    Respects INV-4 (idempotent on triplet) and INV-3 (theme normalised to the
    project scheme). Clauses with duplicate normalised anchors are de-duplicated
    to satisfy INV-2 (one clause-start per sentence).
    """
    project = preannotation.project
    document = preannotation.document
    scheme = project.scheme

    annotation, created = Annotation.objects.get_or_create(
        project=project,
        document=document,
        annotator=annotator,
        defaults={"source": AnnotationSource.PREANNOTATION_SEED},
    )
    if not created:
        raise Conflict(
            "An annotation already exists for this (project, document, annotator)."
        )

    themes_by_code = {t.code: t for t in scheme.themes.all()}
    sentences_by_index = {
        s.index: s for s in document.sentences.all()
    }

    seen_anchors: set[int] = set()
    order = 0
    for pc in preannotation.preclauses.order_by("order"):
        anchor = sentences_by_index.get(pc.anchor_index)
        if anchor is None:
            logger.warning(
                "seed_skip_missing_anchor doc=%s index=%s",
                document.external_id, pc.anchor_index,
            )
            continue
        if pc.anchor_index in seen_anchors:
            continue  # INV-2: one clause-start per sentence
        code = normalize_theme_code(pc.theme_code)
        theme = themes_by_code.get(code) or themes_by_code.get("MISC_BOILERPLATE")
        if theme is None:
            continue
        Clause.objects.create(
            annotation=annotation,
            anchor_sentence=anchor,
            theme=theme,
            evidence_span=pc.evidence_span,
            rationale=pc.rationale,
            order=order,
        )
        seen_anchors.add(pc.anchor_index)
        order += 1

    logger.info(
        "annotation_seeded ann=%s from_pre=%s clauses=%d",
        annotation.pk, preannotation.pk, order,
    )
    return annotation

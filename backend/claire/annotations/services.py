"""Annotation domain services (INV-5): state machine, snapshot & diff, seeding.

All status transitions MUST go through `transition_status` so that, in the
same transaction, we (a) update status, (b) emit an ActivityEvent, and
(c) optionally create an immutable AnnotationVersion snapshot.
"""

from __future__ import annotations

import logging

from django.db import transaction

from claire.audit.services import record_event
from claire.common.exceptions import Conflict

from .models import Annotation, AnnotationStatus, AnnotationVersion, Clause

logger = logging.getLogger("claire.annotations")

# Allowed transitions (see dossier/03_data_model/state_machines.puml).
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    AnnotationStatus.DRAFT: {AnnotationStatus.SUBMITTED, AnnotationStatus.ARCHIVED},
    AnnotationStatus.SUBMITTED: {
        AnnotationStatus.IN_REVIEW,
        AnnotationStatus.DRAFT,
        AnnotationStatus.ARCHIVED,
    },
    AnnotationStatus.IN_REVIEW: {
        AnnotationStatus.APPROVED,
        AnnotationStatus.REJECTED,
        AnnotationStatus.DRAFT,
    },
    AnnotationStatus.APPROVED: {AnnotationStatus.ARCHIVED},
    AnnotationStatus.REJECTED: {AnnotationStatus.DRAFT, AnnotationStatus.ARCHIVED},
    AnnotationStatus.ARCHIVED: set(),
}

# Transitions that warrant an immutable snapshot.
SNAPSHOTTING_TRANSITIONS = {
    AnnotationStatus.SUBMITTED,
    AnnotationStatus.APPROVED,
    AnnotationStatus.REJECTED,
}


def build_snapshot(annotation: Annotation) -> dict:
    """Serialise an annotation to the pivot format (CONTRACT §4)."""
    clauses = (
        annotation.clauses.select_related(
            "anchor_sentence", "theme", "legal_nature"
        ).order_by("order", "anchor_sentence__index")
    )
    return {
        "doc": annotation.document.external_id,
        "project": annotation.project.slug,
        "annotator": annotation.annotator.username,
        "schema": annotation.project.scheme.slug,
        "status": annotation.status,
        "global_certainty": annotation.global_certainty,
        "clauses": [
            {
                "anchor_index": c.anchor_sentence.index,
                "theme": c.theme.code,
                "legal_nature": c.legal_nature.code if c.legal_nature else None,
                "evidence_span": c.evidence_span,
                "rationale": c.rationale,
                "certainty": c.certainty,
            }
            for c in clauses
        ],
    }


@transaction.atomic
def create_version(
    annotation: Annotation, author, label: str = ""
) -> AnnotationVersion:
    """Create the next immutable snapshot version."""
    last = annotation.versions.order_by("-number").first()
    number = (last.number if last else 0) + 1
    version = AnnotationVersion.objects.create(
        annotation=annotation,
        number=number,
        snapshot=build_snapshot(annotation),
        author=author,
        label=label,
    )
    record_event(
        actor=author,
        verb="annotation.versioned",
        target=annotation,
        payload={"version": number, "label": label},
    )
    logger.info("version_created ann=%s number=%s", annotation.pk, number)
    return version


@transaction.atomic
def transition_status(
    annotation: Annotation, new_status: str, actor
) -> Annotation:
    """Single authority for status changes (INV-5)."""
    current = annotation.status
    if new_status == current:
        return annotation
    allowed = ALLOWED_TRANSITIONS.get(current, set())
    if new_status not in allowed:
        raise Conflict(
            f"Illegal transition {current} -> {new_status}. "
            f"Allowed: {sorted(allowed)}"
        )

    annotation.status = new_status
    annotation.save(update_fields=["status", "updated_at"])

    record_event(
        actor=actor,
        verb=f"annotation.{new_status}",
        target=annotation,
        payload={"from": current, "to": new_status},
    )
    if new_status in SNAPSHOTTING_TRANSITIONS:
        create_version(annotation, author=actor, label=f"auto:{new_status}")

    logger.info(
        "transition ann=%s %s->%s actor=%s",
        annotation.pk, current, new_status, getattr(actor, "pk", None),
    )
    return annotation


def diff_versions(a: AnnotationVersion, b: AnnotationVersion) -> dict:
    """Compute a clause-level diff between two snapshots (feature 3).

    Keyed on anchor_index. Returns added / removed / changed.
    """
    def by_anchor(snapshot: dict) -> dict[int, dict]:
        return {c["anchor_index"]: c for c in snapshot.get("clauses", [])}

    old = by_anchor(a.snapshot)
    new = by_anchor(b.snapshot)
    old_keys, new_keys = set(old), set(new)

    added = [new[k] for k in sorted(new_keys - old_keys)]
    removed = [old[k] for k in sorted(old_keys - new_keys)]
    changed = []
    for k in sorted(old_keys & new_keys):
        if old[k] != new[k]:
            changed.append({"anchor_index": k, "before": old[k], "after": new[k]})

    return {
        "from_version": a.number,
        "to_version": b.number,
        "added": added,
        "removed": removed,
        "changed": changed,
        "summary": {
            "added": len(added),
            "removed": len(removed),
            "changed": len(changed),
        },
    }

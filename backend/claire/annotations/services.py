"""Annotation domain services (INV-5): state machine, snapshot & diff, seeding.

All status transitions MUST go through `transition_status` so that, in the
same transaction, we (a) update status, (b) emit an ActivityEvent, and
(c) optionally create an immutable AnnotationVersion snapshot.
"""

from __future__ import annotations

import logging

from django.db import transaction
from django.utils import timezone

from rest_framework import serializers as drf_serializers

from claire.audit.services import record_event
from claire.common.exceptions import Conflict
from claire.schemes.models import Theme

from .models import (
    Annotation,
    AnnotationStatus,
    AnnotationVersion,
    Clause,
    ClauseRole,
    ClauseTheme,
    validate_clause_theme_set,
)

logger = logging.getLogger("claire.annotations")


@transaction.atomic
def set_clause_theme_tags(clause: Clause, themes_input: list[dict], scheme) -> list[ClauseTheme]:
    """Remplace l'ensemble multi-label d'une clause et synchronise le miroir scalaire.

    themes_input = [{"label": code, "role": "primary"|"secondary", "support"?: int}, ...].
    Valide les invariants (exactement un primary ; refuge jamais secondary), persiste les
    ClauseTheme et met à jour `clause.theme` (= primaire) pour la rétro-compatibilité.
    Lève serializers.ValidationError (→ 422) si invalide.
    """
    if not themes_input:
        raise drf_serializers.ValidationError({"themes": "au moins un thème requis."})

    tags: list[ClauseTheme] = []
    for i, t in enumerate(themes_input):
        code = (t or {}).get("label")
        role = (t or {}).get("role")
        if role not in (ClauseRole.PRIMARY, ClauseRole.SECONDARY):
            raise drf_serializers.ValidationError({"themes": f"rôle invalide: {role!r}"})
        try:
            theme = scheme.themes.get(code=code)
        except Theme.DoesNotExist:
            raise drf_serializers.ValidationError(
                {"themes": f"thème '{code}' absent du scheme {scheme.slug}."}
            )
        tags.append(ClauseTheme(
            clause=clause, theme=theme, role=role,
            support=int(t.get("support") or 0), order=i,
        ))

    try:
        validate_clause_theme_set(tags)
    except Exception as exc:  # ValidationError Django → 422 DRF
        raise drf_serializers.ValidationError({"themes": str(exc)})

    clause.theme_tags.all().delete()
    ClauseTheme.objects.bulk_create(tags)
    primary = next(t for t in tags if t.role == ClauseRole.PRIMARY)
    if clause.theme_id != primary.theme_id:
        clause.theme = primary.theme
        clause.save(update_fields=["theme"])
    return tags


def ensure_primary_tag(clause: Clause) -> None:
    """Garantit qu'une clause mono porte 1 ClauseTheme primary (= son thème scalaire)."""
    if not clause.theme_tags.exists():
        ClauseTheme.objects.create(
            clause=clause, theme=clause.theme, role=ClauseRole.PRIMARY, support=0, order=0
        )

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
        )
        .prefetch_related("theme_tags__theme")
        .order_by("order", "anchor_sentence__index")
    )
    return {
        "doc": annotation.document.external_id,
        "project": annotation.project.slug,
        "annotator": annotation.annotator.username,
        "schema": annotation.project.scheme.slug,
        "status": annotation.status,
        # `source` distingue une annotation humaine d'un seed LLM ; `updated_at`
        # horodate la session — sans eux l'export perdait cette information (audit).
        "source": annotation.source,
        "updated_at": annotation.updated_at.isoformat() if annotation.updated_at else None,
        "global_certainty": annotation.global_certainty,
        "clauses": [
            {
                "anchor_index": c.anchor_sentence.index,
                "theme": c.theme.code,
                "legal_nature": c.legal_nature.code if c.legal_nature else None,
                "evidence_span": c.evidence_span,
                "rationale": c.rationale,
                "certainty": c.certainty,
                # `validated` : seule une clause validée fait référence (point d) ;
                # `order` : ordre de saisie. Indispensables pour distinguer le gold
                # humain validé d'un seed non retravaillé à l'export.
                "validated": c.validated,
                "order": c.order,
                # Multi-label / frontière / niveau (additif) — primaire = `theme` (legacy).
                "themes": [
                    {"label": t.theme.code, "role": t.role, "support": t.support}
                    for t in c.theme_tags.all()
                ] or [{"label": c.theme.code, "role": "primary", "support": 0}],
                "boundary": {"type": c.boundary_type, "support": c.boundary_support},
                "triage_level": c.triage_level or None,
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
    update_fields = ["status", "updated_at"]
    # Verrouillage en fonction de l'état (orthogonal au lock MANUEL) :
    #  - entrée en `submitted` → VERROUILLE (édition gelée jusqu'au déverrouillage) ;
    #  - retour en `draft` (réouverture) → DÉVERROUILLE (on peut ré-éditer).
    # Les autres transitions (in_review, approved, rejected, archived) conservent
    # l'état de verrou courant.
    if new_status == AnnotationStatus.SUBMITTED:
        annotation.locked = True
        annotation.locked_at = timezone.now()
        annotation.locked_by = actor if getattr(actor, "pk", None) else None
        update_fields += ["locked", "locked_at", "locked_by"]
    elif new_status == AnnotationStatus.DRAFT:
        annotation.locked = False
        annotation.locked_at = None
        annotation.locked_by = None
        update_fields += ["locked", "locked_at", "locked_by"]
    annotation.save(update_fields=update_fields)

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

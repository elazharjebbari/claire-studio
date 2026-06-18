"""Audit service — emit ActivityEvent entries (append-only)."""

import logging

from .models import ActivityEvent

logger = logging.getLogger("claire.audit")


def record_event(actor, verb: str, target, payload: dict | None = None) -> ActivityEvent:
    """Append a single audit event.

    `target` may be a model instance (uses _meta.label_lower + pk) or a
    (type_str, id_str) tuple.
    """
    if isinstance(target, tuple):
        target_type, target_id = target
    else:
        target_type = target._meta.label_lower
        target_id = str(target.pk)

    event = ActivityEvent.objects.create(
        actor=actor,
        verb=verb,
        target_type=target_type,
        target_id=str(target_id),
        payload=payload or {},
    )
    logger.info(
        "activity verb=%s target=%s#%s actor=%s",
        verb, target_type, target_id, getattr(actor, "pk", None),
    )
    return event

"""post_save signal: emit an ActivityEvent when an Annotation is created.

Status-transition events are emitted explicitly by the state machine service
(INV-5), but creation is tracked here so every annotation has a trace.
"""

import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from claire.audit.services import record_event

from .models import Annotation

logger = logging.getLogger("claire.annotations")


@receiver(post_save, sender=Annotation, dispatch_uid="annotation_created_audit")
def annotation_created(sender, instance: Annotation, created: bool, **kwargs):
    if created and instance.annotator_id:
        record_event(
            actor=instance.annotator,
            verb="annotation.created",
            target=instance,
            payload={
                "project": instance.project_id,
                "document": instance.document_id,
                "source": instance.source,
            },
        )

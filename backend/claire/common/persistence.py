"""Petits helpers de persistance qui évitent les écritures sans changement."""

from django.db import models


def update_or_create_changed(model: type[models.Model], *, defaults: dict, **lookup):
    """Équivalent idempotent d'``update_or_create``.

    ``update_or_create`` appelle ``save`` même si toutes les valeurs sont identiques,
    ce qui modifie les champs ``auto_now`` et rend un seed observable au second passage.
    """

    instance, created = model.objects.get_or_create(defaults=defaults, **lookup)
    if created:
        return instance, True
    changed = []
    for field, value in defaults.items():
        if getattr(instance, field) != value:
            setattr(instance, field, value)
            changed.append(field)
    if changed:
        if any(field.name == "updated_at" for field in instance._meta.fields):
            changed.append("updated_at")
        instance.save(update_fields=changed)
    return instance, False

"""Synchronisation `Assignment.status` ↔ état de l'`Annotation` (raffinement R2).

La file de travail (« Mes annotations ») et l'avancement admin doivent refléter
la réalité — à faire / en cours / terminé — SANS action manuelle. On dérive le
statut de l'assignation de l'état réel de l'annotation, via des signaux qui
couvrent TOUS les chemins d'écriture (création, autosave de clauses, soumission,
transitions de revue), y compris ceux qui ne passent pas par les vues.
"""

from __future__ import annotations

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from claire.annotations.models import Annotation, Clause

from .models import Assignment, AssignmentStatus

# Statuts d'annotation considérés comme « rendu » (annotation terminée/soumise).
_SUBMITTED = {"submitted", "in_review", "approved"}


def recompute_assignment_status(annotation: Annotation) -> None:
    """Aligne l'assignation correspondante sur l'état réel de l'annotation.

    - ``done``        : annotation soumise / en revue / approuvée ;
    - ``in_progress`` : au moins une clause posée ;
    - ``pending``     : aucune clause (brouillon vide).

    No-op si aucune assignation ne correspond (annotation libre) ou si le statut
    est déjà à jour — on n'écrit que le champ ``status`` quand il change.
    """
    assignment = Assignment.objects.filter(
        project_id=annotation.project_id,
        document_id=annotation.document_id,
        assignee_id=annotation.annotator_id,
    ).first()
    if assignment is None:
        return

    if annotation.status in _SUBMITTED:
        new_status = AssignmentStatus.DONE
    # Requête fraîche (PAS `annotation.clauses.exists()`) : la vue récupère
    # l'annotation avec prefetch_related("clauses…"), dont le cache — peuplé AVANT
    # l'ajout de la clause — ferait répondre exists()=False à tort dans le signal.
    elif Clause.objects.filter(annotation_id=annotation.pk).exists():
        new_status = AssignmentStatus.IN_PROGRESS
    else:
        new_status = AssignmentStatus.PENDING

    if assignment.status != new_status:
        assignment.status = new_status
        assignment.save(update_fields=["status"])


@receiver(post_save, sender=Annotation, dispatch_uid="sync_assignment_on_annotation")
def _on_annotation_saved(sender, instance: Annotation, **kwargs) -> None:
    recompute_assignment_status(instance)


@receiver(post_save, sender=Clause, dispatch_uid="sync_assignment_on_clause_saved")
def _on_clause_saved(sender, instance: Clause, **kwargs) -> None:
    recompute_assignment_status(instance.annotation)


@receiver(post_delete, sender=Clause, dispatch_uid="sync_assignment_on_clause_deleted")
def _on_clause_deleted(sender, instance: Clause, **kwargs) -> None:
    # La dernière clause retirée d'un brouillon doit ramener l'assignation à
    # « pending ». L'annotation parente peut déjà être supprimée (cascade) : on
    # ignore alors silencieusement.
    try:
        annotation = instance.annotation
    except Annotation.DoesNotExist:
        return
    recompute_assignment_status(annotation)

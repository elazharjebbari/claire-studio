"""Promotion des juges LLM en COMPTES ANNOTATEURS.

Permet d'ajouter (ou retirer) claude/codex/mistral comme de vrais annotateurs : on crée un
compte du nom du juge et on dérive ses annotations SOUMISES de ses pré-annotations
(`seed_annotation_from_preannotation`). Une fois promu, le juge vote comme un humain
(is_llm=False) et n'apparaît plus en référence LLM (cf. build_document_data).

Réversible : retirer supprime les annotations dérivées → le juge redevient une référence LLM.
"""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import transaction

from claire.annotations.models import Annotation, AnnotationStatus
from claire.annotations.services import transition_status
from claire.imports.models import PreAnnotation, judge_display_rank
from claire.projects.models import Assignment, MembershipRole, ProjectMembership

from .config import annotation_statuses

User = get_user_model()


def _llm_email(judge: str) -> str:
    return f"{judge}@llm.pactiva.local"


def _llm_user(judge: str):
    """Compte LLM existant (identifié par son e-mail dédié), ou None."""
    return User.objects.filter(username=judge, email=_llm_email(judge)).first()


def _judge_user(judge: str):
    """Compte annotateur LLM portant le nom du juge (créé si besoin ; connexion désactivée).

    Anti-hijack : si un compte HUMAIN porte déjà ce nom (e-mail différent), on refuse — on
    ne réutilise/supprime JAMAIS un compte qui n'est pas le compte LLM dédié."""
    from claire.common.exceptions import Conflict

    existing = User.objects.filter(username=judge).first()
    if existing is not None and existing.email != _llm_email(judge):
        raise Conflict(f"Un compte « {judge} » existe déjà et n'est pas un compte LLM.")
    user = existing or User.objects.create(
        username=judge,
        email=_llm_email(judge),
        role="annotator",
        display_name=f"{judge.capitalize()} (LLM)",
    )
    if existing is None:
        user.set_unusable_password()
        user.save(update_fields=["password"])
    return user


def llm_annotator_status(project) -> list[dict]:
    """Pour chaque juge ayant des pré-annotations : est-il actuellement un annotateur ?"""
    gold_grade = annotation_statuses(project)
    # Dédup par document_id : un juge peut avoir plusieurs schema_versions du MÊME document
    # (la contrainte d'unicité inclut schema_version) — ne pas gonfler le compte de documents.
    by_judge: dict[str, set] = {}
    for p in PreAnnotation.objects.filter(project=project).values("judge", "document_id"):
        by_judge.setdefault(p["judge"], set()).add(p["document_id"])
    out = []
    # Ordre d'AFFICHAGE (taille de modèle décroissante), pas alphabétique : la liste part
    # dans l'UI du studio de config.
    for judge in sorted(by_judge, key=judge_display_rank):
        user = _llm_user(judge)  # compte LLM dédié uniquement
        added = bool(
            user
            and Annotation.objects.filter(
                project=project, annotator=user, status__in=gold_grade
            ).exists()
        )
        out.append({
            "judge": judge,
            "added": added,
            "documents": len(by_judge[judge]),
        })
    return out


@transaction.atomic
def add_llm_annotator(project, judge: str) -> dict:
    """Crée/réutilise le compte <judge> et dérive des annotations SOUMISES de ses
    pré-annotations (une par document), idempotent."""
    user = _judge_user(judge)
    membership, _ = ProjectMembership.objects.get_or_create(
        project=project, user=user, defaults={"role": MembershipRole.ANNOTATOR}
    )
    # Répare une appartenance LLM préexistante au mauvais rôle (ex. REVIEWER hérité) :
    # le juge doit compter comme ANNOTATEUR pour entrer dans les attendus de complétude.
    if membership.role != MembershipRole.ANNOTATOR:
        membership.role = MembershipRole.ANNOTATOR
        membership.save(update_fields=["role"])
    created = 0
    pres = PreAnnotation.objects.filter(project=project, judge=judge).select_related("document")
    for pre in pres:
        document = pre.document
        if Annotation.objects.filter(project=project, document=document, annotator=user).exists():
            continue  # déjà dérivé (idempotent)
        Assignment.objects.get_or_create(project=project, document=document, assignee=user)
        annotation = seed_from_pre(pre, user)
        transition_status(annotation, AnnotationStatus.SUBMITTED, user)
        created += 1
    return {"judge": judge, "added": True, "annotations_created": created}


def seed_from_pre(pre, user):
    # Import tardif pour éviter un cycle au chargement du module.
    from claire.imports.services import seed_annotation_from_preannotation

    return seed_annotation_from_preannotation(pre, user)


@transaction.atomic
def remove_llm_annotator(project, judge: str) -> dict:
    """Retire le compte LLM <judge> du projet : supprime ses annotations dérivées +
    assignations + appartenance. Les pré-annotations restent → le juge redevient une
    référence LLM. N'opère QUE sur le compte LLM dédié (jamais un humain homonyme)."""
    user = _llm_user(judge)  # compte LLM dédié uniquement (e-mail @llm.pactiva.local)
    if user is None:
        return {"judge": judge, "added": False, "annotations_removed": 0}
    removed = Annotation.objects.filter(project=project, annotator=user).count()
    Annotation.objects.filter(project=project, annotator=user).delete()
    Assignment.objects.filter(project=project, assignee=user).delete()
    ProjectMembership.objects.filter(project=project, user=user).delete()
    return {"judge": judge, "added": False, "annotations_removed": removed}

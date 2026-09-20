"""Accès reviewer JURIX 2026 : un compte, deux projets, nos annotations protégées.

Ce que la commande met en place (idempotent, rejouable) :

1. **Le compte partagé** `jurix-reviewer` (rôle utilisateur `reviewer`) — ce rôle est celui de la
   supervision transverse : il LIT les sessions d'autrui dans les projets dont il est membre et
   ne peut JAMAIS en modifier le contenu (`IsAnnotationOwner`, sans dérogation de rôle) ; il ne
   peut pas exporter (exports réservés aux admins).
2. **Le projet de la campagne** (`--campaign`, `campagne-pactiva`) : verrouillé (`locked=True`,
   gel de toutes les sessions) ; le compte y est membre `reviewer`, sans assignation — lecture des
   150 sessions, comparaison humain ↔ juges, concordance ; aucune écriture possible.
3. **Un bac à sable** (`--sandbox`, `jurix2026-sandbox`) : même corpus, même schéma, privé, non
   verrouillé ; le compte y est membre `annotator` avec une assignation par document — les
   reviewers annotent eux-mêmes, dans leurs propres sessions, sans toucher aux nôtres.
4. **Pseudonymes à l'écran** : les comptes ayant annoté la campagne reçoivent le nom d'affichage
   `Annotator A1/A2/A3` (ordre alphabétique des identifiants, la règle des données publiées) ;
   l'interface affiche le nom d'affichage avant l'identifiant. Réversible avec
   `--restore-display-names`.

Le mot de passe est passé en argument (`--password`) ou généré ; il n'est écrit nulle part.
"""
from __future__ import annotations

import secrets

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from claire.accounts.models import Role
from claire.projects.models import (
    Assignment,
    MembershipRole,
    Project,
    ProjectMembership,
    ProjectVisibility,
)

User = get_user_model()
REVIEWER_USERNAME = "jurix-reviewer"
REVIEWER_EMAIL = "reviewer@pactiva.legal"


class Command(BaseCommand):
    help = "Crée ou met à jour l'accès reviewer (compte partagé, campagne verrouillée en lecture, bac à sable)."

    def add_arguments(self, parser):
        parser.add_argument("--campaign", default="campagne-pactiva", help="slug du projet de la campagne")
        parser.add_argument("--sandbox", default="jurix2026-sandbox", help="slug du projet bac à sable")
        parser.add_argument("--sandbox-name", default="JURIX 2026 — reviewer sandbox")
        parser.add_argument("--password", default=None, help="mot de passe du compte (généré sinon)")
        parser.add_argument("--username", default=REVIEWER_USERNAME)
        parser.add_argument("--no-pseudonyms", action="store_true",
                            help="ne pas renommer les annotateurs de la campagne en Annotator A1/A2/A3")
        parser.add_argument("--restore-display-names", action="store_true",
                            help="rétablit un nom d'affichage vide pour les annotateurs pseudonymisés")
        parser.add_argument("--documents", default="all", choices=["all", "holdout"],
                            help="documents assignés dans le bac à sable")

    @transaction.atomic
    def handle(self, *args, **o):
        try:
            campaign = Project.objects.select_related("corpus", "scheme").get(slug=o["campaign"])
        except Project.DoesNotExist as exc:
            raise CommandError(f"projet de campagne introuvable : {o['campaign']!r}") from exc

        # 1) compte partagé
        password = o["password"] or secrets.token_urlsafe(12)
        user, created = User.objects.get_or_create(
            username=o["username"],
            defaults={"email": REVIEWER_EMAIL, "role": Role.REVIEWER, "display_name": "JURIX 2026 reviewer",
                      "is_email_verified": True, "locale": "en"},
        )
        user.role = Role.REVIEWER
        user.is_guest = True
        user.is_active = True
        user.is_email_verified = True
        user.set_password(password)
        user.save()

        # 2) campagne : verrouillée, lecture seule pour le compte
        if not campaign.locked:
            campaign.locked = True
            campaign.locked_at = timezone.now()
            campaign.save(update_fields=["locked", "locked_at"])
        ProjectMembership.objects.update_or_create(
            project=campaign, user=user, defaults={"role": MembershipRole.REVIEWER}
        )
        Assignment.objects.filter(project=campaign, assignee=user).delete()

        # 3) bac à sable
        sandbox, _ = Project.objects.get_or_create(
            slug=o["sandbox"],
            defaults={"name": o["sandbox_name"], "corpus": campaign.corpus, "scheme": campaign.scheme,
                      "visibility": ProjectVisibility.PRIVATE,
                      "guidelines": ("Sandbox for JURIX 2026 reviewers. Annotate freely: your sessions are yours "
                                     "and never enter the released layer. The campaign project is read-only.")},
        )
        if sandbox.locked:
            sandbox.locked = False
            sandbox.save(update_fields=["locked"])
        ProjectMembership.objects.update_or_create(
            project=sandbox, user=user, defaults={"role": MembershipRole.ANNOTATOR}
        )
        documents = campaign.corpus.documents.all()
        if o["documents"] == "holdout":
            from claire.demo.services import holdout_documents
            documents = documents.filter(external_id__in=holdout_documents())
        n_assigned = 0
        for document in documents:
            _, made = Assignment.objects.get_or_create(project=sandbox, document=document, assignee=user)
            n_assigned += int(made)

        # 4) pseudonymes à l'écran pour les annotateurs de la campagne : les comptes qui ont
        # RÉELLEMENT annoté (au moins une session), par ordre alphabétique d'identifiant — la
        # même règle que les données publiées (A1, A2, A3), indépendamment du rôle de membre.
        from claire.annotations.models import Annotation

        annotators = list(
            User.objects.filter(pk__in=Annotation.objects.filter(project=campaign).values("annotator"))
            .exclude(pk=user.pk).order_by("username")
        )
        renamed = []
        if o["restore_display_names"]:
            for a in annotators:
                if a.display_name.startswith("Annotator A"):
                    a.display_name = ""
                    a.save(update_fields=["display_name"])
                    renamed.append(a.username)
        elif not o["no_pseudonyms"]:
            for k, a in enumerate(annotators, start=1):
                label = f"Annotator A{k}"
                if a.display_name != label:
                    a.display_name = label
                    a.save(update_fields=["display_name"])
                    renamed.append(f"A{k}")

        self.stdout.write(self.style.SUCCESS(
            f"compte {'créé' if created else 'mis à jour'} : {user.username} (rôle {user.role}) · "
            f"campagne {campaign.slug} verrouillée, membre reviewer · bac à sable {sandbox.slug} : "
            f"{Assignment.objects.filter(project=sandbox, assignee=user).count()} documents assignés "
            f"({n_assigned} nouveaux) · pseudonymes : {renamed or 'inchangés'}"
        ))
        self.stdout.write(f"identifiant : {user.username}\nmot de passe : {password}")
        self.stdout.write("Ce mot de passe n'est stocké nulle part : transmettez-le par le canal des chairs.")

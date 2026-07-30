"""Crée UN compte utilisateur (par défaut annotateur) + adhésion campagne (idempotent).

Généralise `seed_team` (qui a une liste d'équipe figée) à la création à la demande d'un
compte unique : username/email en arguments, mot de passe explicite (`--password`) ou
aléatoire, rattachement optionnel à une campagne et assignation optionnelle de ses documents.

Comme `seed_team` :
- le mot de passe est HACHÉ via `set_password` (jamais stocké/affiché en clair, sauf le JSON
  protégé écrit via `--out`, en `chmod 600`) ;
- rejouable : `get_or_create` partout ; le mot de passe n'est posé qu'à la CRÉATION du compte
  (un compte déjà présent n'est jamais réinitialisé).

Exemple (prod) :
  DJANGO_SETTINGS_MODULE=config.settings.prod \\
    python manage.py create_annotator fatima.ouali \\
      --email oualifatima082@gmail.com --password 'Pactiva2026!' --assign \\
      --out /var/www/claire-studio/backend/.credentials/fatima.ouali.json
"""

from __future__ import annotations

import json
import os
import secrets
from datetime import datetime, timezone

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from claire.accounts.models import Role
from claire.corpora.models import Corpus, Document
from claire.projects.models import (
    Assignment,
    MembershipRole,
    Project,
    ProjectMembership,
    ProjectVisibility,
)
from claire.schemes.models import LabelScheme

User = get_user_model()

# Rôle global (accounts.Role) → rôle d'adhésion campagne (projects.MembershipRole).
_MEMBERSHIP_FOR_ROLE = {
    Role.ANNOTATOR: MembershipRole.ANNOTATOR,
    Role.REVIEWER: MembershipRole.REVIEWER,
    Role.ADMIN: MembershipRole.LEAD,
    Role.OWNER: MembershipRole.LEAD,
}


class Command(BaseCommand):
    help = "Crée un compte utilisateur (annotateur par défaut) + adhésion campagne, idempotent."

    def add_arguments(self, parser):
        parser.add_argument("username", help="Identifiant de connexion (ex. prenom.nom).")
        parser.add_argument("--email", required=True, help="E-mail (unique).")
        parser.add_argument("--role", default=Role.ANNOTATOR, choices=[r.value for r in Role])
        parser.add_argument("--display-name", default=None, help="Nom affiché (défaut : dérivé du username).")
        parser.add_argument("--locale", default="fr")
        parser.add_argument(
            "--password", default=None,
            help="Mot de passe temporaire explicite ; à défaut, aléatoire (à changer ensuite).",
        )
        parser.add_argument("--password-length", type=int, default=14)
        parser.add_argument(
            "--no-campaign", action="store_true",
            help="Ne rattache pas le compte à une campagne (crée juste l'utilisateur).",
        )
        parser.add_argument("--project-slug", default="campagne-pactiva")
        parser.add_argument("--project-name", default="Campagne d'annotation Pactiva")
        parser.add_argument(
            "--assign", action="store_true",
            help="Assigne tous les documents de la campagne au compte.",
        )
        parser.add_argument("--out", default=None, help="Fichier de sortie des identifiants (JSON, chmod 600).")

    @transaction.atomic
    def handle(self, *args, **opts):
        username = opts["username"].strip()
        email = opts["email"].strip()
        role = opts["role"]
        display_name = opts["display_name"] or username.replace(".", " ").title()
        is_super = role in {Role.ADMIN, Role.OWNER}

        # Garde-fou : email déjà pris par un AUTRE compte (contrainte unique côté DB sinon 500).
        clash = User.objects.filter(email=email).exclude(username=username).first()
        if clash:
            raise CommandError(
                f"L'e-mail {email} est déjà utilisé par le compte « {clash.username} »."
            )

        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                "email": email,
                "role": role,
                "display_name": display_name,
                "locale": opts["locale"],
                "is_staff": is_super,
                "is_superuser": is_super,
                "is_email_verified": True,
            },
        )

        record: dict = {"username": username, "email": user.email, "role": user.role}
        if created:
            password = opts["password"] or secrets.token_urlsafe(opts["password_length"])
            user.set_password(password)
            user.save()
            record.update({"password": password, "status": "créé"})
            self.stdout.write(self.style.SUCCESS(f"  + {username} créé ({role})"))
        else:
            record.update({"password": None, "status": "déjà présent (mot de passe inchangé)"})
            self.stdout.write(f"  = {username} déjà présent (inchangé)")

        project = None
        if not opts["no_campaign"]:
            corpus = (
                Corpus.objects.filter(slug=getattr(settings, "SEED_CORPUS_SLUG", "")).first()
                or Corpus.objects.first()
            )
            scheme = LabelScheme.objects.first()
            if not corpus or not scheme:
                raise CommandError(
                    "Aucun corpus/scheme en base : lancez d'abord `manage.py seed_demo`, "
                    "ou passez --no-campaign."
                )
            project, p_created = Project.objects.get_or_create(
                slug=opts["project_slug"],
                defaults={
                    "name": opts["project_name"],
                    "corpus": corpus,
                    "scheme": scheme,
                    "guidelines": "Annoter les frontières de clauses par thème. Certitude 0–3.",
                    "status": "active",
                    "visibility": ProjectVisibility.PRIVATE,
                },
            )
            self.stdout.write(
                f"  campagne « {project.slug} » {'créée' if p_created else 'déjà présente'}"
            )

            membership_role = _MEMBERSHIP_FOR_ROLE.get(role, MembershipRole.ANNOTATOR)
            _, m_created = ProjectMembership.objects.get_or_create(
                project=project, user=user, defaults={"role": membership_role}
            )
            self.stdout.write(
                f"  adhésion : {username} → {project.slug} "
                f"({'ajoutée' if m_created else 'déjà présente'})"
            )
            record["project"] = {"slug": project.slug, "name": project.name}

        if opts["assign"]:
            if project is None:
                raise CommandError("--assign requiert une campagne (retirer --no-campaign).")
            docs = list(Document.objects.filter(corpus=project.corpus))
            made = 0
            for doc in docs:
                _, a_created = Assignment.objects.get_or_create(
                    project=project, document=doc, assignee=user
                )
                made += int(a_created)
            self.stdout.write(self.style.SUCCESS(
                f"  assignations : {len(docs)} doc(s) → {made} créée(s) "
                f"({len(docs) - made} déjà présentes)"
            ))

        out_path = opts["out"]
        if out_path:
            base = getattr(settings, "FRONTEND_BASE_URL", "https://pactiva.legal")
            payload = {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "site": base,
                "login_url": f"{base}/login",
                "note": "Mot de passe temporaire — À CHANGER à la première connexion.",
                "account": record,
            }
            os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
            with open(out_path, "w", encoding="utf-8") as fh:
                json.dump(payload, fh, ensure_ascii=False, indent=2)
            os.chmod(out_path, 0o600)
            self.stdout.write(self.style.SUCCESS(f"  identifiants écrits dans {out_path} (chmod 600)"))
        elif created:
            self.stdout.write(self.style.WARNING("  (--out non fourni : identifiants non persistés sur disque)"))

        self.stdout.write(self.style.SUCCESS(f"Compte « {username} » prêt."))

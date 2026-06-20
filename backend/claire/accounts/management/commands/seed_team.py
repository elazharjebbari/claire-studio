"""Crée l'équipe Pactiva + une campagne d'annotation (idempotent).

Comptes créés (mots de passe aléatoires, à changer ensuite) :
- elazhar.jebbari  → OWNER (superuser), LEAD de la campagne
- jc.lamirel       → annotateur
- zahra.boulaich   → annotateur

Une *fixture* Django ne peut pas hacher les mots de passe : on passe donc par une
management command qui utilise `set_password` (hachage) et écrit les identifiants
en clair dans un fichier protégé (`chmod 600`) — jamais sur stdout.

Re-jouable : `get_or_create` partout ; les mots de passe ne sont posés/écrits qu'à la
CRÉATION d'un compte (un compte déjà présent n'est jamais réinitialisé).

Exemple :
  DJANGO_SETTINGS_MODULE=config.settings.prod \\
    python manage.py seed_team --out /var/www/claire-studio/backend/.credentials/team.json
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

from claire.corpora.models import Corpus
from claire.projects.models import (
    MembershipRole,
    Project,
    ProjectMembership,
    ProjectVisibility,
)
from claire.schemes.models import LabelScheme

User = get_user_model()

# (username, email, rôle global, membre de la campagne avec ce rôle, superuser ?)
TEAM = [
    ("elazhar.jebbari", "elazhar.jebbari@gmail.com", "owner", MembershipRole.LEAD, True),
    ("jc.lamirel", "jc.lamirel@pactiva.legal", "annotator", MembershipRole.ANNOTATOR, False),
    ("zahra.boulaich", "zahra.boulaich@pactiva.legal", "annotator", MembershipRole.ANNOTATOR, False),
]


class Command(BaseCommand):
    help = "Crée les comptes de l'équipe Pactiva + une campagne d'annotation."

    def add_arguments(self, parser):
        parser.add_argument("--out", default=None, help="Fichier de sortie des identifiants (JSON).")
        parser.add_argument("--project-slug", default="campagne-pactiva")
        parser.add_argument("--project-name", default="Campagne d'annotation Pactiva")
        parser.add_argument("--password-length", type=int, default=14)

    @transaction.atomic
    def handle(self, *args, **opts):
        corpus = (
            Corpus.objects.filter(slug=getattr(settings, "SEED_CORPUS_SLUG", "")).first()
            or Corpus.objects.first()
        )
        scheme = LabelScheme.objects.first()
        if not corpus or not scheme:
            raise CommandError(
                "Aucun corpus/scheme en base : lancez d'abord `manage.py seed_demo`."
            )

        records: list[dict] = []
        members: list[tuple] = []

        for username, email, role, membership_role, is_super in TEAM:
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "email": email,
                    "role": role,
                    "display_name": username.replace(".", " ").title(),
                    "is_staff": is_super,
                    "is_superuser": is_super,
                    "is_email_verified": True,
                },
            )
            if created:
                password = secrets.token_urlsafe(opts["password_length"])
                user.set_password(password)
                user.save()
                records.append(
                    {"username": username, "email": email, "role": role,
                     "password": password, "status": "créé"}
                )
                self.stdout.write(self.style.SUCCESS(f"  + {username} créé ({role})"))
            else:
                records.append(
                    {"username": username, "email": user.email, "role": user.role,
                     "password": None, "status": "déjà présent (mot de passe inchangé)"}
                )
                self.stdout.write(f"  = {username} déjà présent (inchangé)")
            members.append((user, membership_role))

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
            self.style.SUCCESS(f"  campagne « {project.slug} » {'créée' if p_created else 'déjà présente'} "
                               f"(corpus={corpus.slug}, scheme={scheme.slug})")
        )

        for user, membership_role in members:
            ProjectMembership.objects.get_or_create(
                project=project, user=user, defaults={"role": membership_role}
            )
        self.stdout.write(f"  membres : {', '.join(u.username for u, _ in members)}")

        out_path = opts["out"]
        if out_path:
            payload = {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "site": getattr(settings, "FRONTEND_BASE_URL", "https://pactiva.legal"),
                "login_url": f"{getattr(settings, 'FRONTEND_BASE_URL', 'https://pactiva.legal')}/login",
                "project": {"slug": project.slug, "name": project.name},
                "note": "Mots de passe par défaut — À CHANGER à la première connexion.",
                "accounts": records,
            }
            os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
            with open(out_path, "w", encoding="utf-8") as fh:
                json.dump(payload, fh, ensure_ascii=False, indent=2)
            os.chmod(out_path, 0o600)
            self.stdout.write(self.style.SUCCESS(f"  identifiants écrits dans {out_path} (chmod 600)"))
        else:
            self.stdout.write(self.style.WARNING("  (--out non fourni : identifiants non persistés)"))

        self.stdout.write(self.style.SUCCESS("Équipe + campagne prêtes."))

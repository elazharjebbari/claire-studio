"""Custom User (CONTRACT §2).

User(PK id, *username, *email, *role[annotator|reviewer|admin|owner], display_name?, locale)
"""

from django.contrib.auth.models import AbstractUser
from django.db import models


class Role(models.TextChoices):
    ANNOTATOR = "annotator", "Annotator"
    REVIEWER = "reviewer", "Reviewer"
    ADMIN = "admin", "Admin"
    OWNER = "owner", "Owner"


class User(AbstractUser):
    # email is required & unique for this platform.
    email = models.EmailField(unique=True)
    role = models.CharField(
        max_length=16, choices=Role.choices, default=Role.ANNOTATOR
    )
    display_name = models.CharField(max_length=150, blank=True)
    locale = models.CharField(max_length=12, default="en")
    # Vérification e-mail (chantier E). Les comptes seedés sont marqués vérifiés.
    is_email_verified = models.BooleanField(default=False)
    # Compte INVITÉ (accès reviewer JURIX) : lecture des sessions et du gold des projets dont il est
    # membre, annotation dans ses propres sessions seulement ; aucune configuration, aucun Lab,
    # aucune analyse, aucun export, aucune écriture collaborative. Appliqué par
    # `claire.common.middleware.GuestAccessMiddleware` et reflété par l'interface (`isGuest`).
    is_guest = models.BooleanField(default=False)
    # Préférences d'interface PAR COMPTE (overlays atelier, panneaux, auto-pré-annotation) —
    # blob JSON versionné camelCase (contrat front lib/prefs/schema.ts), fusionné aux défauts
    # à la lecture. Absence = défauts front (aucune data-migration). Whitelisté à l'écriture
    # via accounts.ui_prefs.merge_ui_preferences ; exclu de la conversion camel↔snake.
    ui_preferences = models.JSONField(default=dict, blank=True)

    REQUIRED_FIELDS = ["email"]

    def __str__(self) -> str:  # pragma: no cover - repr only
        return self.username

    @property
    def is_admin_role(self) -> bool:
        return self.role in {Role.ADMIN, Role.OWNER} or self.is_superuser

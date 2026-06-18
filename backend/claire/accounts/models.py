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

    REQUIRED_FIELDS = ["email"]

    def __str__(self) -> str:  # pragma: no cover - repr only
        return self.username

    @property
    def is_admin_role(self) -> bool:
        return self.role in {Role.ADMIN, Role.OWNER} or self.is_superuser

"""Project / ProjectMembership / Assignment (CONTRACT §2)."""

from django.conf import settings
from django.db import models

from claire.common.models import TimeStampedModel
from claire.corpora.models import Corpus, Document
from claire.schemes.models import LabelScheme


class ProjectStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    PAUSED = "paused", "Paused"
    CLOSED = "closed", "Closed"


class ProjectVisibility(models.TextChoices):
    PRIVATE = "private", "Private"
    PUBLIC = "public", "Public"


class Project(TimeStampedModel):
    slug = models.SlugField(max_length=120, unique=True)
    name = models.CharField(max_length=200)
    corpus = models.ForeignKey(
        Corpus, on_delete=models.PROTECT, related_name="projects"
    )
    scheme = models.ForeignKey(
        LabelScheme, on_delete=models.PROTECT, related_name="projects"
    )
    guidelines = models.TextField(blank=True)  # markdown
    status = models.CharField(
        max_length=16, choices=ProjectStatus.choices, default=ProjectStatus.ACTIVE
    )
    # Publication (chantier F) : privé par défaut (RGPD/confidentialité) ; un projet
    # n'expose ses agrégats en lecture seule publique que s'il est rendu public.
    visibility = models.CharField(
        max_length=10,
        choices=ProjectVisibility.choices,
        default=ProjectVisibility.PRIVATE,
    )
    settings = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["slug"]

    def __str__(self) -> str:  # pragma: no cover
        return self.slug


class MembershipRole(models.TextChoices):
    ANNOTATOR = "annotator", "Annotator"
    REVIEWER = "reviewer", "Reviewer"
    LEAD = "lead", "Lead"


class ProjectMembership(models.Model):
    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="memberships"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="memberships",
    )
    role = models.CharField(
        max_length=16, choices=MembershipRole.choices,
        default=MembershipRole.ANNOTATOR,
    )
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["project", "user"], name="uniq_membership_project_user"
            )
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.project.slug}:{self.user_id}:{self.role}"


class AssignmentStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    IN_PROGRESS = "in_progress", "In progress"
    DONE = "done", "Done"


class Assignment(models.Model):
    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="assignments"
    )
    document = models.ForeignKey(
        Document, on_delete=models.CASCADE, related_name="assignments"
    )
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="assignments",
    )
    status = models.CharField(
        max_length=16, choices=AssignmentStatus.choices,
        default=AssignmentStatus.PENDING,
    )
    due_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["project", "document", "assignee"],
                name="uniq_assignment_project_doc_assignee",
            )
        ]
        ordering = ["project", "document"]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.project.slug}:{self.document.external_id}->{self.assignee_id}"

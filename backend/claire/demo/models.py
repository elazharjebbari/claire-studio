"""Job de classification de la démonstration publique.

Le texte soumis n'est JAMAIS stocké ici : il vit dans un fichier temporaire du job, supprimé à
la fin (succès ou échec). Le résultat (phrases + thèmes) est conservé 24 h pour le sondage et
le rechargement de la page, puis purgé par `purge_old_jobs`.
"""
import uuid

from django.db import models


class DemoJobStatus(models.TextChoices):
    QUEUED = "queued", "En file"
    RUNNING = "running", "En cours"
    DONE = "done", "Terminé"
    FAILED = "failed", "Échec"


class DemoJobSource(models.TextChoices):
    TEXT = "text", "Texte collé ou déposé"
    CONTRACT = "contract", "Contrat CLAUDETTE tenu à l'écart"


class DemoJob(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    source = models.CharField(max_length=12, choices=DemoJobSource.choices)
    document = models.CharField(max_length=120, blank=True)
    title = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=12, choices=DemoJobStatus.choices, default=DemoJobStatus.QUEUED)
    n_chars = models.PositiveIntegerField(default=0)
    n_sentences = models.PositiveIntegerField(default=0)
    truncated = models.BooleanField(default=False)
    result = models.JSONField(null=True, blank=True)
    error = models.JSONField(null=True, blank=True)
    # HMAC tronqué de l'adresse (quota / diagnostic) — jamais l'adresse elle-même.
    client_hash = models.CharField(max_length=32, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [models.Index(fields=["status", "created_at"])]

    def __str__(self) -> str:  # pragma: no cover - affichage admin
        return f"DemoJob {self.id} [{self.status}]"

    @property
    def timings(self) -> dict:
        queued = (self.started_at - self.created_at).total_seconds() if self.started_at else None
        run = (self.finished_at - self.started_at).total_seconds() if self.started_at and self.finished_at else None
        return {"queuedS": round(queued, 3) if queued is not None else None,
                "runS": round(run, 3) if run is not None else None}

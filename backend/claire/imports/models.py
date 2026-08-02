"""PreAnnotation / PreClause (CONTRACT §2) — feature 2 (LLM pre-annotations).

Append-only; never mixed with human gold. Used as a pre-filled starting point.
"""

from django.db import models

from claire.corpora.models import Document
from claire.projects.models import Project


# Ordre d'AFFICHAGE des juges (réglette des frontières, comparaison N-way, menus, atelier
# gold) : par TAILLE DE MODÈLE décroissante, pas par ordre d'ajout. Constante de MODULE et
# non attribut de classe : dans une Enum, toute assignation de classe deviendrait un membre.
# Un juge absent d'ici passe en fin de liste (ordre alphabétique) plutôt que de disparaître.
JUDGE_DISPLAY_ORDER = ("fable", "claude", "codex", "mistral")


def judge_display_rank(judge: str) -> tuple[int, str]:
    """Clé de tri d'affichage d'un juge (rang connu, sinon fin de liste)."""
    try:
        return (JUDGE_DISPLAY_ORDER.index(judge), judge)
    except ValueError:
        return (len(JUDGE_DISPLAY_ORDER), judge)


class Judge(models.TextChoices):
    """Nomenclature UNIQUE des juges LLM (backend).

    Toute liste de juges ailleurs dans le code DOIT être dérivée d'ici (cf.
    `KNOWN_JUDGES`, la validation de `gold/llm-annotators`, le défaut de
    `import_preannotations`) : c'est la duplication de cette liste qui a fait manquer
    Mistral dans plusieurs surfaces. Le pendant frontend est `src/lib/llmJudges.ts`,
    dont la parité est testée.
    """

    CLAUDE = "claude", "Claude"
    CODEX = "codex", "Codex"
    MISTRAL = "mistral", "Mistral"
    FABLE = "fable", "Fable"
    OTHER = "other", "Other"

    @classmethod
    def import_judges(cls) -> list[str]:
        """Juges NOMMÉS (hors fourre-tout `other`), dans l'ORDRE D'AFFICHAGE.

        Même ordre partout (import, API, UI) → un seul classement à comprendre. L'ordre de
        déclaration ci-dessus reste l'historique d'ajout et n'a aucune portée d'affichage.
        """
        return sorted((j for j in cls.values if j != cls.OTHER), key=judge_display_rank)


class PreAnnotation(models.Model):
    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="preannotations"
    )
    document = models.ForeignKey(
        Document, on_delete=models.CASCADE, related_name="preannotations"
    )
    judge = models.CharField(max_length=20, choices=Judge.choices)
    schema_version = models.CharField(max_length=40)  # e.g. v9.4 / v9.2
    raw = models.JSONField()
    imported_at = models.DateTimeField(auto_now_add=True)
    mapped = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["project", "document", "judge", "schema_version"],
                name="uniq_preannotation_proj_doc_judge_version",
            )
        ]
        ordering = ["project", "document", "judge"]

    def __str__(self) -> str:  # pragma: no cover
        return f"pre[{self.judge}@{self.schema_version}]:{self.document_id}"


class PreClause(models.Model):
    preannotation = models.ForeignKey(
        PreAnnotation, on_delete=models.CASCADE, related_name="preclauses"
    )
    anchor_index = models.PositiveIntegerField()
    theme_code = models.CharField(max_length=60)
    evidence_span = models.TextField(blank=True)
    rationale = models.TextField(blank=True)
    # Nature juridique proposée par le juge (vocab LLM, ex. OBLIGATION/PROHIBITION/
    # RIGHT_GRANT…), dérivée par phrase dans `annotations[]` du JSON v9.2. Sert la
    # CONSULTATION LLM de la nature (axe 2/3b) — informatif, jamais appliqué d'office.
    legal_nature = models.CharField(max_length=40, blank=True, default="")
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["preannotation", "order"]

    def __str__(self) -> str:  # pragma: no cover
        return f"preclause:{self.theme_code}@{self.anchor_index}"

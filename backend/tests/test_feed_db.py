"""feed_db management command — real-data feed + idempotence (TASK 1).

These tests exercise the command against the real data shipped inside the
project (settings.CLAUDETTE_DIR / PREANNOTATIONS_DIR / TRANSLATIONS_ROOT). They
are skipped cleanly if that data is not present, so the suite still runs on a
checkout without the corpus.
"""

from io import StringIO
from pathlib import Path

import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management import call_command

from claire.annotations.models import Annotation, AnnotationVersion, Clause
from claire.collaboration.models import Comment, Review
from claire.corpora.models import Corpus, Document, ReferenceLabel, Sentence
from claire.imports.models import PreAnnotation
from claire.projects.models import Project, ProjectMembership
from claire.schemes.models import LabelScheme
from claire.translations.models import TranslationSet

pytestmark = pytest.mark.django_db

User = get_user_model()

_HAS_DATA = (Path(settings.CLAUDETTE_DIR) / "Sentences").is_dir()
requires_data = pytest.mark.skipif(
    not _HAS_DATA, reason="real CLAUDETTE data not present under settings.CLAUDETTE_DIR"
)


def _run(**kwargs):
    out = StringIO()
    call_command("feed_db", stdout=out, stderr=StringIO(), **kwargs)
    return out.getvalue()


@requires_data
def test_feed_db_creates_everything():
    _run(max_docs=4, seed_human=True)

    # Scheme from vocabulary.yaml.
    scheme = LabelScheme.objects.get(slug="claire-themes-v1")
    assert scheme.themes.count() > 0

    # Demo users with the demo password.
    for username, role in [
        ("admin", "admin"), ("alice", "annotator"),
        ("bob", "annotator"), ("rita", "reviewer"),
    ]:
        u = User.objects.get(username=username)
        assert u.role == role
        assert u.check_password("claire-demo")

    # At least 2 real documents imported from data/.
    corpus = Corpus.objects.get(slug="claudette-tos")
    assert Document.objects.filter(corpus=corpus).count() >= 2
    assert Sentence.objects.count() > 0
    assert ReferenceLabel.objects.count() > 0

    # Project + memberships.
    project = Project.objects.get(slug="claudette-gold-v1")
    assert ProjectMembership.objects.filter(project=project).count() >= 4

    # Pre-annotations for both judges.
    judges = set(
        PreAnnotation.objects.filter(project=project).values_list("judge", flat=True)
    )
    assert {"claude", "codex"} <= judges

    # Human annotations seeded + submitted, with snapshots.
    anns = Annotation.objects.filter(project=project)
    assert anns.count() >= 2
    assert anns.filter(status="submitted").exists() or anns.filter(
        status="approved"
    ).exists()
    assert Clause.objects.count() > 0
    assert AnnotationVersion.objects.count() > 0  # submit auto-snapshots

    # Example collaboration artefacts.
    assert Comment.objects.count() >= 1
    assert Review.objects.count() >= 1

    # Translation set declared + synced.
    assert TranslationSet.objects.filter(corpus=corpus).exists()


@requires_data
def test_feed_db_human_version_starts_empty():
    """§7 : par défaut (sans --seed-human) la version humaine démarre VIDE.

    Des brouillons humains existent (ouvrables depuis les assignations) mais sans
    aucune clause ni soumission ; le LLM reste une suggestion (PreAnnotation) que
    l'annotateur adopte dans le workspace, jamais copiée dans l'humain.
    """
    _run(max_docs=2)  # seed_human par défaut = False

    project = Project.objects.get(slug="claudette-gold-v1")
    anns = Annotation.objects.filter(project=project)
    assert anns.exists()  # brouillons créés (assignments → annotationId résolu)
    assert all(a.status == "draft" for a in anns)
    assert all(a.source == "human" for a in anns)
    # Aucune trace de pré-remplissage humain depuis le LLM.
    assert Clause.objects.filter(annotation__project=project).count() == 0
    assert AnnotationVersion.objects.count() == 0
    # Les suggestions LLM sont bien là, à adopter.
    assert PreAnnotation.objects.filter(project=project).count() > 0


@requires_data
def test_feed_db_is_idempotent():
    _run(max_docs=4, seed_human=True)
    snapshot = {
        "documents": Document.objects.count(),
        "sentences": Sentence.objects.count(),
        "reference_labels": ReferenceLabel.objects.count(),
        "annotations": Annotation.objects.count(),
        "clauses": Clause.objects.count(),
        "preannotations": PreAnnotation.objects.count(),
        "comments": Comment.objects.count(),
        "reviews": Review.objects.count(),
        "translation_sets": TranslationSet.objects.count(),
        "users": User.objects.count(),
        "memberships": ProjectMembership.objects.count(),
    }

    # Second run must not create any duplicate rows.
    _run(max_docs=4, seed_human=True)
    after = {
        "documents": Document.objects.count(),
        "sentences": Sentence.objects.count(),
        "reference_labels": ReferenceLabel.objects.count(),
        "annotations": Annotation.objects.count(),
        "clauses": Clause.objects.count(),
        "preannotations": PreAnnotation.objects.count(),
        "comments": Comment.objects.count(),
        "reviews": Review.objects.count(),
        "translation_sets": TranslationSet.objects.count(),
        "users": User.objects.count(),
        "memberships": ProjectMembership.objects.count(),
    }
    assert after == snapshot, (snapshot, after)

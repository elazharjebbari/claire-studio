"""Pytest fixtures & factory-boy factories for CLAIRE Studio tests."""

# Shim daphne (chantier D) : channels.testing.__init__ importe son serveur de test
# live (qui dépend de daphne) — non utilisé ici, et daphne n'est pas installable dans
# cet environnement (deps natives sans toolchain). On stubbe daphne.testing pour
# pouvoir importer WebsocketCommunicator. La couche WS réelle reste InMemory en test.
import sys as _sys
import types as _types

if "daphne.testing" not in _sys.modules:
    _daphne = _types.ModuleType("daphne")
    _daphne_testing = _types.ModuleType("daphne.testing")
    _daphne_testing.DaphneProcess = type("DaphneProcess", (), {})
    _daphne.testing = _daphne_testing
    _sys.modules.setdefault("daphne", _daphne)
    _sys.modules["daphne.testing"] = _daphne_testing

import factory
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from claire.annotations.models import Annotation
from claire.corpora.models import Corpus, Document, Sentence
from claire.projects.models import Project
from claire.schemes.models import LabelScheme, LegalNature, Theme

User = get_user_model()


# --------------------------------------------------------------------- factories
class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User
        # Idempotent on username: tolerate a pre-existing user (e.g. demo users
        # committed by the module-scoped feed_db fixture) instead of raising a
        # UNIQUE violation. Keeps tests isolated regardless of run order.
        django_get_or_create = ("username",)

    username = factory.Sequence(lambda n: f"user{n}")
    email = factory.Sequence(lambda n: f"user{n}@claire.local")
    role = "annotator"


class CorpusFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Corpus

    slug = factory.Sequence(lambda n: f"corpus-{n}")
    name = factory.Sequence(lambda n: f"Corpus {n}")


class LabelSchemeFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = LabelScheme

    slug = factory.Sequence(lambda n: f"scheme-{n}")
    name = "Test scheme"
    version = "1.0.0"


class ThemeFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Theme

    scheme = factory.SubFactory(LabelSchemeFactory)
    code = factory.Sequence(lambda n: f"THEME_{n}")
    label = "Theme"


class DocumentFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Document

    corpus = factory.SubFactory(CorpusFactory)
    external_id = factory.Sequence(lambda n: f"Doc{n}")
    title = factory.Sequence(lambda n: f"Doc {n}")
    n_sentences = 0


class ProjectFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Project

    slug = factory.Sequence(lambda n: f"project-{n}")
    name = "Project"
    corpus = factory.SubFactory(CorpusFactory)
    scheme = factory.SubFactory(LabelSchemeFactory)


# --------------------------------------------------------------------- helpers
@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def admin_user(db):
    return UserFactory(username="admin", role="admin", is_superuser=True,
                       is_staff=True)


@pytest.fixture
def annotator(db):
    return UserFactory(username="alice", role="annotator")


@pytest.fixture
def reviewer(db):
    return UserFactory(username="rita", role="reviewer")


@pytest.fixture
def scheme_with_themes(db):
    scheme = LabelSchemeFactory()
    themes = {}
    for code in ["META", "PREAMBLE_SCOPE", "TERMINATION", "MISC_BOILERPLATE"]:
        themes[code] = ThemeFactory(scheme=scheme, code=code, label=code)
    LegalNature.objects.create(scheme=scheme, code="OBLIGATION", label="Obligation")
    scheme.themes_map = themes
    return scheme


@pytest.fixture
def document_with_sentences(db):
    corpus = CorpusFactory()
    doc = DocumentFactory(corpus=corpus, n_sentences=5)
    for i in range(5):
        Sentence.objects.create(document=doc, index=i, raw_text=f"sentence {i}")
    return doc


@pytest.fixture
def project(db, scheme_with_themes, document_with_sentences):
    return ProjectFactory(
        corpus=document_with_sentences.corpus, scheme=scheme_with_themes
    )


@pytest.fixture
def annotation(db, project, document_with_sentences, annotator):
    return Annotation.objects.create(
        project=project, document=document_with_sentences, annotator=annotator
    )


@pytest.fixture
def auth(api_client):
    def _auth(user):
        api_client.force_authenticate(user=user)
        return api_client
    return _auth

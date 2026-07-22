"""One test per hard invariant of CONTRACT §2 / invariants.md."""

import pytest
from django.db import IntegrityError, transaction

from claire.annotations.models import Annotation, Clause
from claire.corpora.models import Sentence

pytestmark = pytest.mark.django_db


# INV-1: Sentence.index unique per document.
def test_inv1_sentence_index_unique(document_with_sentences):
    with pytest.raises(IntegrityError):
        Sentence.objects.create(
            document=document_with_sentences, index=0, raw_text="dup"
        )


# INV-2: one clause-start per sentence per annotation.
def test_inv2_one_clause_start_per_sentence(annotation, scheme_with_themes):
    s0 = annotation.document.sentences.get(index=0)
    theme = scheme_with_themes.themes_map["META"]
    Clause.objects.create(annotation=annotation, anchor_sentence=s0, theme=theme)
    with pytest.raises(IntegrityError):
        Clause.objects.create(annotation=annotation, anchor_sentence=s0, theme=theme)


# INV-3: theme must belong to the project's scheme (enforced via API/serializer).
def test_inv3_theme_must_be_in_scheme(auth, annotator, annotation):
    client = auth(annotator)
    resp = client.post(
        f"/api/v1/annotations/{annotation.id}/clauses",
        {"anchorIndex": 1, "theme": "NOT_A_THEME"},
        format="json",
    )
    assert resp.status_code == 400
    # Validation error key is camelCased to match the wire field name.
    assert "theme" in resp.json()


# INV-3 (scheme isolation): a theme from another scheme must not be usable.
def test_inv3_scheme_isolation(auth, annotator, annotation):
    from tests.conftest import LabelSchemeFactory, ThemeFactory

    other_scheme = LabelSchemeFactory()
    ThemeFactory(scheme=other_scheme, code="FOREIGN", label="Foreign")
    client = auth(annotator)
    resp = client.post(
        f"/api/v1/annotations/{annotation.id}/clauses",
        {"anchorIndex": 1, "theme": "FOREIGN"},
        format="json",
    )
    # FOREIGN exists, but not in this project's scheme -> rejected.
    assert resp.status_code == 400


# INV-4: annotation unique per (project, document, annotator).
def test_inv4_annotation_unique_triplet(project, document_with_sentences, annotator):
    Annotation.objects.create(
        project=project, document=document_with_sentences, annotator=annotator
    )
    with transaction.atomic():
        with pytest.raises(IntegrityError):
            Annotation.objects.create(
                project=project, document=document_with_sentences,
                annotator=annotator,
            )


# INV-5: status transition emits an ActivityEvent (+ snapshot for submit).
def test_inv5_transition_emits_event_and_version(annotation, annotator):
    from claire.annotations.models import AnnotationStatus
    from claire.annotations.services import transition_status
    from claire.audit.models import ActivityEvent

    before = ActivityEvent.objects.count()
    transition_status(annotation, AnnotationStatus.SUBMITTED, annotator)
    assert ActivityEvent.objects.filter(verb="annotation.submitted").exists()
    assert ActivityEvent.objects.count() > before
    assert annotation.versions.count() == 1  # auto snapshot on submit


def test_inv5_illegal_transition_rejected(annotation, annotator):
    from claire.annotations.services import transition_status
    from claire.common.exceptions import Conflict

    with pytest.raises(Conflict):
        transition_status(annotation, "approved", annotator)  # draft->approved


# INV-6: certainty bounded to {0,1,2,3}.
def test_inv6_certainty_range(annotation, scheme_with_themes):
    s0 = annotation.document.sentences.get(index=0)
    theme = scheme_with_themes.themes_map["META"]
    with transaction.atomic():
        with pytest.raises(IntegrityError):
            Clause.objects.create(
                annotation=annotation, anchor_sentence=s0, theme=theme, certainty=5
            )

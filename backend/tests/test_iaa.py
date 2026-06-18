"""Cohen's kappa & forward-fill theme vectors."""

import pytest

from claire.projects.iaa import cohen_kappa

pytestmark = pytest.mark.django_db


def test_kappa_perfect_agreement():
    a = ["X", "X", "Y", "Y"]
    assert cohen_kappa(a, a) == 1.0


def test_kappa_total_disagreement_low():
    a = ["X", "X", "X", "X"]
    b = ["Y", "Y", "Y", "Y"]
    # No agreement, but pe handling -> 0.0 for single-category mismatch.
    assert cohen_kappa(a, b) == 0.0


def test_kappa_partial():
    a = ["A", "A", "B", "B", "A"]
    b = ["A", "B", "B", "B", "A"]
    k = cohen_kappa(a, b)
    assert 0.0 < k < 1.0


def test_kappa_length_mismatch_raises():
    with pytest.raises(ValueError):
        cohen_kappa(["A"], ["A", "B"])


def test_project_iaa_with_two_annotators(
    project, document_with_sentences, scheme_with_themes
):
    from claire.annotations.models import Annotation, AnnotationStatus, Clause
    from claire.projects.iaa import project_iaa
    from tests.conftest import UserFactory

    document_with_sentences.n_sentences = 5
    document_with_sentences.save()
    meta = scheme_with_themes.themes_map["META"]
    term = scheme_with_themes.themes_map["TERMINATION"]
    u1 = UserFactory()
    u2 = UserFactory()

    a1 = Annotation.objects.create(
        project=project, document=document_with_sentences, annotator=u1,
        status=AnnotationStatus.SUBMITTED,
    )
    a2 = Annotation.objects.create(
        project=project, document=document_with_sentences, annotator=u2,
        status=AnnotationStatus.SUBMITTED,
    )
    s = {i: document_with_sentences.sentences.get(index=i) for i in range(5)}
    # identical segmentation -> kappa 1.0
    for a in (a1, a2):
        Clause.objects.create(annotation=a, anchor_sentence=s[0], theme=meta)
        Clause.objects.create(annotation=a, anchor_sentence=s[3], theme=term)

    result = project_iaa(project)
    assert result["mean_kappa"] == 1.0
    assert len(result["pairs"]) == 1

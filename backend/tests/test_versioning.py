"""Snapshot/version creation and diff (feature 3)."""

import pytest

from claire.annotations.models import Clause
from claire.annotations.services import create_version, diff_versions

pytestmark = pytest.mark.django_db


def test_snapshot_format_matches_pivot(annotation, scheme_with_themes, annotator):
    s0 = annotation.document.sentences.get(index=0)
    Clause.objects.create(
        annotation=annotation, anchor_sentence=s0,
        theme=scheme_with_themes.themes_map["META"],
        evidence_span="posted", certainty=3,
    )
    v = create_version(annotation, author=annotator, label="manual")
    assert v.number == 1
    snap = v.snapshot
    assert snap["doc"] == annotation.document.external_id
    assert snap["clauses"][0]["anchor_index"] == 0
    assert snap["clauses"][0]["theme"] == "META"
    assert snap["clauses"][0]["evidence_span"] == "posted"


def test_version_numbers_increment(annotation, annotator):
    v1 = create_version(annotation, author=annotator)
    v2 = create_version(annotation, author=annotator)
    assert (v1.number, v2.number) == (1, 2)


def test_diff_reports_added_changed_removed(
    annotation, scheme_with_themes, annotator
):
    s0 = annotation.document.sentences.get(index=0)
    s1 = annotation.document.sentences.get(index=1)
    meta = scheme_with_themes.themes_map["META"]
    term = scheme_with_themes.themes_map["TERMINATION"]

    c0 = Clause.objects.create(annotation=annotation, anchor_sentence=s0, theme=meta)
    v1 = create_version(annotation, author=annotator)

    # change c0 theme + add a clause at s1.
    c0.theme = term
    c0.save()
    Clause.objects.create(annotation=annotation, anchor_sentence=s1, theme=meta)
    v2 = create_version(annotation, author=annotator)

    d = diff_versions(v1, v2)
    assert d["summary"]["added"] == 1
    assert d["summary"]["changed"] == 1
    assert d["summary"]["removed"] == 0

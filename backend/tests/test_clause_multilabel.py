"""Lot 2b-core — modèle multi-label : invariants ClauseTheme + lecture (rétro-compat)."""

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError

from claire.annotations.models import (
    Clause,
    ClauseTheme,
    ClauseRole,
    validate_clause_theme_set,
)
from claire.annotations.serializers import ClauseSerializer


@pytest.fixture
def themes(scheme_with_themes):
    return scheme_with_themes.themes_map  # {code: Theme}


@pytest.fixture
def clause(db, annotation, themes):
    s = annotation.document.sentences.get(index=0)
    return Clause.objects.create(
        annotation=annotation, anchor_sentence=s, theme=themes["TERMINATION"], order=0
    )


def _tag(theme, role, support=0):
    return ClauseTheme(theme=theme, role=role, support=support)


class TestInvariants:
    def test_valid_primary_plus_secondary(self, themes):
        validate_clause_theme_set([
            _tag(themes["TERMINATION"], ClauseRole.PRIMARY),
            _tag(themes["META"], ClauseRole.SECONDARY),
        ])  # ne lève pas

    def test_valid_mono(self, themes):
        validate_clause_theme_set([_tag(themes["TERMINATION"], ClauseRole.PRIMARY)])

    def test_empty_raises(self):
        with pytest.raises(ValidationError):
            validate_clause_theme_set([])

    def test_zero_primary_raises(self, themes):
        with pytest.raises(ValidationError):
            validate_clause_theme_set([_tag(themes["META"], ClauseRole.SECONDARY)])

    def test_two_primaries_raises(self, themes):
        with pytest.raises(ValidationError):
            validate_clause_theme_set([
                _tag(themes["TERMINATION"], ClauseRole.PRIMARY),
                _tag(themes["META"], ClauseRole.PRIMARY),
            ])

    def test_refuge_as_secondary_raises(self, themes):
        with pytest.raises(ValidationError):
            validate_clause_theme_set([
                _tag(themes["TERMINATION"], ClauseRole.PRIMARY),
                _tag(themes["PREAMBLE_SCOPE"], ClauseRole.SECONDARY),  # refuge interdit en 2nd
            ])

    def test_refuge_as_primary_allowed(self, themes):
        # un refuge PEUT être primaire (clause unanime sur un vrai préambule).
        validate_clause_theme_set([_tag(themes["PREAMBLE_SCOPE"], ClauseRole.PRIMARY)])


class TestNewFieldsDefaults:
    def test_clause_defaults(self, clause):
        assert clause.boundary_type == "hard"
        assert clause.boundary_support == 1
        assert clause.triage_level == ""


class TestClauseThemeTable:
    def test_unique_clause_theme(self, clause, themes):
        ClauseTheme.objects.create(clause=clause, theme=themes["TERMINATION"], role="primary")
        with pytest.raises(IntegrityError):
            ClauseTheme.objects.create(clause=clause, theme=themes["TERMINATION"], role="secondary")


class TestSerializerRead:
    def test_multilabel_shape(self, clause, themes):
        ClauseTheme.objects.create(clause=clause, theme=themes["TERMINATION"], role="primary", support=2, order=0)
        ClauseTheme.objects.create(clause=clause, theme=themes["META"], role="secondary", support=1, order=1)
        data = ClauseSerializer(clause).to_representation(clause)
        assert data["theme"] == "TERMINATION"  # miroir du primaire (legacy)
        labels = {(t["label"], t["role"]) for t in data["themes"]}
        assert ("TERMINATION", "primary") in labels
        assert ("META", "secondary") in labels
        assert data["boundary"] == {"type": "hard", "support": 1}
        assert data["triage_level"] is None

    def test_fallback_mono_when_no_tags(self, clause):
        # Clause sans theme_tags (transitoire) → repli mono sur le primaire scalaire.
        data = ClauseSerializer(clause).to_representation(clause)
        assert data["themes"] == [{"label": "TERMINATION", "role": "primary", "support": 0}]

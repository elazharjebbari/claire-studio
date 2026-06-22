"""Lot 6 — α de Krippendorff-MASI (accord multi-label) : propriétés + cohérence mono."""

import math

from claire.projects.masi import (
    alpha_masi,
    krippendorff_alpha,
    masi_distance,
    nominal_distance,
)


def s(*labels):
    return set(labels)


class TestMasiDistance:
    def test_identical(self):
        assert masi_distance(s("A"), s("A")) == 0.0
        assert masi_distance(s("A", "B"), s("A", "B")) == 0.0

    def test_disjoint(self):
        assert masi_distance(s("A"), s("B")) == 1.0  # singletons disjoints → nominal

    def test_subset(self):
        # {A} ⊂ {A,B} : J=2/3, Jaccard=1/2 → MASI=1/3 → distance=2/3
        assert math.isclose(masi_distance(s("A"), s("A", "B")), 1 - (2 / 3) * (1 / 2))

    def test_overlap_no_subset(self):
        # {A,B} vs {A,C} : J=1/3, Jaccard=1/3 → MASI=1/9 → distance=8/9
        assert math.isclose(masi_distance(s("A", "B"), s("A", "C")), 1 - (1 / 3) * (1 / 3))


class TestAlpha:
    def test_perfect_agreement(self):
        units = [[s("A"), s("A"), s("A")], [s("B"), s("B"), s("B")]]
        assert alpha_masi(units) == 1.0

    def test_none_when_insufficient(self):
        assert alpha_masi([]) is None
        assert alpha_masi([[s("A")]]) is None  # une seule annotation → non appariable

    def test_total_disagreement_is_low(self):
        # 2 phrases, 2 juges, désaccord disjoint partout : α doit être bas (≤ 0).
        units = [[s("A"), s("B")], [s("C"), s("D")]]
        a = alpha_masi(units)
        assert a is not None and a <= 0.0

    def test_multilabel_high_agreement(self):
        # Fort accord multi-label (ensembles majoritairement identiques / inclus) → α élevé.
        units = [
            [s("A", "B"), s("A", "B"), s("A", "B")],
            [s("C"), s("C"), s("C")],
            [s("A"), s("A"), s("A")],
            [s("B", "C"), s("B", "C"), s("B")],  # un léger désaccord (inclusion)
        ]
        a = alpha_masi(units)
        assert a is not None and a > 0.6

    def test_partial_credit_at_distance_level(self):
        # Le crédit partiel MASI : un recouvrement/inclusion est MOINS distant qu'un disjoint.
        assert masi_distance(s("A"), s("A", "B")) < masi_distance(s("A"), s("B"))
        assert masi_distance(s("A", "B"), s("A", "C")) < masi_distance(s("A", "B"), s("X", "Y"))

    def test_masi_reduces_to_nominal_on_singletons(self):
        # COHÉRENCE PROTOCOLE : sur du mono (singletons), α_MASI == α nominal (= κ-like).
        units = [
            [s("A"), s("A"), s("B")],
            [s("A"), s("A"), s("A")],
            [s("B"), s("C"), s("B")],
            [s("A"), s("B"), s("C")],
        ]
        a_masi = krippendorff_alpha(units, distance=masi_distance)
        a_nominal = krippendorff_alpha(units, distance=nominal_distance)
        assert a_masi is not None and a_nominal is not None
        assert math.isclose(a_masi, a_nominal, rel_tol=1e-9)

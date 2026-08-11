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


class TestPerformanceQuadratiqueRegroupee:
    """⭐ Régression de performance — mesurée en conditions réelles (100 annotations,
    50 documents) : le calcul de `d_expected` énumérait TOUTES les paires du pool
    aplati (O(N²)) et a pris 155 secondes. Ce fichier ne dépendait que de fixtures
    minuscules, où le problème est invisible. Corrigé en regroupant les jugements
    identiques par fréquence (O(U²), U = ensembles DISTINCTS observés) — un allègement
    EXACT, pas une approximation.
    """

    @staticmethod
    def _naive_krippendorff_alpha(units, distance):
        """Réimplémentation O(N²) littérale de l'ancien algorithme — sert de référence
        indépendante pour prouver que l'optimisation ne change AUCUN résultat."""
        from itertools import combinations as _combinations

        items = [list(u) for u in units if len(u) >= 2]
        if not items:
            return None
        obs_sum = obs_pairs = 0.0
        for u in items:
            for x, y in _combinations(u, 2):
                obs_sum += distance(set(x), set(y))
                obs_pairs += 1
        if obs_pairs == 0:
            return None
        d_observed = obs_sum / obs_pairs

        pool = [set(x) for u in items for x in u]
        exp_sum = exp_pairs = 0.0
        for x, y in _combinations(pool, 2):
            exp_sum += distance(x, y)
            exp_pairs += 1
        if exp_pairs == 0:
            return None
        d_expected = exp_sum / exp_pairs
        if d_expected == 0:
            return 1.0
        return 1.0 - d_observed / d_expected

    def test_equivalence_exacte_avec_l_ancien_calcul_naif(self):
        """L'optimisation ne doit changer AUCUN chiffre — c'est un résultat cité dans
        un article, une divergence, même minime, serait une régression scientifique."""
        import random

        rng = random.Random(7)
        vocabulary = [s(code) for code in "ABCDE"] + [
            s(a, b) for a in "ABCDE" for b in "ABCDE" if a < b
        ]
        for _ in range(20):
            units = [
                [rng.choice(vocabulary) for _ in range(rng.randint(2, 4))]
                for _ in range(rng.randint(5, 80))
            ]
            expected = self._naive_krippendorff_alpha(units, masi_distance)
            actual = krippendorff_alpha(units, distance=masi_distance)
            if expected is None:
                assert actual is None
            else:
                assert actual is not None
                assert math.isclose(actual, expected, rel_tol=1e-9, abs_tol=1e-12)

    def test_rapide_sur_un_volume_realiste(self):
        """Verrouille le gain : quelques milliers d'unités, vocabulaire fermé de 20
        thèmes (le cas réel) doivent se calculer en une fraction de seconde, pas en
        minutes."""
        import random
        import time

        rng = random.Random(11)
        themes = [f"T{i}" for i in range(20)]
        # Reproduit la réalité : peu de combinaisons distinctes reviennent très souvent
        # (vocabulaire fermé), mais beaucoup d'unités au total (grand corpus).
        combos = [set(rng.sample(themes, rng.randint(1, 3))) for _ in range(60)]
        units = [
            [rng.choice(combos) for _ in range(rng.choice([2, 2, 3]))] for _ in range(4000)
        ]
        started = time.monotonic()
        result = alpha_masi(units)
        elapsed = time.monotonic() - started

        assert result is not None
        # Généreux (l'ancien calcul aurait pris largement plus d'une minute sur ce volume).
        assert elapsed < 3.0, f"régression de performance : {elapsed:.2f}s"

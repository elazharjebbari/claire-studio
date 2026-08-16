"""Primitives d'accord (`evaluation/agreement.py`) — parité backend et valeurs connues.

La parité MASI backend↔recherche est un GOLDEN : les deux implémentations doivent
produire le même α au bit près, sinon les chiffres du papier dépendraient du chemin
de calcul — exactement ce que le dossier des papiers interdit.
"""

import importlib.util
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pactiva_lab.evaluation.agreement import (  # noqa: E402
    alpha_masi_vs_nominal,
    alpha_set_ci,
    gwet_ac1_binary,
    krippendorff_alpha_set,
    masi_distance,
    nominal_set_distance,
)

BACKEND_MASI = (
    Path(__file__).resolve().parents[2] / "backend" / "claire" / "projects" / "masi.py"
)


def _load_backend_masi():
    spec = importlib.util.spec_from_file_location("backend_masi", BACKEND_MASI)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


UNITS = [
    [frozenset({"A"}), frozenset({"A"})],
    [frozenset({"A", "B"}), frozenset({"A"})],
    [frozenset({"B"}), frozenset({"C"})],
    [frozenset({"A", "B", "C"}), frozenset({"A", "B"})],
    [frozenset({"C"}), frozenset({"C"}), frozenset({"B", "C"})],
    [frozenset({"A"}), frozenset({"B"})],
]


class TestParityWithBackend:
    def test_masi_distance_matches(self):
        backend = _load_backend_masi()
        for unit in UNITS:
            for x in unit:
                for y in unit:
                    assert masi_distance(x, y) == pytest.approx(
                        backend.masi_distance(set(x), set(y))
                    )

    def test_alpha_masi_parity_golden(self):
        backend = _load_backend_masi()
        ours = krippendorff_alpha_set(UNITS, distance=masi_distance)
        theirs = backend.krippendorff_alpha(
            [[set(x) for x in unit] for unit in UNITS], distance=backend.masi_distance
        )
        assert ours == pytest.approx(theirs, abs=1e-12)

    def test_alpha_nominal_parity_golden(self):
        backend = _load_backend_masi()
        ours = krippendorff_alpha_set(UNITS, distance=nominal_set_distance)
        theirs = backend.krippendorff_alpha(
            [[set(x) for x in unit] for unit in UNITS],
            distance=backend.nominal_distance,
        )
        assert ours == pytest.approx(theirs, abs=1e-12)


class TestSanity:
    def test_mono_label_masi_equals_nominal(self):
        """⭐ Le sanity-check du protocole : sur des singletons, α_MASI = α nominal."""
        units = [
            [frozenset({"A"}), frozenset({"A"})],
            [frozenset({"B"}), frozenset({"A"})],
            [frozenset({"B"}), frozenset({"B"})],
            [frozenset({"C"}), frozenset({"A"})],
        ]
        masi = krippendorff_alpha_set(units, distance=masi_distance)
        nominal = krippendorff_alpha_set(units, distance=nominal_set_distance)
        assert masi == pytest.approx(nominal)

    def test_empty_units_return_none(self):
        assert krippendorff_alpha_set([]) is None
        assert krippendorff_alpha_set([[frozenset({"A"})]]) is None

    def test_perfect_agreement_is_one(self):
        units = [[frozenset({"A"}), frozenset({"A"})]] * 3
        assert krippendorff_alpha_set(units) == 1.0


class TestGwetAc1:
    def test_hand_computed_value(self):
        """Pa = 3/4, π = 0,375, Pe = 0,46875 → AC1 = 0,529412 (calcul manuel)."""
        units = [[True, True], [True, False], [False, False], [False, False]]
        assert gwet_ac1_binary(units) == pytest.approx(0.529412, abs=1e-6)

    def test_robust_to_extreme_prevalence(self):
        """⭐ Le cas d'usage : catégorie quasi absente, un seul désaccord — κ
        s'effondrerait, AC1 reste haut (garde-fou des thèmes rares)."""
        units = [[False, False]] * 30 + [[True, False]]
        value = gwet_ac1_binary(units)
        assert value is not None and value > 0.9

    def test_insufficient_raters(self):
        assert gwet_ac1_binary([[True]]) is None


class TestPairedDiff:
    def test_diff_matches_marginals_and_direction(self):
        units_by_doc = {
            "doc1": [
                [frozenset({"A", "B"}), frozenset({"A"})],
                [frozenset({"B"}), frozenset({"B"})],
            ],
            "doc2": [
                [frozenset({"A"}), frozenset({"A", "C"})],
                [frozenset({"C"}), frozenset({"B"})],
            ],
            "doc3": [
                [frozenset({"A"}), frozenset({"A"})],
                [frozenset({"B", "C"}), frozenset({"B"})],
            ],
        }
        primary_by_doc = {
            doc: [[frozenset([sorted(s)[0]]) for s in unit] for unit in units]
            for doc, units in units_by_doc.items()
        }
        out = alpha_masi_vs_nominal(units_by_doc, primary_by_doc, n_resamples=200)
        assert out["diff"] == pytest.approx(
            out["alphaNominal"] - out["alphaMasi"], abs=1e-6
        )
        assert out["nResamples"] > 0
        assert out["diffLow"] is not None and out["diffHigh"] is not None
        assert out["diffLow"] <= out["diff"] <= out["diffHigh"]

    def test_document_mismatch_refused(self):
        """⭐ La différence appariée n'a pas de sens sur des documents différents."""
        with pytest.raises(ValueError, match="MÊMES documents"):
            alpha_masi_vs_nominal(
                {"a": [[frozenset({"A"}), frozenset({"A"})]]},
                {"b": [[frozenset({"A"}), frozenset({"A"})]]},
            )

    def test_deterministic(self):
        units_by_doc = {
            "d1": [[frozenset({"A"}), frozenset({"A", "B"})]],
            "d2": [[frozenset({"B"}), frozenset({"B"})]],
            "d3": [[frozenset({"A"}), frozenset({"C"})]],
        }
        first = alpha_masi_vs_nominal(units_by_doc, n_resamples=100)
        second = alpha_masi_vs_nominal(units_by_doc, n_resamples=100)
        assert first == second


class TestAlphaSetCi:
    def test_single_document_warns(self):
        out = alpha_set_ci({"only": [[frozenset({"A"}), frozenset({"B"})]]})
        assert out["warning"] == "insufficient_groups"
        assert out["low"] is None

    def test_ci_brackets_point(self):
        units_by_doc = {
            f"d{i}": [
                [frozenset({"A"}), frozenset({"A"})],
                [frozenset({"B"}), frozenset({"A" if i % 2 else "B"})],
            ]
            for i in range(6)
        }
        out = alpha_set_ci(units_by_doc, n_resamples=300)
        assert out["low"] is not None
        assert out["low"] <= out["point"] <= out["high"]

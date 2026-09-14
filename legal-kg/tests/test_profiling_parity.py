"""Parité des coefficients d'accord réimplémentés dans src/profiling avec ceux du Lab (pactiva_lab).

Exécuter depuis legal-kg/ : python -m pytest tests/ -q   (pactiva_lab importé depuis ../research si présent).
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src" / "profiling"))
sys.path.insert(0, str(ROOT.parent / "research"))

from profile_dataset import alpha_pairwise, cohen_kappa, masi, nominal  # noqa: E402

has_lab = importlib.util.find_spec("pactiva_lab") is not None


def test_masi_definition():
    a, b = frozenset({"X"}), frozenset({"X", "Y"})
    assert masi(a, a) == 0.0
    assert abs(masi(a, b) - (1 - 0.5 * (2 / 3))) < 1e-9          # sous-ensemble : J=1/2, M=2/3
    assert masi(frozenset({"X"}), frozenset({"Y"})) == 1.0        # disjoints


def test_alpha_perfect_and_chance():
    units = [["A", "A", "A"], ["B", "B", "B"], ["A", "A", "A"]]
    assert alpha_pairwise(units, nominal) == 1.0
    units = [["A", "B"], ["B", "A"], ["A", "B"], ["B", "A"]]      # désaccord systématique
    assert alpha_pairwise(units, nominal) < 0


def test_kappa_basic():
    assert cohen_kappa(["a", "b", "a", "b"], ["a", "b", "a", "b"]) == 1.0
    assert abs(cohen_kappa(["a", "b", "a", "b"], ["a", "a", "b", "b"])) < 1e-9


@pytest.mark.skipif(not has_lab, reason="pactiva_lab non importable (research/ absent)")
def test_parity_with_lab_on_synthetic_units():
    from pactiva_lab.evaluation.agreement import krippendorff_alpha_set, masi_distance
    units = [[frozenset({"A"}), frozenset({"A"}), frozenset({"A", "B"})],
             [frozenset({"B"}), frozenset({"C"}), frozenset({"B"})],
             [frozenset({"A", "C"}), frozenset({"A"}), frozenset({"A"})],
             [frozenset({"D"}), frozenset({"D"}), frozenset({"D"})]]
    ours = alpha_pairwise(units, masi)
    theirs = krippendorff_alpha_set(units, masi_distance)
    assert abs(ours - theirs) < 1e-6

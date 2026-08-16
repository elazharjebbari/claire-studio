"""Tâches de mesure M1/M2 (`measurement.py`) — bout-en-bout sur le dataset jouet."""

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pactiva_lab.measurement import run_agreement, run_gold_cascade  # noqa: E402
from pactiva_lab.runner import run_experiment  # noqa: E402


M1_CONFIG = {
    "version": 1,
    "task": "M1_agreement",
    "seed": 42,
    "model": {"family": "measurement"},
    "evaluation": {"bootstrap": {"enabled": True, "n_resamples": 100}},
}

M2_CONFIG = {
    "version": 1,
    "task": "M2_gold_cascade",
    "seed": 42,
    "model": {"family": "measurement"},
    "evaluation": {"bootstrap": {"enabled": False}},
}


class TestRunAgreement:
    def test_end_to_end_writes_contract(self, toy_dataset, tmp_path):
        out = tmp_path / "out"
        result = run_agreement(M1_CONFIG, toy_dataset, out)

        assert (out / "results.json").exists()
        assert (out / "_SENTINEL").read_text().strip() == "DONE"
        assert result["task"] == "M1_agreement"

        metrics = result["metrics"]
        assert isinstance(metrics["alpha_masi"], float)
        assert isinstance(metrics["alpha_nominal"], float)
        # bob diverge d'alice une phrase sur 4 → l'accord n'est ni parfait ni nul.
        assert 0.0 < metrics["alpha_masi"] < 1.0

    def test_e1_diff_is_paired(self, toy_dataset, tmp_path):
        result = run_agreement(M1_CONFIG, toy_dataset, tmp_path / "out")
        e1 = result["agreement"]["global"]
        assert e1["diff"] == pytest.approx(
            e1["alphaNominal"] - e1["alphaMasi"], abs=1e-6
        )
        assert e1["nResamples"] > 0

    def test_pairs_and_matrix_cover_annotators_and_judges(self, toy_dataset, tmp_path):
        result = run_agreement(M1_CONFIG, toy_dataset, tmp_path / "out")
        pairs = {(p["a"], p["b"]) for p in result["agreement"]["pairs"]}
        # alice/bob sur 4 documents ; carol seulement sur Atlas → 3 paires.
        assert pairs == {("alice", "bob"), ("alice", "carol"), ("bob", "carol")}

        matrix = result["agreement"]["matrix"]
        assert matrix["raters"] == [
            "alice", "bob", "carol", "claude", "codex", "fable", "mistral",
        ]
        assert matrix["kinds"] == ["annotator"] * 3 + ["judge"] * 4
        n = len(matrix["raters"])
        assert len(matrix["agreement"]) == n
        assert all(len(row) == n for row in matrix["agreement"])
        # ⭐ Symétrie et diagonale — une matrice non symétrique serait un bug de calcul.
        for i in range(n):
            assert matrix["agreement"][i][i] == 1.0
            for j in range(n):
                assert matrix["agreement"][i][j] == matrix["agreement"][j][i]

    def test_boundaries_are_reconstructed_never_trivially_one(self, toy_dataset, tmp_path):
        """⭐ Le κ d'ancres vaut 1,0 par construction — la reconstruction ne doit PAS
        reproduire cet artefact : bob change de thème une phrase sur 4, ses frontières
        diffèrent de celles d'alice."""
        result = run_agreement(M1_CONFIG, toy_dataset, tmp_path / "out")
        boundaries = result["agreement"]["boundaries"]
        alice_bob = next(
            p for p in boundaries["pairs"] if {p["a"], p["b"]} == {"alice", "bob"}
        )
        assert 0.0 < alice_bob["jaccardMean"] < 1.0
        assert len(alice_bob["documents"]) == 4

    def test_divergence_names_closest_judge(self, toy_dataset, tmp_path):
        result = run_agreement(M1_CONFIG, toy_dataset, tmp_path / "out")
        divergence = result["agreement"]["divergence"]
        assert {row["annotator"] for row in divergence["annotators"]} == {
            "alice", "bob", "carol",
        }
        for row in divergence["annotators"]:
            rates = {j["judge"]: j["divergencePrimary"] for j in row["byJudge"]}
            assert row["closestDivergence"] == min(rates.values())
            assert rates[row["closestJudge"]] == row["closestDivergence"]

    def test_missing_votes_refused_explicitly(self, toy_dataset, tmp_path):
        (Path(toy_dataset) / "votes.jsonl").unlink()
        with pytest.raises(ValueError, match="votes_missing"):
            run_agreement(M1_CONFIG, toy_dataset, tmp_path / "out")

    def test_deterministic(self, toy_dataset, tmp_path):
        first = run_agreement(M1_CONFIG, toy_dataset, tmp_path / "a")
        second = run_agreement(M1_CONFIG, toy_dataset, tmp_path / "b")
        assert first["metrics"] == second["metrics"]
        assert first["agreement"] == second["agreement"]

    def test_dispatched_by_runner(self, toy_dataset, tmp_path):
        """Le chemin réel (CLI → run_experiment) route bien la tâche M1."""
        result = run_experiment(M1_CONFIG, toy_dataset, tmp_path / "out")
        assert result["task"] == "M1_agreement"


class TestRunGoldCascade:
    def test_cascade_shares_and_arbitration(self, toy_dataset, tmp_path):
        result = run_gold_cascade(M2_CONFIG, toy_dataset, tmp_path / "out")
        metrics = result["metrics"]
        assert metrics["n_gold_sentences"] == 8
        assert metrics["share_auto_1click"] == pytest.approx(0.5)
        assert metrics["share_auto"] == pytest.approx(0.25)
        assert metrics["share_manual"] == pytest.approx(0.25)
        # ⭐ L'arbitre a contredit la pluralité une fois (idx 6) ; un conflit reste
        # ouvert (idx 7) — c'est LA ligne du papier « le comité ne ratifie pas ».
        assert metrics["manual_changed_by_arbitration"] == 1
        assert metrics["residual_ambiguity"] == 1
        assert metrics["n_finalized_documents"] == 0

    def test_gold_missing_refused(self, toy_dataset, tmp_path):
        (Path(toy_dataset) / "gold.jsonl").unlink()
        with pytest.raises(ValueError, match="gold_missing"):
            run_gold_cascade(M2_CONFIG, toy_dataset, tmp_path / "out")

    def test_result_contract_written(self, toy_dataset, tmp_path):
        out = tmp_path / "out"
        run_gold_cascade(M2_CONFIG, toy_dataset, out)
        payload = json.loads((out / "results.json").read_text())
        assert payload["task"] == "M2_gold_cascade"
        tiers = {row["tier"]: row["count"] for row in payload["gold"]["tiers"]}
        assert tiers == {"auto_1click": 4, "auto": 2, "manual": 2}

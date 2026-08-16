"""G2 — co-occurrence (`cooccurrence.py`) : unités, scorers, ablations, bout-en-bout."""

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pactiva_lab.cooccurrence import (  # noqa: E402
    build_segments,
    corrupt_segments,
    deontic_tag,
    run_cooccurrence,
)
from pactiva_lab.data import load_dataset  # noqa: E402

G2_CONFIG = {
    "version": 1,
    "task": "G2_cooccurrence",
    "seed": 42,
    "model": {"family": "cooccurrence_anomaly", "unit": "segment", "deontic": "none"},
    "evaluation": {"bootstrap": {"enabled": True, "n_resamples": 50}},
}


class TestBuildSegments:
    def test_segments_are_contiguous_and_uniform(self, toy_dataset):
        dataset = load_dataset(toy_dataset)
        segments = build_segments(dataset)
        assert sum(s.n_sentences for s in segments) == len(dataset.sentences)
        by_key = {(s.document, s.index): frozenset(s.themes) for s in dataset.sentences}
        for segment in segments:
            for index in range(segment.start, segment.end + 1):
                assert by_key[(segment.document, index)] == segment.themes

    def test_compression_happens(self, toy_dataset):
        """Les thèmes viennent par blocs (structure du ToS) → moins de segments que
        de phrases."""
        dataset = load_dataset(toy_dataset)
        segments = build_segments(dataset)
        assert len(segments) < len(dataset.sentences)

    def test_index_gap_opens_segment(self, toy_dataset):
        """⭐ Une phrase non annotée entre deux phrases de même thème SÉPARE les
        segments — sinon un « segment » enjamberait un trou d'annotation."""
        dataset = load_dataset(toy_dataset)
        atlas = [s for s in dataset.sentences if s.document == "Atlas"]
        # Supprime la phrase du milieu et force le même jeu de thèmes partout.
        for sentence in atlas:
            sentence.themes = ["PREAMBLE_SCOPE"]
        kept = [s for s in atlas if s.index != 4]
        dataset.sentences = kept
        segments = [s for s in build_segments(dataset) if s.document == "Atlas"]
        assert len(segments) == 2
        assert {(s.start, s.end) for s in segments} == {(0, 3), (5, 7)}


class TestDeonticTag:
    def test_priority_and_patterns(self):
        assert deontic_tag("You shall not resell the service.") == "prohibition"
        assert deontic_tag("You must pay all fees.") == "obligation"
        assert deontic_tag("We may terminate your account.") == "permission"
        assert deontic_tag("This document describes the service.") == "statement"
        # ⭐ « shall not » gagne sur « shall » — la priorité interdiction > obligation.
        assert deontic_tag("You shall comply and shall not sublicense.") == "prohibition"


class TestCorruptSegments:
    def test_rate_and_determinism_and_test_isolation(self, toy_dataset):
        dataset = load_dataset(toy_dataset)
        segments = build_segments(dataset)
        corrupt_segments(segments, dataset.labels, rate=0.2, seed=42, fold=0)
        corrupted = [s for s in segments if s.noisy_themes is not None]
        assert len(corrupted) == round(0.2 * len(segments))
        # Les thèmes d'origine ne sont JAMAIS modifiés (le test reste propre).
        for segment in corrupted:
            assert segment.noisy_themes != segment.themes

        fresh = build_segments(dataset)
        corrupt_segments(fresh, dataset.labels, rate=0.2, seed=42, fold=0)
        assert [
            (s.document, s.start) for s in fresh if s.noisy_themes is not None
        ] == [(s.document, s.start) for s in corrupted]

    def test_zero_rate_touches_nothing(self, toy_dataset):
        dataset = load_dataset(toy_dataset)
        segments = build_segments(dataset)
        corrupt_segments(segments, dataset.labels, rate=0.0, seed=42, fold=0)
        assert all(s.noisy_themes is None for s in segments)


class TestRunCooccurrence:
    def test_end_to_end_contract_and_artifacts(self, toy_dataset, tmp_path):
        out = tmp_path / "out"
        result = run_cooccurrence(G2_CONFIG, toy_dataset, out)

        assert (out / "results.json").exists()
        assert (out / "hypergraph.json").exists()
        assert (out / "_SENTINEL").exists()

        scorers = {s["scorer"]: s for s in result["cooccurrence"]["scorers"]}
        core = {"rarity", "npmi_min", "cardinality", "combo_identity"}
        sklearn_set = {"lof", "iforest", "ocsvm"}
        try:
            import sklearn  # noqa: F401

            assert set(scorers) == core | sklearn_set
            assert result["cooccurrence"]["skippedScorers"] == []
        except ModuleNotFoundError:
            # ⭐ Sans sklearn : les détecteurs peu profonds sont ABSENTS et DÉCLARÉS —
            # jamais des zéros silencieux.
            assert set(scorers) == core
            assert result["cooccurrence"]["skippedScorers"] == [
                "iforest", "lof", "ocsvm",
            ]
        # ⭐ L'appartenance est portée par le résultat — l'UI ne peut pas confondre un
        # contrôle négatif avec un détecteur, ni la référence supervisée avec l'un d'eux.
        assert scorers["cardinality"]["kind"] == "control"
        assert scorers["combo_identity"]["kind"] == "supervised_reference"
        assert scorers["rarity"]["kind"] == "unsupervised"

        # Le jouet contient des phrases abusives (LTD) → l'AUC-PR est calculable.
        assert result["metrics"]["auc_pr_rarity"] is not None
        assert result["metrics"]["base_rate"] > 0

        n_segments = result["cooccurrence"]["structure"]["nSegments"]
        lines = (out / "segments.jsonl").read_text().strip().splitlines()
        assert len(lines) == n_segments

    def test_every_segment_scored_exactly_once(self, toy_dataset, tmp_path):
        """⭐ CV par document : chaque segment est scoré quand SON document est en
        test — jamais deux fois, jamais zéro (sinon les métriques poolées mentent)."""
        out = tmp_path / "out"
        result = run_cooccurrence(G2_CONFIG, toy_dataset, out)
        lines = [json.loads(l) for l in (out / "segments.jsonl").read_text().splitlines()]
        assert all(l["scores"].get("rarity") is not None for l in lines)
        keys = [(l["document"], l["start"]) for l in lines]
        assert len(keys) == len(set(keys))
        assert len(keys) == result["cooccurrence"]["structure"]["nSegments"]

    def test_precision_at_k_and_lift_consistent(self, toy_dataset, tmp_path):
        result = run_cooccurrence(G2_CONFIG, toy_dataset, tmp_path / "out")
        base = result["metrics"]["base_rate"]
        for scorer in result["cooccurrence"]["scorers"]:
            for row in scorer["precisionAt"]:
                assert 0.0 <= row["precision"] <= 1.0
                if row["lift"] is not None:
                    assert row["lift"] == pytest.approx(row["precision"] / base, rel=1e-4)

    def test_deterministic(self, toy_dataset, tmp_path):
        first = run_cooccurrence(G2_CONFIG, toy_dataset, tmp_path / "a")
        second = run_cooccurrence(G2_CONFIG, toy_dataset, tmp_path / "b")
        assert first["metrics"] == second["metrics"]
        assert first["cooccurrence"]["scorers"] == second["cooccurrence"]["scorers"]

    def test_deontic_ablation_changes_identity(self, toy_dataset, tmp_path):
        config = json.loads(json.dumps(G2_CONFIG))
        config["model"]["deontic"] = "rule_based"
        result = run_cooccurrence(config, toy_dataset, tmp_path / "out")
        assert result["cooccurrence"]["deontic"] == "rule_based"
        hypergraph = json.loads((tmp_path / "out" / "hypergraph.json").read_text())
        assert all(
            "deontic" in segment
            for document in hypergraph["documents"]
            for segment in document["segments"]
        )

    def test_label_noise_degrades_or_shifts_scores(self, toy_dataset, tmp_path):
        config = json.loads(json.dumps(G2_CONFIG))
        config["evaluation"]["label_noise"] = 0.35
        noisy = run_cooccurrence(config, toy_dataset, tmp_path / "noisy")
        clean = run_cooccurrence(G2_CONFIG, toy_dataset, tmp_path / "clean")
        assert noisy["cooccurrence"]["labelNoise"] == 0.35
        # Le bruit change la normalité apprise → les scores de rareté diffèrent.
        assert (
            noisy["cooccurrence"]["scorers"] != clean["cooccurrence"]["scorers"]
        )

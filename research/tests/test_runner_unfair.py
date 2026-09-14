"""Tâche U1_unfair (cible d'abusivité CLAUDETTE), filtre de population et découpage
design_holdout — baseline texte-seul B2 du programme Legal KG (15 sept. 2026)."""

import json

import pytest

from pactiva_lab.data import load_dataset
from pactiva_lab.runner import run_experiment
from pactiva_lab.taxonomy import population_documents

# Documents du dataset jouet présents dans les populations figées de la spécification
# (frontend/src/lib/taxonomy/taxonomies.json) : Spotify et eBay sont des documents de
# validation, les huit autres de conception.
TOY_HOLDOUT = {"Spotify", "eBay"}


@pytest.fixture
def unfair_config(base_config):
    return {**base_config, "task": "U1_unfair"}


def test_u1_cible_binaire_et_metriques_de_la_classe_positive(toy_dataset, unfair_config, tmp_path):
    result = run_experiment(unfair_config, toy_dataset, tmp_path / "out")
    assert result["task"] == "U1_unfair"
    labels = {row["label"] for row in result["per_label"]}
    assert labels <= {"fair", "unfair"}
    for key in ("unfair_precision", "unfair_recall", "unfair_f1", "unfair_support", "kappa"):
        assert key in result["metrics"], key
    assert "unfair_auc_pr" in result["per_fold"][0]
    rows = [json.loads(l) for l in (tmp_path / "out" / "predictions.jsonl").read_text().splitlines()]
    # La cible est dérivée de `unfair` et de rien d'autre.
    assert all((row["y_true"] == "unfair") == bool(row["unfair"]) for row in rows)


def test_u1_plafond_humain_declare_non_applicable(toy_dataset, unfair_config, tmp_path):
    result = run_experiment(unfair_config, toy_dataset, tmp_path / "out")
    assert result["human_ceiling"]["value"] is None
    assert result["human_ceiling"]["warning"] == "not_applicable"


def test_u1_intervalle_bootstrap_de_la_f1_positive(toy_dataset, unfair_config, tmp_path):
    config = {**unfair_config, "evaluation": {**unfair_config["evaluation"],
              "bootstrap": {"enabled": True, "n_resamples": 30, "unit": "document"}}}
    result = run_experiment(config, toy_dataset, tmp_path / "out")
    ci = result["metrics"]["unfair_f1_ci"]
    assert ci["unit"] == "document" and ci["low"] <= ci["point"] <= ci["high"]


def test_design_holdout_un_seul_pli_test_egal_au_hold_out(toy_dataset, unfair_config, tmp_path):
    config = {**unfair_config, "evaluation": {**unfair_config["evaluation"],
              "split": {"scheme": "design_holdout"}}}
    result = run_experiment(config, toy_dataset, tmp_path / "out")
    assert result["split"]["scheme"] == "design_holdout"
    assert result["split"]["n_folds"] == 1
    assert result["split"]["n_test_documents"] == len(TOY_HOLDOUT)
    assert result["split"]["n_train_documents"] == 10 - len(TOY_HOLDOUT)
    rows = [json.loads(l) for l in (tmp_path / "out" / "predictions.jsonl").read_text().splitlines()]
    assert {row["document"] for row in rows} == TOY_HOLDOUT
    assert TOY_HOLDOUT <= population_documents("holdout")


def test_population_restreint_donnees_et_plis_sans_les_recalculer(toy_dataset):
    full = load_dataset(toy_dataset)
    design = full.restricted_to(population_documents("designSet"))
    assert set(design.documents) == set(full.documents) - TOY_HOLDOUT
    # Chaque pli restant est un sous-ensemble du pli d'origine (jamais recomposé).
    for fold in design.folds:
        assert any(set(fold) <= set(original) for original in full.folds)
    assert all(fold for fold in design.folds)


def test_population_designset_appliquee_au_run_supervise(toy_dataset, unfair_config, tmp_path):
    config = {**unfair_config, "data": {"population": "designSet"}}
    result = run_experiment(config, toy_dataset, tmp_path / "out")
    rows = [json.loads(l) for l in (tmp_path / "out" / "predictions.jsonl").read_text().splitlines()]
    assert not ({row["document"] for row in rows} & TOY_HOLDOUT)
    assert result["split"]["population"] == "designSet"


def test_design_holdout_refuse_sans_documents_de_conception(toy_dataset, unfair_config, tmp_path):
    config = {**unfair_config, "data": {"population": "holdout"},
              "evaluation": {**unfair_config["evaluation"], "split": {"scheme": "design_holdout"}}}
    with pytest.raises(ValueError, match="design_holdout"):
        run_experiment(config, toy_dataset, tmp_path / "out")


def test_capacites_exigees_par_u1_et_design_holdout(monkeypatch, toy_dataset, unfair_config, tmp_path):
    """Un paquet Grid'5000 périmé doit refuser la config en une seconde, pas la fausser."""
    import pactiva_lab

    monkeypatch.setattr(pactiva_lab, "CAPABILITIES", frozenset({"taxonomy_projection", "population_filter"}))
    with pytest.raises(RuntimeError, match="unfair_target"):
        run_experiment(unfair_config, toy_dataset, tmp_path / "out")


def test_t1_inchangee(toy_dataset, base_config, tmp_path):
    """La tâche historique garde exactement son contrat (clé `split` additive)."""
    result = run_experiment(base_config, toy_dataset, tmp_path / "out")
    assert result["split"] == {"scheme": "group_kfold_document", "population": None,
                               "n_folds": 5, "n_train_documents": None, "n_test_documents": None}
    assert "unfair_f1" not in result["metrics"]

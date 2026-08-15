"""Enrichissements du runner (lot L0, `docs/pactiva-lab-resultats/06_PLAN_ACTION.md`) :
LRAP branché pour T2, IC bootstrap sur le plafond humain, statistiques de plis
complètes — et la non-régression du schéma de `results.json` (contrat additif).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pactiva_lab.runner import run_experiment  # noqa: E402


def _t2_config(base_config: dict) -> dict:
    return {**base_config, "task": "T2_multilabel"}


def test_lrap_present_pour_le_multilabel(toy_dataset, base_config, tmp_path):
    """⭐ LRAP était défini dans metrics.py mais appelé NULLE PART (audit 01_AUDIT §1.2)
    — alors que c'est la métrique déclarée clé du preset multilabel-finetune, LE
    classifieur du papier phare."""
    result = run_experiment(_t2_config(base_config), toy_dataset, tmp_path / "out")
    assert "lrap" in result["metrics"]
    assert 0.0 <= result["metrics"]["lrap"] <= 1.0
    # Par pli, donc moyenné et dispersé comme les autres métriques.
    assert "lrap_dispersion" in result["metrics"]
    assert all("lrap" in fold for fold in result["per_fold"])


def test_lrap_absent_du_monolabel(toy_dataset, base_config, tmp_path):
    """Un LRAP en T1 serait dégénéré (une seule étiquette vraie, toujours classée) —
    il n'apparaît que là où il informe."""
    result = run_experiment(base_config, toy_dataset, tmp_path / "out")
    assert "lrap" not in result["metrics"]


def test_plafond_humain_porte_son_intervalle(toy_dataset, base_config, tmp_path):
    """⭐ Le plafond est estimé sur le même petit effectif que les modèles : sans IC, la
    bande de référence serait une ligne faussement certaine
    (03_CADRE_STATISTIQUE.md §d)."""
    result = run_experiment(base_config, toy_dataset, tmp_path / "out")
    ceiling = result["human_ceiling"]
    ci = ceiling["ci"]
    assert ci["unit"] == "document"
    assert ci["low"] <= ceiling["value"] <= ci["high"]


def test_fold_stats_complets_sans_casser_la_dispersion_existante(
    toy_dataset, base_config, tmp_path
):
    result = run_experiment(base_config, toy_dataset, tmp_path / "out")
    metrics = result["metrics"]
    # Le champ historique reste un simple écart-type (contrat additif, rien de renommé).
    assert isinstance(metrics["macro_f1_dispersion"], float)
    # Le détail complet arrive à côté.
    stats = metrics["fold_stats"]["macro_f1"]
    assert set(stats) == {"mean", "std", "min", "max", "n"}
    assert stats["n"] == len(result["per_fold"])
    assert stats["min"] <= metrics["macro_f1"] <= stats["max"]
    assert stats["std"] == metrics["macro_f1_dispersion"]


def test_non_regression_du_schema_results_json(toy_dataset, base_config, tmp_path):
    """⭐ Golden de schéma : tous les champs qui existaient AVANT le lot L0 existent
    toujours, aux mêmes types — le frontend et l'ingestion en dépendent."""
    config = {
        **base_config,
        "evaluation": {**base_config["evaluation"], "bootstrap": {"enabled": True, "n_resamples": 50}},
    }
    result = run_experiment(config, toy_dataset, tmp_path / "out")

    assert set(result) >= {
        "task", "config", "dataset", "preprocess", "metrics", "per_fold",
        "per_label", "environment", "human_ceiling", "errors",
    }
    metrics = result["metrics"]
    for key in ("macro_f1", "micro_f1", "kappa", "ece"):
        assert isinstance(metrics[key], float), key
    for key in ("macro_f1_dispersion", "micro_f1_dispersion", "kappa_dispersion"):
        assert isinstance(metrics[key], float), key
    ci = metrics["macro_f1_ci"]
    assert set(ci) >= {"point", "low", "high", "nResamples", "unit"}
    assert isinstance(metrics["reliability_curve"], list)
    ceiling = result["human_ceiling"]
    assert set(ceiling) >= {"value", "metric", "task", "pairs", "note"}
    errors = result["errors"]
    assert set(errors) >= {
        "nErrors", "errorRate", "unfairErrorRate", "unfairSentences",
        "byAgreementClass", "lowestConfidenceErrors", "topConfusions", "confusionMatrix",
    }
    per_label = result["per_label"][0]
    assert set(per_label) >= {"label", "precision", "recall", "f1", "support"}

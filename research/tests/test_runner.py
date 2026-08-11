"""Bout en bout du runner, et les invariants scientifiques qu'il doit garantir."""

import json
from pathlib import Path

import pytest

from pactiva_lab.data import load_dataset
from pactiva_lab.preprocess.pipeline import build_text, describe, detokenize
from pactiva_lab.runner import run_experiment


# --------------------------------------------------------------------------- #
# Bout en bout
# --------------------------------------------------------------------------- #

def test_run_complet_produit_le_contrat_de_sortie(toy_dataset, base_config, tmp_path):
    out = tmp_path / "out"
    result = run_experiment(base_config, toy_dataset, out)

    for name in ("results.json", "predictions.jsonl", "environment.json", "_SENTINEL"):
        assert (out / name).exists(), name
    assert result["task"] == "T1_primary"
    assert 0.0 <= result["metrics"]["macro_f1"] <= 1.0
    assert len(result["per_fold"]) == 5


def test_sentinel_distingue_un_run_termine(toy_dataset, base_config, tmp_path):
    """Sans lui, un job tué par le walltime serait pris pour un succès."""
    out = tmp_path / "out"
    run_experiment(base_config, toy_dataset, out)
    assert (out / "_SENTINEL").read_text().strip() == "DONE"


def test_resultat_partiel_ecrit_a_chaque_pli(toy_dataset, base_config, tmp_path):
    """Le walltime de Grid'5000 est un couperet : un job tué à 90 % doit laisser
    exploitable ce qui est déjà calculé."""
    out = tmp_path / "out"
    run_experiment(base_config, toy_dataset, out)
    partial = json.loads((out / "results.partial.json").read_text())
    assert partial["partial"] is True
    assert partial["per_fold"]


def test_deterministe_a_configuration_identique(toy_dataset, base_config, tmp_path):
    """⭐ Sans déterminisme, aucun résultat n'est publiable."""
    a = run_experiment(base_config, toy_dataset, tmp_path / "a")
    b = run_experiment(base_config, toy_dataset, tmp_path / "b")
    assert a["metrics"] == b["metrics"]
    assert a["per_fold"] == b["per_fold"]


def test_progression_ecrite_pli_apres_pli(toy_dataset, base_config, tmp_path):
    progress = tmp_path / "progress.json"
    run_experiment(base_config, toy_dataset, tmp_path / "out", progress_path=progress)
    assert json.loads(progress.read_text())["percent"] == 100


def test_annulation_cooperative(toy_dataset, base_config, tmp_path):
    from pactiva_lab.runner import Cancelled

    with pytest.raises(Cancelled):
        run_experiment(base_config, toy_dataset, tmp_path / "out", should_cancel=lambda: True)


# --------------------------------------------------------------------------- #
# Les invariants scientifiques
# --------------------------------------------------------------------------- #

def test_aucun_document_dans_train_et_test(toy_dataset):
    """⭐ L'invariant qui protège l'article : pas de fuite entre les plis."""
    dataset = load_dataset(toy_dataset)
    for fold in range(len(dataset.folds)):
        train, test = dataset.fold_indices(fold)
        train_docs = {dataset.sentences[i].document for i in train}
        test_docs = {dataset.sentences[i].document for i in test}
        assert not (train_docs & test_docs)


def test_les_plis_viennent_du_dataset_pas_du_runner(toy_dataset, base_config, tmp_path):
    """Deux modèles ne sont comparables que sur les mêmes plis : le runner ne doit
    jamais en recalculer."""
    dataset = load_dataset(toy_dataset)
    original = [list(f) for f in dataset.folds]
    run_experiment(base_config, toy_dataset, tmp_path / "out")
    assert [list(f) for f in load_dataset(toy_dataset).folds] == original


def test_refuse_un_schema_de_decoupage_non_groupe(toy_dataset):
    splits = json.loads((Path(toy_dataset) / "splits.json").read_text())
    splits["scheme"] = "random_sentence"
    (Path(toy_dataset) / "splits.json").write_text(json.dumps(splits))
    with pytest.raises(ValueError, match="fuite"):
        load_dataset(toy_dataset)


def test_detecte_un_document_dans_deux_plis(toy_dataset):
    splits = json.loads((Path(toy_dataset) / "splits.json").read_text())
    splits["folds"][1].append(splits["folds"][0][0])
    (Path(toy_dataset) / "splits.json").write_text(json.dumps(splits))
    with pytest.raises(ValueError, match="deux plis"):
        load_dataset(toy_dataset)


def test_plafond_humain_present_et_qualifie(toy_dataset, base_config, tmp_path):
    """⭐ Un score sans plafond humain est ininterprétable."""
    result = run_experiment(base_config, toy_dataset, tmp_path / "out")
    ceiling = result["human_ceiling"]
    assert ceiling["value"] is not None
    # La méthode d'approximation doit être DITE, pas dissimulée.
    assert "approximation" in ceiling["note"].lower()


def test_bootstrap_reechantillonne_des_documents(toy_dataset, base_config, tmp_path):
    """⭐ Rééchantillonner des phrases donnerait des intervalles faussement étroits."""
    config = {**base_config, "evaluation": {
        **base_config["evaluation"],
        "bootstrap": {"enabled": True, "n_resamples": 50, "unit": "document"},
    }}
    result = run_experiment(config, toy_dataset, tmp_path / "out")
    ci = result["metrics"]["macro_f1_ci"]
    assert ci["unit"] == "document"
    assert ci["low"] <= ci["point"] <= ci["high"]


def test_micro_et_macro_toujours_rapportes(toy_dataset, base_config, tmp_path):
    """La longue traîne rend le micro flatteur et le macro sévère : les deux ou rien."""
    result = run_experiment(base_config, toy_dataset, tmp_path / "out")
    assert "macro_f1" in result["metrics"] and "micro_f1" in result["metrics"]


def test_scores_par_etiquette_avec_leur_support(toy_dataset, base_config, tmp_path):
    result = run_experiment(base_config, toy_dataset, tmp_path / "out")
    assert result["per_label"]
    assert all("support" in row for row in result["per_label"])
    # Trié par support décroissant : rend visible l'effondrement sur les rares.
    supports = [row["support"] for row in result["per_label"]]
    assert supports == sorted(supports, reverse=True)


def test_dispersion_inter_plis_rapportee(toy_dataset, base_config, tmp_path):
    """Sur un petit corpus, l'instabilité compte autant que la moyenne."""
    result = run_experiment(base_config, toy_dataset, tmp_path / "out")
    assert result["metrics"]["macro_f1_dispersion"] is not None


# --------------------------------------------------------------------------- #
# Analyse d'erreurs
# --------------------------------------------------------------------------- #

def test_analyse_d_erreurs_croise_l_abusivite_et_l_accord(toy_dataset, base_config, tmp_path):
    result = run_experiment(base_config, toy_dataset, tmp_path / "out")
    errors = result["errors"]
    assert "unfairErrorRate" in errors
    # Là où les humains divergent, le modèle échoue-t-il aussi ? C'est la mesure de
    # l'ambiguïté irréductible, au lieu de la postuler.
    assert "byAgreementClass" in errors
    assert "topConfusions" in errors


# --------------------------------------------------------------------------- #
# Prétraitement
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize(
    "raw,expected",
    [
        ("terms and conditions of use .", "Terms and conditions of use."),
        ("you ' re responsible .", "You're responsible."),
        ("we do n ' t warrant .", "We do n't warrant."),
        ("( a ) the service", "(a) the service"),
    ],
)
def test_detokenize_restaure_la_ponctuation(raw, expected):
    """Le corpus CLAUDETTE est pré-tokenisé ; les transformers attendent du texte
    naturel. C'est probablement le prétraitement le plus rentable du plan."""
    assert detokenize(raw) == expected


def test_le_contexte_ne_deborde_jamais_sur_un_autre_document(toy_dataset):
    """⭐ Une fenêtre qui déborde sur le contrat suivant est une fuite discrète."""
    dataset = load_dataset(toy_dataset)
    by_document = {}
    for sentence in dataset.sentences:
        by_document.setdefault(sentence.document, []).append(sentence)

    first = by_document["Atlas"][0]
    text = build_text(
        first,
        neighbours=by_document["Atlas"],
        config={"context": {"window_before": 3, "window_after": 0}},
    )
    # La première phrase du document n'a aucun prédécesseur : rien à concaténer.
    assert "[SEP]" not in text


def test_contexte_concatene_les_voisins_du_meme_document(toy_dataset):
    dataset = load_dataset(toy_dataset)
    atlas = [s for s in dataset.sentences if s.document == "Atlas"]
    text = build_text(
        atlas[3], neighbours=atlas, config={"context": {"window_before": 2, "window_after": 1}}
    )
    assert text.count("[SEP]") == 3


def test_position_encodee_en_marqueur_symbolique(toy_dataset):
    dataset = load_dataset(toy_dataset)
    atlas = [s for s in dataset.sentences if s.document == "Atlas"]
    text = build_text(
        atlas[-1], neighbours=atlas, config={"context": {"include_doc_position": True}}
    )
    assert text.startswith("<POS9>")


def test_describe_resume_le_pretraitement():
    assert "detok=regex_rules" in describe({"detokenize": "regex_rules"})
    assert "ctx=-1/+1" in describe({"context": {"window_before": 1, "window_after": 1}})


# --------------------------------------------------------------------------- #
# Pureté du package
# --------------------------------------------------------------------------- #

def test_le_package_ne_depend_pas_de_django():
    """⭐ C'est ce découplage qui permet d'exécuter le même code sur Grid'5000."""
    import sys

    import pactiva_lab.runner  # noqa: F401

    assert not any(name.startswith("django") for name in sys.modules)


def test_le_socle_ne_depend_pas_de_sklearn_ni_de_torch():
    """Les baselines et les métriques doivent tourner sur une frontale sans
    environnement scientifique."""
    import inspect

    from pactiva_lab.evaluation import bootstrap, metrics
    from pactiva_lab.models import baselines

    for module in (metrics, bootstrap, baselines):
        source = inspect.getsource(module)
        assert "import sklearn" not in source
        assert "import torch" not in source


def test_reliability_curve_accompagne_l_ece(toy_dataset, base_config, tmp_path):
    """⭐ F10 (calibration) a besoin de la COURBE, pas seulement du score agrégé : un
    ECE unique cache si le modèle est trop sûr, pas assez, ou juste sur une tranche."""
    result = run_experiment(base_config, toy_dataset, tmp_path / "out")
    curve = result["metrics"]["reliability_curve"]
    assert isinstance(curve, list) and curve
    for bucket in curve:
        assert {"bin", "meanConfidence", "accuracy", "count"} <= set(bucket)

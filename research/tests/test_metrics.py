"""Métriques — vérifiées contre des cas connus, puisqu'elles sont réécrites à la main."""

import pytest

from pactiva_lab.evaluation.bootstrap import bootstrap_ci, fold_dispersion
from pactiva_lab.evaluation.ceiling import human_ceiling
from pactiva_lab.evaluation.metrics import (
    accuracy,
    cohen_kappa,
    expected_calibration_error,
    lrap,
    macro_f1,
    multilabel_prf,
    per_class_prf,
    window_diff,
)
from pactiva_lab.models.baselines import (
    LlmJudgeBaseline,
    MajorityBaseline,
    PositionBaseline,
    TfidfLinear,
    build_model,
)


# --------------------------------------------------------------------------- #
# T1
# --------------------------------------------------------------------------- #

def test_accuracy_et_kappa_parfaits():
    y = ["A", "B", "A", "C"]
    assert accuracy(y, y) == 1.0
    assert cohen_kappa(y, y) == 1.0


def test_kappa_nul_quand_l_accord_est_celui_du_hasard():
    """Deux prédictions constantes mais différentes : accord observé nul."""
    assert cohen_kappa(["A", "A", "B", "B"], ["B", "B", "A", "A"]) < 0


def test_macro_f1_penalise_une_classe_jamais_predite():
    """⭐ Le cœur de la longue traîne : une classe rare jamais prédite fait chuter le
    macro, alors que le micro reste flatteur."""
    y_true = ["A"] * 9 + ["RARE"]
    y_pred = ["A"] * 10
    stats = per_class_prf(y_true, y_pred)
    assert stats["RARE"]["f1"] == 0.0
    assert stats["RARE"]["support"] == 1
    assert macro_f1(y_true, y_pred) < accuracy(y_true, y_pred)


def test_per_class_rapporte_toujours_le_support():
    stats = per_class_prf(["A", "A", "B"], ["A", "B", "B"])
    assert stats["A"]["support"] == 2
    assert stats["B"]["support"] == 1


def test_window_diff_nul_si_identique():
    truth = [True, False, False, True, False, False]
    assert window_diff(truth, list(truth)) == 0.0


def test_window_diff_positif_si_frontiere_manquante():
    assert window_diff([True, False, False, True, False, False], [True] + [False] * 5) > 0


# --------------------------------------------------------------------------- #
# T2
# --------------------------------------------------------------------------- #

def test_multilabel_parfait():
    y = [{"A", "B"}, {"C"}]
    stats = multilabel_prf(y, [set(s) for s in y])
    assert stats["micro_f1"] == 1.0
    assert stats["subset_accuracy"] == 1.0
    assert stats["hamming_loss"] == 0.0


def test_multilabel_etiquette_manquante():
    stats = multilabel_prf([{"A", "B"}], [{"A"}])
    assert stats["micro_f1"] == pytest.approx(2 / 3)
    assert stats["subset_accuracy"] == 0.0


def test_lrap_parfait_quand_la_bonne_etiquette_est_en_tete():
    assert lrap([{"A"}], [{"A": 0.9, "B": 0.1}]) == 1.0


def test_lrap_degrade_quand_elle_est_reléguee():
    assert lrap([{"B"}], [{"A": 0.9, "B": 0.1}]) == 0.5


# --------------------------------------------------------------------------- #
# Calibration
# --------------------------------------------------------------------------- #

def test_ece_nul_quand_la_confiance_est_juste():
    assert expected_calibration_error([1.0] * 10, [True] * 10) == 0.0


def test_ece_maximal_quand_la_confiance_ment():
    """Une suggestion annoncée à 100 % qui n'a jamais raison : le pire cas."""
    assert expected_calibration_error([1.0] * 10, [False] * 10) == 1.0


# --------------------------------------------------------------------------- #
# Bootstrap
# --------------------------------------------------------------------------- #

def test_bootstrap_encadre_le_point():
    documents = [f"doc{i}" for i in range(20)]
    ci = bootstrap_ci(documents, lambda d: len(d) / 20, n_resamples=100)
    assert ci["low"] <= ci["point"] <= ci["high"]
    assert ci["unit"] == "document"


def test_bootstrap_previent_quand_un_seul_groupe():
    """Un intervalle de largeur nulle serait lu comme une certitude : mieux vaut le
    déclarer incalculable."""
    ci = bootstrap_ci(["seul"], lambda d: 1.0)
    assert ci["low"] is None
    assert ci["warning"] == "insufficient_groups"


def test_bootstrap_reproductible():
    documents = [f"doc{i}" for i in range(15)]
    a = bootstrap_ci(documents, lambda d: len(set(d)) / 15, n_resamples=50, seed=7)
    b = bootstrap_ci(documents, lambda d: len(set(d)) / 15, n_resamples=50, seed=7)
    assert a == b


def test_fold_dispersion():
    stats = fold_dispersion([0.5, 0.6, 0.7])
    assert stats["mean"] == pytest.approx(0.6)
    assert stats["std"] > 0
    assert stats["n"] == 3


# --------------------------------------------------------------------------- #
# Plafond humain
# --------------------------------------------------------------------------- #

def _annotations(primary_by_key):
    return {
        key: {"primary": value, "themes": [value], "boundary": False}
        for key, value in primary_by_key.items()
    }


def test_plafond_humain_parfait_si_annotateurs_identiques():
    keys = {("doc", i): "A" if i % 2 else "B" for i in range(30)}
    result = human_ceiling({"a1": _annotations(keys), "a2": _annotations(keys)})
    assert result["value"] == 1.0
    assert result["pairs"] == 1


def test_plafond_humain_refuse_un_seul_annotateur():
    result = human_ceiling({"a1": _annotations({("doc", 0): "A"})})
    assert result["value"] is None
    assert result["warning"] == "insufficient_annotators"


def test_plafond_humain_refuse_un_recouvrement_trop_faible():
    """Sous 20 phrases partagées, la borne serait trop bruitée pour servir."""
    keys = {("doc", i): "A" for i in range(5)}
    result = human_ceiling({"a1": _annotations(keys), "a2": _annotations(keys)})
    assert result["warning"] == "insufficient_overlap"


def test_plafond_humain_depend_de_la_tache():
    """⭐ Le plafond de T1 (κ 0,769) n'est pas celui de T2 (α-MASI 0,635)."""
    keys = {("doc", i): "A" for i in range(30)}
    annotations = {"a1": _annotations(keys), "a2": _annotations(keys)}
    assert human_ceiling(annotations, task="T1_primary")["metric"] == "macro_f1"
    assert human_ceiling(annotations, task="T3_boundary")["metric"] == "boundary_f1"


# --------------------------------------------------------------------------- #
# Baselines
# --------------------------------------------------------------------------- #

def test_majority_predit_la_classe_dominante():
    model = MajorityBaseline()
    model.fit(["x"] * 5, ["A", "A", "A", "B", "C"])
    assert model.predict(["y", "z"]) == ["A", "A"]


def test_position_only_exploite_la_structure():
    """⭐ Baseline diagnostique : les ToS suivent un ordre très régulier."""
    model = PositionBaseline()
    texts = ["x"] * 20
    labels = ["PREAMBLE"] * 10 + ["ARBITRATION"] * 10
    extra = [{"doc_position": i / 19} for i in range(20)]
    model.fit(texts, labels, extra)
    assert model.predict(["x"], [{"doc_position": 0.0}]) == ["PREAMBLE"]
    assert model.predict(["x"], [{"doc_position": 1.0}]) == ["ARBITRATION"]


def test_tfidf_separe_deux_vocabulaires():
    model = TfidfLinear(min_df=1)
    model.fit(
        ["termination account closed", "termination end service",
         "payment fees billing", "payment charge card"],
        ["TERMINATION", "TERMINATION", "FEES", "FEES"],
    )
    assert model.predict(["account termination notice"]) == ["TERMINATION"]
    assert model.predict(["billing card charge"]) == ["FEES"]


def test_tfidf_probabilites_normalisees():
    model = TfidfLinear(min_df=1)
    model.fit(["a b", "c d"], ["A", "B"])
    scores = model.predict_proba(["a b"])[0]
    assert sum(scores.values()) == pytest.approx(1.0)


def test_llm_judge_ne_relance_aucune_inference():
    """Les quatre juges ont déjà annoté les 50 documents : baseline gratuite."""
    index = {("doc", 0): {"fable": "A"}, ("doc", 1): {"fable": "B"}}
    model = LlmJudgeBaseline("fable", index)
    model.fit(["x", "y"], ["A", "B"])
    predictions = model.predict(
        ["x", "y", "z"],
        [{"document": "doc", "index": 0}, {"document": "doc", "index": 1},
         {"document": "doc", "index": 99}],
    )
    assert predictions[:2] == ["A", "B"]
    assert predictions[2] in ("A", "B")  # repli, jamais d'absence de prédiction


def test_build_model_refuse_une_famille_inconnue():
    with pytest.raises(ValueError, match="inconnue"):
        build_model({"family": "reseau_de_neurones_magique"})


def test_build_model_signale_une_dependance_manquante_avec_la_commande():
    """Un ImportError opaque au milieu d'un run de six heures est inacceptable."""
    from pactiva_lab.models.heavy import MissingDependency, _require

    with pytest.raises(MissingDependency, match="pip install"):
        _require("module_qui_n_existe_pas", "embeddings")


class TestGraineDesModelesLourds:
    """⭐ Audit de reproductibilité : `EmbeddingsHead`/`TransformerFinetune` n'utilisaient
    jamais `config["seed"]` — la tête de classification de `TransformerFinetune` aurait
    été réinitialisée aléatoirement à chaque run, cassant la promesse « même
    configuration, même résultat » du plan scientifique (§3.4). Les constructeurs
    seuls (testés ici) n'importent ni torch ni sklearn : testables sans ces dépendances."""

    def test_embeddings_head_stocke_la_graine(self):
        from pactiva_lab.models.heavy import EmbeddingsHead

        model = EmbeddingsHead({"encoder": "x", "head": "mlp"}, seed=7)
        assert model.seed == 7

    def test_transformer_finetune_stocke_la_graine(self):
        from pactiva_lab.models.heavy import TransformerFinetune

        model = TransformerFinetune({"checkpoint": "x"}, seed=7)
        assert model.seed == 7

    def test_build_model_propage_la_graine_aux_familles_lourdes(self):
        from pactiva_lab.models.heavy import EmbeddingsHead

        model = build_model({"family": "embeddings_head", "encoder": "x"}, seed=13)
        assert isinstance(model, EmbeddingsHead)
        assert model.seed == 13

    def test_build_model_seed_par_defaut_est_42(self):
        """Cohérent avec `experiment-config.schema.json` (`seed` par défaut 42) — un
        appelant qui omet la graine doit obtenir la même valeur que le schéma promet."""
        from pactiva_lab.models.heavy import EmbeddingsHead

        model = build_model({"family": "embeddings_head", "encoder": "x"})
        assert isinstance(model, EmbeddingsHead)
        assert model.seed == 42

"""Découpage en plis — l'invariant qui protège l'article d'une fuite de données."""

import pytest

from claire.lab.aggregation import UnknownAggregation, aggregate_sentence
from claire.lab.splits import (
    TooFewGroups,
    group_kfold,
    split_manifest,
    validate_folds,
)

CORPUS = {
    "Microsoft": 548, "Skype": 455, "Airbnb": 391, "Headspace": 372, "LindenLab": 344,
    "musically": 316, "Spotify": 293, "eBay": 260, "Zynga": 248, "Oculus": 240,
    "Atlas": 60, "Google": 93, "Netflix": 86, "9gag": 139, "Academia": 193,
}


# --------------------------------------------------------------------------- #
# group_kfold
# --------------------------------------------------------------------------- #

def test_partition_exacte():
    """⭐ Aucun document dans deux plis, aucun document perdu."""
    folds = group_kfold(CORPUS, k=5)
    validate_folds(folds, set(CORPUS))
    assert sum(len(f) for f in folds) == len(CORPUS)


def test_deterministe_a_graine_egale():
    """Deux constructions identiques doivent donner exactement les mêmes plis, sinon
    l'empreinte du dataset ne veut rien dire."""
    assert group_kfold(CORPUS, k=5, seed=42) == group_kfold(CORPUS, k=5, seed=42)


def test_graines_differentes_donnent_des_plis_differents():
    assert group_kfold(CORPUS, k=5, seed=1) != group_kfold(CORPUS, k=5, seed=999)


def test_equilibrage_par_phrases_et_non_par_documents():
    """Le corpus va de 60 à 548 phrases : équilibrer par nombre de documents produirait
    des plis dont la taille varie d'un facteur trois."""
    manifest = split_manifest(CORPUS, k=5)
    sizes = manifest["foldSizes"]
    assert max(sizes) / min(sizes) < 1.6


def test_refuse_moins_de_documents_que_de_plis():
    """Mieux vaut échouer ici qu'au milieu d'un entraînement."""
    with pytest.raises(TooFewGroups) as exc:
        group_kfold({"Atlas": 60, "Google": 93}, k=5)
    assert "impossible" in str(exc.value)


def test_refuse_k_inferieur_a_deux():
    with pytest.raises(ValueError):
        group_kfold(CORPUS, k=1)


def test_ordre_stable_independant_du_hash_de_python():
    """L'ordre repose sur SHA-256, pas sur `hash()` (randomisé par processus) : un
    dataset construit sur deux machines doit porter la même empreinte."""
    shuffled = dict(reversed(list(CORPUS.items())))
    assert group_kfold(CORPUS, k=5, seed=7) == group_kfold(shuffled, k=5, seed=7)


def test_validate_folds_detecte_un_doublon():
    with pytest.raises(ValueError, match="deux plis"):
        validate_folds([["A", "B"], ["B"]], {"A", "B"})


def test_validate_folds_detecte_un_manquant():
    with pytest.raises(ValueError, match="incomplète"):
        validate_folds([["A"]], {"A", "B"})


def test_split_manifest_documente_sa_raison_d_etre():
    """Le manifeste voyage avec le dataset publié : il doit porter la justification."""
    manifest = split_manifest(CORPUS, k=5)
    assert manifest["scheme"] == "group_kfold_document"
    assert "fuir" in manifest["rationale"]


# --------------------------------------------------------------------------- #
# aggregate_sentence
# --------------------------------------------------------------------------- #

def test_consensus_unanime():
    votes = [("a", "TERMINATION", ()), ("b", "TERMINATION", ()), ("c", "TERMINATION", ())]
    result = aggregate_sentence(votes, policy="consensus")
    assert result["primary"] == "TERMINATION"
    assert result["agreement"] == "strict"
    assert result["nAnnotators"] == 3


def test_consensus_majoritaire():
    votes = [("a", "TERMINATION", ()), ("b", "TERMINATION", ()), ("c", "LICENSE_IP", ())]
    result = aggregate_sentence(votes, policy="consensus")
    assert result["primary"] == "TERMINATION"
    assert result["agreement"] == "majority"


def test_consensus_divergence_produit_quand_meme_une_etiquette():
    """Une divergence totale n'est pas une absence d'étiquette : c'est une étiquette
    assortie d'une classe d'accord qui dit de s'en méfier."""
    votes = [("a", "A", ()), ("b", "B", ()), ("c", "C", ())]
    result = aggregate_sentence(votes, policy="consensus")
    assert result["primary"] is not None
    assert result["agreement"] == "divergence"


def test_secondaires_retenus_au_dela_du_plancher():
    """Le plancher (≥2 annotateurs) évite qu'un thème proposé par une seule personne
    pollue le gold, sans pour autant perdre les secondaires partagés."""
    votes = [
        ("a", "TERMINATION", ("FEES_PAYMENT",)),
        ("b", "TERMINATION", ("FEES_PAYMENT",)),
        ("c", "TERMINATION", ("META",)),
    ]
    result = aggregate_sentence(votes, policy="consensus")
    assert result["secondaries"] == ["FEES_PAYMENT"]


def test_single_selectionne_l_annotateur_demande():
    votes = [("a", "A", ()), ("b", "B", ())]
    result = aggregate_sentence(votes, policy="single", single_annotator="b")
    assert result["primary"] == "B"
    assert result["agreement"] == "single"


def test_single_sans_annotateur_leve():
    with pytest.raises(UnknownAggregation):
        aggregate_sentence([("a", "A", ())], policy="single")


def test_single_renvoie_none_si_l_annotateur_n_a_pas_couvert():
    assert aggregate_sentence([("a", "A", ())], policy="single", single_annotator="z") is None


def test_soft_conserve_la_distribution():
    """La réponse à Braun 2023 : ne pas effacer le désaccord."""
    votes = [("a", "A", ()), ("b", "A", ()), ("c", "B", ())]
    result = aggregate_sentence(votes, policy="soft")
    assert result["soft"] == {"A": pytest.approx(2 / 3), "B": pytest.approx(1 / 3)}
    assert result["voteEntropy"] > 0


def test_soft_entropie_nulle_si_unanime():
    votes = [("a", "A", ()), ("b", "A", ())]
    result = aggregate_sentence(votes, policy="soft")
    assert result["voteEntropy"] == 0.0


def test_phrase_non_couverte_renvoie_none():
    assert aggregate_sentence([("a", None, ())], policy="consensus") is None
    assert aggregate_sentence([], policy="consensus") is None


def test_politique_inconnue_leve():
    with pytest.raises(UnknownAggregation):
        aggregate_sentence([("a", "A", ())], policy="vote_pondere")


def test_les_modules_restent_purs():
    """`splits` n'importe ni Django ni scikit-learn ; `aggregation` ne réimplémente pas
    le vote mais réutilise `gold_scoring` (dont l'invariant « les LLM ne sont jamais
    parties au conflit » ne doit pas être contourné)."""
    import inspect

    from claire.lab import aggregation, splits

    assert "sklearn" not in inspect.getsource(splits)
    assert "from django" not in inspect.getsource(splits)
    assert "gold_scoring" in inspect.getsource(aggregation)

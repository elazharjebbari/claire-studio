"""Métriques de qualité scientifique du Lab — modules purs.

Le test le plus important du fichier est `test_boundary_agreement_ne_vaut_pas_un` : il
verrouille le correctif de l'artefact `boundaryKappa`, qui valait 1,000 par construction
et aurait été une erreur factuelle dans l'article.
"""

import pytest

from claire.lab.agreement import (
    alpha_masi_report,
    annotator_audit,
    gold_progress,
    human_llm_matrix,
)
from claire.lab.quality import (
    boundary_agreement,
    campaign_readiness,
    cooccurrence,
    jaccard,
    label_distribution,
    pk_metric,
    segment_starts,
    theme_sets_by_sentence,
    window_diff,
)


def clause(anchor, primary, secondaries=()):
    return {
        "anchorIndex": anchor,
        "primaryTheme": primary,
        "secondaryThemes": list(secondaries),
        "validated": True,
    }


def payload(documents, annotations, llm=(), gold=()):
    return {
        "documents": [{"id": d, "nSentences": n} for d, n in documents],
        "annotations": [
            {
                "documentId": d,
                "actorKey": actor,
                "status": status,
                "clauses": clauses,
            }
            for d, actor, status, clauses in annotations
        ],
        "llmAnnotations": [
            {"documentId": d, "judge": j, "clauses": c} for d, j, c in llm
        ],
        "goldSentences": list(gold),
    }


# --------------------------------------------------------------------------- #
# Segments reconstruits — le correctif
# --------------------------------------------------------------------------- #

def test_theme_sets_projette_par_bloc():
    """Une ancre couvre jusqu'à l'ancre suivante."""
    sets = theme_sets_by_sentence([clause(0, "A"), clause(3, "B")], 5)
    assert sets == [
        frozenset({"A"}), frozenset({"A"}), frozenset({"A"}),
        frozenset({"B"}), frozenset({"B"}),
    ]


def test_segment_starts_ne_retient_que_les_changements():
    """Le cœur du correctif : les ANCRES sont partout, les CHANGEMENTS non."""
    sets = theme_sets_by_sentence([clause(i, "A") for i in range(5)], 5)
    # Cinq ancres (une par phrase) mais un seul segment.
    assert segment_starts(sets) == {0}


def test_boundary_agreement_ne_vaut_pas_un():
    """⭐ LE test du correctif.

    Deux annotateurs qui posent une ancre sur CHAQUE phrase (ce que produit le
    pré-remplissage) mais qui segmentent différemment : l'ancien kappa d'ancres aurait
    donné 1,000 ; l'accord de segments doit être strictement inférieur.
    """
    a = [clause(0, "A"), clause(1, "A"), clause(2, "B"), clause(3, "B")]
    b = [clause(0, "A"), clause(1, "B"), clause(2, "B"), clause(3, "B")]
    result = boundary_agreement(payload([(1, 4)], [(1, "human:1", "submitted", a),
                                                   (1, "human:2", "submitted", b)]))
    assert result["meanJaccard"] is not None
    assert result["meanJaccard"] < 1.0
    assert result["perDocument"][0]["segmentsPerAnnotator"] == [2, 2]


def test_boundary_agreement_parfait_quand_la_segmentation_est_identique():
    a = [clause(0, "A"), clause(2, "B")]
    result = boundary_agreement(payload([(1, 4)], [(1, "human:1", "submitted", a),
                                                   (1, "human:2", "submitted", list(a))]))
    assert result["meanJaccard"] == 1.0


def test_boundary_agreement_ignore_les_documents_mono_annotes():
    result = boundary_agreement(
        payload([(1, 4)], [(1, "human:1", "submitted", [clause(0, "A")])])
    )
    assert result["documentsCompared"] == 0
    assert result["meanJaccard"] is None


def test_boundary_agreement_declare_ce_qu_il_remplace():
    """La métrique porte sa propre justification : un lecteur du rapport doit savoir
    pourquoi le chiffre a changé."""
    result = boundary_agreement(payload([], []))
    assert "boundary_kappa" in result["replaces"]


@pytest.mark.parametrize(
    "a,b,expected",
    [({0, 5}, {0, 5}, 1.0), (set(), set(), 1.0), ({0}, {1}, 0.0), ({0, 1}, {0}, 0.5)],
)
def test_jaccard(a, b, expected):
    assert jaccard(a, b) == expected


def test_windowdiff_et_pk_nuls_quand_identiques():
    starts = {0, 10, 20}
    assert window_diff(starts, set(starts), 30) == 0.0
    assert pk_metric(starts, set(starts), 30) == 0.0


def test_windowdiff_penalise_une_segmentation_absente():
    assert window_diff({0, 10, 20}, {0}, 30) > 0.0


# --------------------------------------------------------------------------- #
# Distribution
# --------------------------------------------------------------------------- #

def test_label_distribution_signale_les_themes_rares():
    clauses = [clause(i, "COMMON") for i in range(60)] + [clause(60, "RARE")]
    result = label_distribution(payload([(1, 61)], [(1, "human:1", "submitted", clauses)]))
    assert result["rareThemes"] == ["RARE"]
    assert "rare_themes_below_threshold" in result["warnings"]
    assert result["themes"][0]["code"] == "COMMON"


def test_label_distribution_entropie_maximale_si_uniforme():
    clauses = [clause(0, "A"), clause(1, "B"), clause(2, "C")]
    result = label_distribution(payload([(1, 3)], [(1, "human:1", "submitted", clauses)]))
    assert result["normalizedEntropy"] == pytest.approx(1.0, abs=1e-6)
    assert result["imbalanceRatio"] == 1.0


# --------------------------------------------------------------------------- #
# Co-occurrence — le pont vers l'objectif B
# --------------------------------------------------------------------------- #

def test_cooccurrence_calcule_le_lift_par_paire():
    """Reproduit en miniature le résultat de prod : une paire précise concentre
    l'abusivité, alors que le multi-label brut n'explique presque rien."""
    clauses = [
        clause(0, "LICENSE_IP", ["TERMINATION"]),
        clause(1, "LICENSE_IP", ["TERMINATION"]),
        clause(2, "META", ["PREAMBLE_SCOPE"]),
        clause(3, "META", ["PREAMBLE_SCOPE"]),
    ]
    unfair = {(1, 0): ["TER"], (1, 1): ["TER"]}
    result = cooccurrence(
        payload([(1, 4)], [(1, "human:1", "submitted", clauses)]), unfair
    )
    top = result["pairs"][0]
    assert top["themes"] == ["LICENSE_IP", "TERMINATION"]
    assert top["unfairRate"] == 1.0
    assert top["lift"] == 2.0  # taux de base = 50 %
    dead = [p for p in result["pairs"] if p["themes"] == ["META", "PREAMBLE_SCOPE"]][0]
    assert dead["lift"] == 0.0


def test_cooccurrence_rapporte_le_lift_de_cardinalite():
    """⭐ Le CONTRE-résultat à ne pas oublier : mono vs multi n'explique presque rien."""
    clauses = [clause(0, "A"), clause(1, "B", ["C"])]
    unfair = {(1, 0): ["TER"], (1, 1): ["TER"]}
    result = cooccurrence(payload([(1, 2)], [(1, "human:1", "submitted", clauses)]), unfair)
    assert result["cardinalityLift"] == 1.0
    assert result["monoLabel"]["count"] == 1
    assert result["multiLabel"]["count"] == 1


def test_cooccurrence_sans_labels_previent():
    result = cooccurrence(payload([(1, 1)], [(1, "human:1", "submitted", [clause(0, "A", ["B"])])]))
    assert "no_reference_labels" in result["warnings"]


def test_cooccurrence_compte_les_combinaisons_hapax():
    clauses = [clause(0, "A", ["B"]), clause(1, "C", ["D"])]
    result = cooccurrence(payload([(1, 2)], [(1, "human:1", "submitted", clauses)]))
    assert result["nHapaxCombinations"] == 2


# --------------------------------------------------------------------------- #
# Prêt pour la science
# --------------------------------------------------------------------------- #

def test_campaign_readiness_compte_les_complets_non_soumis():
    """⭐ Le champ qui rend visible le travail fini mais invisible aux calculs."""
    clauses = [clause(i, "A") for i in range(3)]
    result = campaign_readiness(
        payload(
            [(1, 3)],
            [
                (1, "human:1", "submitted", clauses),
                (1, "human:2", "draft", clauses),  # complet mais pas soumis
            ],
        )
    )
    assert len(result["completeButNotSubmitted"]) == 1
    assert result["completeButNotSubmitted"][0]["actorKey"] == "human:2"
    assert result["documentsMultiAnnotatedSubmitted"] == 0
    assert result["documentsMultiAnnotatedComplete"] == 1


def test_campaign_readiness_liste_les_blocages_par_severite():
    result = campaign_readiness(payload([(1, 3)], []))
    codes = [b["code"] for b in result["blockers"]]
    assert "multi_annotated_below_target" in codes
    # Les blocages `high` passent devant les `medium`.
    assert result["blockers"][0]["severity"] == "high"


def test_campaign_readiness_ne_compte_pas_une_annotation_partielle():
    partial = [clause(0, "A")]  # 1 clause sur 3 phrases
    result = campaign_readiness(payload([(1, 3)], [(1, "human:1", "draft", partial)]))
    assert result["completeButNotSubmitted"] == []


# --------------------------------------------------------------------------- #
# α-MASI
# --------------------------------------------------------------------------- #

def test_alpha_masi_expose_aussi_alpha_nominal():
    """⭐ C'est l'ÉCART qui porte le résultat R1, pas la valeur absolue."""
    a = [clause(0, "A", ["B"]), clause(1, "C")]
    b = [clause(0, "A"), clause(1, "C")]
    result = alpha_masi_report(
        payload([(1, 2)], [(1, "human:1", "submitted", a), (1, "human:2", "submitted", b)])
    )
    assert "alphaMasi" in result and "alphaNominal" in result
    assert "multiLabelCost" in result
    assert result["thresholds"]["acceptable"] == 0.667


def test_alpha_masi_accord_parfait_vaut_un():
    a = [clause(0, "A"), clause(1, "B")]
    result = alpha_masi_report(
        payload([(1, 2)], [(1, "human:1", "submitted", a), (1, "human:2", "submitted", list(a))])
    )
    assert result["alphaMasi"] == 1.0
    assert result["band"] == "reliable"


def test_alpha_masi_classe_sous_le_seuil():
    result = alpha_masi_report(payload([], []))
    assert result["band"] == "unknown"
    assert "insufficient_support" in result["warnings"]


def test_alpha_masi_detaille_par_theme():
    a = [clause(0, "A"), clause(1, "B")]
    result = alpha_masi_report(
        payload([(1, 2)], [(1, "human:1", "submitted", a), (1, "human:2", "submitted", list(a))])
    )
    assert {r["code"] for r in result["perTheme"]} == {"A", "B"}


# --------------------------------------------------------------------------- #
# Matrice humains × LLM
# --------------------------------------------------------------------------- #

def test_human_llm_matrix_separe_les_trois_familles():
    """⭐ Le résultat R2 : humain↔humain doit dominer humain↔LLM."""
    human = [clause(0, "A"), clause(1, "A")]
    llm_good = [{"anchorIndex": 0, "primaryTheme": "A"}]
    llm_bad = [{"anchorIndex": 0, "primaryTheme": "Z"}]
    result = human_llm_matrix(
        payload(
            [(1, 2)],
            [(1, "human:1", "submitted", human), (1, "human:2", "submitted", list(human))],
            llm=[(1, "fable", llm_good), (1, "codex", llm_bad)],
        ),
        ["fable", "claude", "codex", "mistral"],
    )
    assert result["humanMean"] == 1.0
    assert result["crossMean"] < 1.0
    assert result["humanAdvantage"] > 0


def test_human_llm_matrix_ordonne_les_juges_selon_la_source_unique():
    """L'ordre vient de `Judge.import_judges()`, jamais d'une liste écrite sur place."""
    result = human_llm_matrix(
        payload(
            [(1, 1)],
            [(1, "human:1", "submitted", [clause(0, "A")])],
            llm=[(1, "mistral", [{"anchorIndex": 0, "primaryTheme": "A"}]),
                 (1, "fable", [{"anchorIndex": 0, "primaryTheme": "A"}])],
        ),
        ["fable", "claude", "codex", "mistral"],
    )
    keys = [a["key"] for a in result["actors"]]
    assert keys.index("llm:fable") < keys.index("llm:mistral")


# --------------------------------------------------------------------------- #
# Audit et gold
# --------------------------------------------------------------------------- #

def test_annotator_audit_revele_le_desequilibre_de_charge():
    """90 % du corpus par une personne doit sauter aux yeux : cela conditionne la
    lecture de tous les accords."""
    many = [clause(i, "A") for i in range(9)]
    few = [clause(0, "A")]
    result = annotator_audit(
        payload([(1, 9), (2, 1)],
                [(1, "human:1", "submitted", many), (2, "human:2", "submitted", few)])
    )
    assert result["workloadImbalance"] == 0.9
    assert result["warnings"] == ["restricted_metric"]


def test_annotator_audit_detecte_un_biais_thematique():
    biased = [clause(i, "REFUGE") for i in range(4)]
    normal = [clause(i, "A") for i in range(4)]
    result = annotator_audit(
        payload([(1, 4), (2, 4)],
                [(1, "human:1", "submitted", biased), (2, "human:2", "submitted", normal)])
    )
    row = [r for r in result["actors"] if r["actorKey"] == "human:1"][0]
    assert row["themeBias"][0]["code"] == "REFUGE"
    assert row["themeBias"][0]["ratio"] == 2.0


def test_gold_progress_trie_le_backlog_par_risque():
    gold = [
        {"documentId": 1, "index": 0, "autoLevel": "manual", "decided": False,
         "riskBand": "low", "agreementClass": "divergence"},
        {"documentId": 1, "index": 1, "autoLevel": "manual", "decided": False,
         "riskBand": "high", "agreementClass": "divergence"},
        {"documentId": 1, "index": 2, "autoLevel": "auto_1click", "decided": True,
         "riskBand": "low", "agreementClass": "strict"},
    ]
    result = gold_progress(payload([(1, 3)], [], gold=gold))
    assert result["backlogSize"] == 2
    assert result["arbitrationBacklog"][0]["riskBand"] == "high"
    assert result["byAutoLevel"]["manual"] == 2
    assert result["pctDecided"] == pytest.approx(1 / 3, abs=1e-4)


# --------------------------------------------------------------------------- #
# Pureté
# --------------------------------------------------------------------------- #

def test_les_modules_de_metriques_restent_purs():
    """Aucun import Django : c'est ce qui permet de rejouer ces calculs sur un export
    hors ligne, et de les tester sans base."""
    import inspect

    from claire.lab import agreement, quality

    for module in (quality, agreement):
        source = inspect.getsource(module)
        assert "from django" not in source, module.__name__
        assert "import django" not in source, module.__name__

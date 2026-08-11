"""Sélection des annotations par maturité — le socle du Lab.

Le cas qui motive tout ce module : au 11/08/2026, `fatima.ouali` avait dix annotations
validées à 99,9 % qui dormaient en `draft`. Tous les calculs d'IAA ne retenant que les
statuts soumis, ce travail était **invisible** — et la campagne paraissait reposer sur
une seule paire d'annotateurs alors qu'elle en avait trois.
"""

import pytest

from claire.lab.selectors import (
    MATURITY_LEVELS,
    REASON_EMPTY,
    REASON_MATURITY,
    REASON_MIN_ANNOTATORS,
    REASON_PARTIAL,
    UnknownMaturity,
    annotation_maturity,
    completeness_ratio,
    coverage_by_document,
    satisfies,
    select_annotations,
    summarize_exclusions,
)


def row(document, annotator, status, n_sentences, n_validated=None, n_clauses=None, **extra):
    """Fabrique une ligne candidate. Par défaut : annotation complète et validée."""
    n_clauses = n_sentences if n_clauses is None else n_clauses
    n_validated = n_clauses if n_validated is None else n_validated
    return {
        "document": document,
        "annotator": annotator,
        "status": status,
        "n_sentences": n_sentences,
        "n_clauses": n_clauses,
        "n_validated": n_validated,
        **extra,
    }


# --------------------------------------------------------------------------- #
# annotation_maturity
# --------------------------------------------------------------------------- #

def test_brouillon_entierement_valide_est_complete():
    """Le cas fatima.ouali : Academia, 193 phrases, 192 validées… puis 193."""
    assert annotation_maturity(
        n_sentences=193, n_clauses=193, n_validated=193, status="draft"
    ) == "complete"


def test_brouillon_partiel_reste_any():
    """Le cas Endomondo : 59 phrases annotées sur 498."""
    assert annotation_maturity(
        n_sentences=498, n_clauses=59, n_validated=59, status="draft"
    ) == "any"


def test_annotation_soumise_est_submitted():
    assert annotation_maturity(
        n_sentences=60, n_clauses=60, n_validated=60, status="submitted"
    ) == "submitted"


@pytest.mark.parametrize("status", ["submitted", "in_review", "approved"])
def test_les_trois_statuts_soumis_comptent(status):
    assert annotation_maturity(
        n_sentences=10, n_clauses=10, n_validated=10, status=status
    ) == "submitted"


def test_gold_finalise_prime_sur_tout():
    assert annotation_maturity(
        n_sentences=10, n_clauses=0, n_validated=0, status="draft", has_finalized_gold=True
    ) == "gold"


def test_document_sans_phrase_n_est_jamais_complete():
    """Un document vide déclaré complet entrerait dans le corpus d'entraînement."""
    assert annotation_maturity(
        n_sentences=0, n_clauses=0, n_validated=0, status="draft"
    ) == "any"


def test_clauses_non_validees_ne_font_pas_une_annotation_complete():
    """Le pré-remplissage crée une clause par phrase : le compte de clauses ne prouve
    aucun travail humain, seule la validation explicite compte."""
    assert annotation_maturity(
        n_sentences=128, n_clauses=128, n_validated=0, status="draft"
    ) == "any"


# --------------------------------------------------------------------------- #
# satisfies
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize("level", MATURITY_LEVELS)
def test_any_accepte_tout(level):
    assert satisfies(level, "any") is True


def test_complete_accepte_submitted_et_gold():
    assert satisfies("complete", "complete") is True
    assert satisfies("submitted", "complete") is True
    assert satisfies("gold", "complete") is True
    assert satisfies("any", "complete") is False


def test_submitted_refuse_un_simple_complete():
    """C'est exactement la règle qui rendait invisibles les brouillons achevés."""
    assert satisfies("complete", "submitted") is False
    assert satisfies("submitted", "submitted") is True
    assert satisfies("gold", "submitted") is True


def test_gold_est_le_plus_strict():
    assert satisfies("gold", "gold") is True
    assert satisfies("submitted", "gold") is False


def test_maturite_inconnue_leve():
    with pytest.raises(UnknownMaturity):
        satisfies("complete", "finalisé")


# --------------------------------------------------------------------------- #
# select_annotations — l'invariant central
# --------------------------------------------------------------------------- #

def test_aucune_exclusion_silencieuse():
    """L'INVARIANT : retenus + exclus == candidats, quelles que soient les options.

    Un jeu de données qui perd douze documents sans le dire produit un article faux.
    """
    rows = [
        row("Atlas", "a1", "submitted", 60),
        row("Atlas", "a2", "draft", 60),
        row("Endomondo", "a3", "draft", 498, n_clauses=59, n_validated=59),
        row("Booking", "a1", "draft", 128, n_validated=0),
        row("Vide", "a2", "draft", 10, n_clauses=0, n_validated=0),
    ]
    for maturity in MATURITY_LEVELS:
        kept, excluded = select_annotations(rows, maturity=maturity)
        assert len(kept) + len(excluded) == len(rows), maturity


def test_complete_capte_le_travail_fini_non_soumis():
    """Le gain concret : dix annotations de plus deviennent exploitables."""
    rows = [row("Academia", "zahra", "submitted", 193)] + [
        row(doc, "fatima", "draft", n)
        for doc, n in [
            ("Academia", 193), ("9gag", 139), ("Atlas", 60), ("Google", 93),
            ("Netflix", 86), ("Vivino", 125), ("WhatsApp", 98), ("TrueCaller", 98),
            ("Twitter", 80),
        ]
    ]
    kept_submitted, _ = select_annotations(rows, maturity="submitted")
    kept_complete, _ = select_annotations(rows, maturity="complete")

    assert len(kept_submitted) == 1
    assert len(kept_complete) == 10
    assert {r["annotator"] for r in kept_complete} == {"zahra", "fatima"}


def test_annotation_partielle_exclue_avec_motif_lisible():
    """Endomondo : 59/498. Le motif doit porter les chiffres, pas juste un code."""
    rows = [row("Endomondo", "fatima", "draft", 498, n_clauses=59, n_validated=59)]
    kept, excluded = select_annotations(rows, maturity="any")
    assert kept == []
    assert excluded[0]["reason"] == REASON_PARTIAL
    assert "59/498" in excluded[0]["detail"]


def test_annotation_soumise_mais_partielle_est_ecartee():
    """Le statut dit que l'annotateur a cliqué « soumettre », pas que le document est
    couvert : la complétude se vérifie indépendamment."""
    rows = [row("Partiel", "a1", "submitted", 100, n_clauses=40, n_validated=40)]
    kept, excluded = select_annotations(rows, maturity="submitted")
    assert kept == []
    assert excluded[0]["reason"] == REASON_PARTIAL


def test_exclude_partial_desactivable_pour_l_exploration():
    rows = [row("Endomondo", "fatima", "draft", 498, n_clauses=59, n_validated=59)]
    kept, excluded = select_annotations(
        rows, maturity="any", scope={"exclude_partial": False}
    )
    assert len(kept) == 1
    assert excluded == []


def test_annotation_sans_clause_est_ecartee():
    rows = [row("Booking", "elazhar", "draft", 128, n_clauses=0, n_validated=0)]
    kept, excluded = select_annotations(rows, maturity="any")
    assert kept == []
    assert excluded[0]["reason"] == REASON_EMPTY


def test_maturite_insuffisante_donne_le_motif_below_maturity():
    rows = [row("Amazon", "elazhar", "draft", 132, n_validated=102)]
    kept, excluded = select_annotations(
        rows, maturity="submitted", scope={"exclude_partial": False}
    )
    assert kept == []
    assert excluded[0]["reason"] == REASON_MATURITY
    assert "any" in excluded[0]["detail"]


def test_le_motif_de_maturite_porte_les_chiffres():
    """« maturité any < complete requis » ne suffit pas : il faut pouvoir distinguer
    une annotation à peine commencée d'une annotation finie à un clic près."""
    rows = [
        row("Booking", "elazhar", "draft", 128, n_validated=0),
        row("Academia", "fatima", "draft", 193, n_validated=192),
    ]
    _, excluded = select_annotations(rows, maturity="complete", scope={"exclude_partial": False})
    details = {e["document"]: e["detail"] for e in excluded}
    assert "0/128" in details["Booking"]
    assert "192/193" in details["Academia"]
    assert "99.5 %" in details["Academia"]


# --------------------------------------------------------------------------- #
# Seuil de complétude
# --------------------------------------------------------------------------- #

def test_completeness_ratio_borne_a_un():
    """Des clauses orphelines (héritage) peuvent dépasser le nombre de phrases."""
    assert completeness_ratio(100, 120) == 1.0
    assert completeness_ratio(0, 5) == 0.0
    assert completeness_ratio(200, 100) == 0.5


def test_seuil_strict_par_defaut_ecarte_une_phrase_manquante():
    """Défaut à 1.0 : l'assouplissement doit être demandé, jamais subi."""
    rows = [row("Academia", "fatima", "draft", 193, n_validated=192)]
    kept, _ = select_annotations(rows, maturity="complete")
    assert kept == []


def test_seuil_assoupli_recupere_une_annotation_finie_a_un_clic_pres():
    """Le cas réel : 192/193 validées, c'est un clic oublié, pas un travail inachevé."""
    rows = [row("Academia", "fatima", "draft", 193, n_validated=192)]
    kept, excluded = select_annotations(
        rows, maturity="complete", scope={"completeness_threshold": 0.98}
    )
    assert len(kept) == 1
    assert kept[0]["completeness"] == pytest.approx(192 / 193)
    assert excluded == []


def test_seuil_assoupli_ecarte_quand_meme_le_vraiment_partiel():
    """Endomondo (59/498 = 11,8 %) reste écarté même à 0,98."""
    rows = [row("Endomondo", "fatima", "draft", 498, n_clauses=59, n_validated=59)]
    kept, excluded = select_annotations(
        rows, maturity="complete", scope={"completeness_threshold": 0.98}
    )
    assert kept == []
    assert "59/498" in excluded[0]["detail"]
    assert "11.8 %" in excluded[0]["detail"]


def test_completeness_expose_sur_les_retenus():
    rows = [row("Atlas", "zahra", "submitted", 60)]
    kept, _ = select_annotations(rows, maturity="complete")
    assert kept[0]["completeness"] == 1.0


# --------------------------------------------------------------------------- #
# scope
# --------------------------------------------------------------------------- #

def test_filtre_par_document():
    rows = [row("Atlas", "a1", "submitted", 60), row("9gag", "a1", "submitted", 139)]
    kept, excluded = select_annotations(rows, maturity="any", scope={"documents": ["Atlas"]})
    assert [r["document"] for r in kept] == ["Atlas"]
    assert excluded[0]["reason"] == "not_in_scope"


def test_filtre_par_annotateur():
    rows = [row("Atlas", "a1", "submitted", 60), row("Atlas", "a2", "submitted", 60)]
    kept, _ = select_annotations(rows, maturity="any", scope={"annotators": ["a2"]})
    assert [r["annotator"] for r in kept] == ["a2"]


def test_min_annotators_ecarte_les_documents_mono_annotes():
    """Le seuil porte sur les annotateurs RETENUS, donc il s'évalue après filtrage."""
    rows = [
        row("Atlas", "a1", "submitted", 60),
        row("Atlas", "a2", "submitted", 60),
        row("Microsoft", "a1", "submitted", 548),
    ]
    kept, excluded = select_annotations(rows, maturity="any", scope={"min_annotators": 2})
    assert {r["document"] for r in kept} == {"Atlas"}
    assert excluded[0]["reason"] == REASON_MIN_ANNOTATORS
    assert "1 annotateur(s)" in excluded[0]["detail"]


def test_min_annotators_compte_apres_exclusion_de_maturite():
    """Un document à 2 annotateurs dont un partiel ne compte que pour 1."""
    rows = [
        row("Endomondo", "zahra", "submitted", 498),
        row("Endomondo", "fatima", "draft", 498, n_clauses=59, n_validated=59),
    ]
    kept, _ = select_annotations(rows, maturity="complete", scope={"min_annotators": 2})
    assert kept == []


# --------------------------------------------------------------------------- #
# Utilitaires de rapport
# --------------------------------------------------------------------------- #

def test_summarize_exclusions_compte_par_motif():
    rows = [
        row("Endomondo", "a1", "draft", 498, n_clauses=59, n_validated=59),
        row("Booking", "a2", "draft", 128, n_clauses=0, n_validated=0),
        row("Crowdtangle", "a3", "draft", 78, n_validated=0),
    ]
    _, excluded = select_annotations(rows, maturity="any")
    counts = summarize_exclusions(excluded)
    assert counts[REASON_EMPTY] == 1
    assert counts[REASON_PARTIAL] == 2


def test_coverage_by_document_liste_les_annotateurs():
    rows = [
        row("Atlas", "zahra", "submitted", 60),
        row("Atlas", "elazhar", "submitted", 60),
        row("Atlas", "fatima", "draft", 60),
    ]
    kept, _ = select_annotations(rows, maturity="complete")
    assert coverage_by_document(kept) == {"Atlas": ["elazhar", "fatima", "zahra"]}


# --------------------------------------------------------------------------- #
# Pureté du module
# --------------------------------------------------------------------------- #

def test_le_module_reste_pur():
    """`selectors` ne doit importer NI Django NI les modèles : c'est ce qui le rend
    testable sans base et réutilisable par le runner hors du serveur."""
    import inspect

    from claire.lab import selectors

    source = inspect.getsource(selectors)
    assert "import django" not in source
    assert "from django" not in source
    assert "claire.annotations" not in source

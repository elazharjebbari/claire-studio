"""Tests statistiques appariés (`evaluation/stats.py`) — le socle du cadre défini dans
`docs/pactiva-lab-resultats/03_CADRE_STATISTIQUE.md` (lot L0).

L'invariant transversal : l'unité est le DOCUMENT. Plusieurs tests le vérifient
adversarialement — une implémentation qui rééchantillonnerait des phrases passerait des
cas simples mais échouerait ici.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pactiva_lab.evaluation.metrics import cohen_kappa, micro_f1  # noqa: E402
from pactiva_lab.evaluation.stats import (  # noqa: E402
    PredictionsMismatch,
    align_by_document,
    kappa_pairwise,
    krippendorff_alpha_ci,
    krippendorff_alpha_nominal,
    paired_bootstrap_diff,
    paired_tests_t1,
    permutation_test_paired,
)


def _rows(per_document: dict[str, list[tuple[str, str]]]) -> list[dict]:
    """Construit des lignes de predictions.jsonl : {doc: [(y_true, y_pred), ...]}."""
    out = []
    for document, pairs in per_document.items():
        for index, (truth, pred) in enumerate(pairs):
            out.append({
                "document": document, "index": index,
                "y_true": truth, "y_pred": pred,
            })
    return out


def _uniform(documents: int, sentences: int, *, correct: bool) -> list[dict]:
    return _rows({
        f"doc{d}": [("A", "A" if correct else "B")] * sentences for d in range(documents)
    })


# --------------------------------------------------------------------------- #
# Bootstrap apparié
# --------------------------------------------------------------------------- #

class TestPairedBootstrap:
    def test_runs_identiques_donnent_un_delta_exactement_nul(self):
        a = _uniform(6, 4, correct=True)
        result = paired_bootstrap_diff(a, list(a), n_resamples=200)
        assert result["delta"] == 0.0
        assert result["low"] == 0.0 and result["high"] == 0.0

    def test_avantage_constant_donne_un_ic_entierement_positif(self):
        # A juste partout, B faux partout : chaque tirage de documents donne Δ > 0.
        a = _uniform(8, 5, correct=True)
        b = _uniform(8, 5, correct=False)
        result = paired_bootstrap_diff(a, b, n_resamples=300)
        assert result["delta"] > 0
        assert result["low"] > 0, "l'IC doit exclure 0 quand A domine sur chaque document"

    def test_avantage_ambigu_donne_un_ic_contenant_zero(self):
        # A meilleur sur la moitié des documents, B sur l'autre moitié — symétrique.
        per_doc_a: dict = {}
        per_doc_b: dict = {}
        for d in range(10):
            a_correct = d % 2 == 0
            per_doc_a[f"doc{d}"] = [("A", "A" if a_correct else "B")] * 4
            per_doc_b[f"doc{d}"] = [("A", "B" if a_correct else "A")] * 4
        result = paired_bootstrap_diff(_rows(per_doc_a), _rows(per_doc_b), n_resamples=300)
        assert result["low"] <= 0 <= result["high"]

    def test_deterministe_a_graine_identique_et_sensible_a_la_graine(self):
        # ⭐ Reproductibilité bit-à-bit : une empreinte de run doit rester stable.
        # Taux d'erreur hétérogènes par document (d phrases fausses sur 12) pour que la
        # distribution des Δ rééchantillonnés ait beaucoup de valeurs distinctes — sinon
        # deux graines peuvent retomber par hasard sur les mêmes bornes de percentiles.
        per_doc_a = {
            f"doc{d}": [("A", "B")] * d + [("A", "A")] * (12 - d) for d in range(12)
        }
        per_doc_b = {
            f"doc{d}": [("A", "B")] * (11 - d) + [("A", "A")] * (1 + d) for d in range(12)
        }
        a, b = _rows(per_doc_a), _rows(per_doc_b)
        first = paired_bootstrap_diff(a, b, n_resamples=200, seed=7)
        second = paired_bootstrap_diff(a, b, n_resamples=200, seed=7)
        other = paired_bootstrap_diff(a, b, n_resamples=200, seed=8)
        assert first == second
        assert (first["low"], first["high"]) != (other["low"], other["high"])

    def test_couvertures_differentes_refusees_explicitement(self):
        # ⭐ Jamais un Δ silencieusement faux : phrase en plus côté A → refus.
        a = _uniform(4, 3, correct=True)
        b = _uniform(4, 3, correct=True)[:-1]
        with pytest.raises(PredictionsMismatch, match="couvertures différentes"):
            paired_bootstrap_diff(a, b)

    def test_verites_terrain_divergentes_refusees(self):
        a = _rows({"doc0": [("A", "A"), ("A", "A")]})
        b = _rows({"doc0": [("A", "A"), ("B", "A")]})
        with pytest.raises(PredictionsMismatch, match="vérités terrain"):
            align_by_document(a, b)

    def test_l_unite_est_le_document_pas_la_phrase(self):
        # ⭐ Anti-« bootstrap par phrase » : le même nombre total d'erreurs donne un IC
        # LARGE quand elles sont concentrées dans un seul document (certains tirages
        # l'omettent, d'autres le répètent) et un IC étroit quand elles sont réparties
        # sur tous. Un rééchantillonnage par phrase donnerait deux largeurs semblables.
        n_docs, n_sentences = 10, 10
        base = {f"doc{d}": [("A", "A")] * n_sentences for d in range(n_docs)}
        concentrated = {
            doc: ([("A", "B")] * n_sentences if doc == "doc0" else list(pairs))
            for doc, pairs in base.items()
        }
        spread = {
            doc: [("A", "B")] + [("A", "A")] * (n_sentences - 1) for doc in base
        }
        reference = _rows(base)
        wide = paired_bootstrap_diff(reference, _rows(concentrated), n_resamples=400)
        narrow = paired_bootstrap_diff(reference, _rows(spread), n_resamples=400)
        assert (wide["high"] - wide["low"]) > (narrow["high"] - narrow["low"]) * 2


# --------------------------------------------------------------------------- #
# Permutation appariée
# --------------------------------------------------------------------------- #

class TestPermutation:
    def test_runs_identiques_donnent_p_egal_un(self):
        a = _uniform(6, 4, correct=True)
        result = permutation_test_paired(a, list(a), n_permutations=200)
        assert result["p_value"] == 1.0

    def test_avantage_massif_donne_p_minimal(self):
        a = _uniform(10, 5, correct=True)
        b = _uniform(10, 5, correct=False)
        result = permutation_test_paired(a, b, n_permutations=500)
        # Borne exacte : (1 + nb de permutations retombant sur |Δ| observé) / (n+1).
        # Seules les permutations identité/miroir l'atteignent → p très petit.
        assert result["p_value"] < 0.05

    def test_p_toujours_entre_zero_exclu_et_un(self):
        per_doc_a = {f"doc{d}": [("A", "A" if d % 2 else "B")] * 2 for d in range(6)}
        per_doc_b = {f"doc{d}": [("A", "B" if d % 3 else "A")] * 2 for d in range(6)}
        result = permutation_test_paired(_rows(per_doc_a), _rows(per_doc_b), n_permutations=99)
        assert 0.0 < result["p_value"] <= 1.0

    def test_deterministe_a_graine_identique(self):
        per_doc_a = {f"doc{d}": [("A", "A" if d % 3 else "B")] * 3 for d in range(8)}
        per_doc_b = {f"doc{d}": [("A", "A" if d % 2 else "B")] * 3 for d in range(8)}
        a, b = _rows(per_doc_a), _rows(per_doc_b)
        assert (
            permutation_test_paired(a, b, n_permutations=200, seed=3)
            == permutation_test_paired(a, b, n_permutations=200, seed=3)
        )


# --------------------------------------------------------------------------- #
# Chemin rapide T1
# --------------------------------------------------------------------------- #

class TestPairedTestsT1:
    def _pair(self):
        # Prédictions variées sur 8 documents, plusieurs classes, taux d'erreur mêlés.
        labels = ["A", "B", "C"]
        per_doc_a, per_doc_b = {}, {}
        for d in range(8):
            truths = [labels[(d + i) % 3] for i in range(6)]
            per_doc_a[f"doc{d}"] = [
                (t, t if (d + i) % 4 else labels[(d + i + 1) % 3])
                for i, t in enumerate(truths)
            ]
            per_doc_b[f"doc{d}"] = [
                (t, t if (d + i) % 3 else labels[(d + i + 2) % 3])
                for i, t in enumerate(truths)
            ]
        return _rows(per_doc_a), _rows(per_doc_b)

    @pytest.mark.parametrize("metric_name", ["macro_f1", "micro_f1", "kappa"])
    def test_parite_exacte_avec_le_chemin_generique(self, metric_name):
        # ⭐ Le chemin rapide (matrices de confusion sommées) doit rendre EXACTEMENT le
        # même IC et la même p-value que le chemin générique à graine identique —
        # arrondis compris. C'est ce qui autorise l'endpoint HTTP à l'utiliser.
        from pactiva_lab.evaluation.metrics import macro_f1 as generic_macro
        generic_metric = {
            "macro_f1": generic_macro,
            "micro_f1": micro_f1,
            "kappa": cohen_kappa,
        }[metric_name]
        a, b = self._pair()
        fast = paired_tests_t1(
            a, b, metric=metric_name, n_resamples=150, n_permutations=200, seed=11
        )
        slow_ci = paired_bootstrap_diff(
            a, b, metric=generic_metric, n_resamples=150, seed=11
        )
        slow_p = permutation_test_paired(
            a, b, metric=generic_metric, n_permutations=200, seed=11
        )
        assert fast["delta"] == slow_ci["delta"]
        assert (fast["low"], fast["high"]) == (slow_ci["low"], slow_ci["high"])
        assert fast["p_value"] == slow_p["p_value"]

    def test_metrique_inconnue_refusee(self):
        a, b = self._pair()
        with pytest.raises(ValueError, match="métrique inconnue"):
            paired_tests_t1(a, b, metric="ece")


# --------------------------------------------------------------------------- #
# Accords multi-juges
# --------------------------------------------------------------------------- #

def _judge(rows: list[dict], preds: list[str]) -> list[dict]:
    return [{**row, "y_pred": pred} for row, pred in zip(rows, preds)]


class TestAgreement:
    def test_accord_parfait_donne_kappa_et_alpha_un(self):
        base = _rows({"doc0": [("A", "A"), ("B", "B")], "doc1": [("A", "A"), ("B", "B")]})
        runs = {"j1": base, "j2": [dict(r) for r in base]}
        kappas = kappa_pairwise(runs)
        assert kappas["matrix"]["j1"]["j2"] == 1.0
        assert kappas["vsGold"]["j1"] == 1.0
        assert krippendorff_alpha_nominal(runs) == 1.0

    def test_alpha_valeur_de_reference_calculee_a_la_main(self):
        # ⭐ 2 juges, 4 unités : (A,A), (A,A), (B,B), (A,B).
        # Coïncidences : o(A,A)=4, o(B,B)=2, o(A,B)=o(B,A)=1 ; n_A=5, n_B=3, n=8.
        # α = 1 − (n−1)·D_o / Σ_{c≠k} n_c·n_k = 1 − 7·2/30 = 16/30 ≈ 0,533333.
        truths = ["X", "X", "X", "X"]
        rows = _rows({"doc0": list(zip(truths, ["A", "A", "B", "A"]))})
        runs = {
            "j1": rows,
            "j2": _judge(rows, ["A", "A", "B", "B"]),
        }
        assert krippendorff_alpha_nominal(runs) == round(16 / 30, 6)

    def test_matrice_kappa_symetrique_a_diagonale_un(self):
        base = _rows({"doc0": [("A", "A"), ("B", "A"), ("A", "B"), ("B", "B")]})
        runs = {
            "j1": base,
            "j2": _judge(base, ["A", "B", "B", "B"]),
            "j3": _judge(base, ["B", "A", "A", "A"]),
        }
        kappas = kappa_pairwise(runs)
        for a in runs:
            assert kappas["matrix"][a][a] == 1.0
            for b in runs:
                assert kappas["matrix"][a][b] == kappas["matrix"][b][a]

    def test_alpha_ci_contient_le_point_et_reste_deterministe(self):
        per_doc = {f"doc{d}": [("X", "A" if (d + i) % 3 else "B") for i in range(4)]
                   for d in range(6)}
        base = _rows(per_doc)
        runs = {
            "j1": base,
            "j2": [{**r, "y_pred": "A" if r["index"] % 2 else r["y_pred"]} for r in base],
        }
        ci = krippendorff_alpha_ci(runs, n_resamples=200, seed=5)
        assert ci["low"] <= ci["point"] <= ci["high"]
        assert ci == krippendorff_alpha_ci(runs, n_resamples=200, seed=5)

    def test_couvertures_differentes_refusees(self):
        base = _rows({"doc0": [("A", "A"), ("B", "B")]})
        with pytest.raises(PredictionsMismatch):
            kappa_pairwise({"j1": base, "j2": base[:-1]})

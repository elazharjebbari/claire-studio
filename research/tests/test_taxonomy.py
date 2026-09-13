"""Taxonomies T20/T14/T11/T10 — projection pure, invariants et reproductibilité.

Ces tests protègent trois choses : la COHÉRENCE de la spécification (chaque taxonomie
partitionne exactement les 20 thèmes), les INVARIANTS de projection (déterminisme,
idempotence, secondaire jamais égal au primaire), et l'ISOLEMENT du hold-out.
"""

import json

import pytest

from pactiva_lab import taxonomy as tx


def test_spec_is_versioned_and_fingerprinted():
    spec = tx.load_spec()
    assert spec["specVersion"] >= 1
    assert spec["canonical"] == "T20"
    # L'empreinte est ce qui rend un chiffre publié reproductible.
    assert len(tx.spec_fingerprint()) == 64


@pytest.mark.parametrize("taxonomy_id", ["T20", "T14", "T11", "T10"])
def test_each_taxonomy_partitions_the_canonical_themes(taxonomy_id):
    """⭐ Toute taxonomie couvre les 20 thèmes, sans trou ni doublon : c'est ce qui garantit
    qu'aucune annotation ne peut disparaître ni être comptée deux fois après projection."""
    t20 = set(tx.category_codes("T20"))
    assert len(t20) == 20

    members = [m for c in tx.categories(taxonomy_id) for m in c["members"]]
    assert len(members) == len(set(members)), "un thème appartient à DEUX catégories"
    assert set(members) == t20, "couverture incomplète des thèmes canoniques"


def test_expected_sizes():
    assert [len(tx.category_codes(t)) for t in ("T20", "T14", "T11", "T10")] == [20, 14, 11, 10]


def test_projection_is_deterministic_and_idempotent():
    """Projeter deux fois ne change rien : une catégorie projetée est un point fixe."""
    for code in tx.category_codes("T20"):
        for taxonomy_id in ("T14", "T11", "T10"):
            once = tx.project_theme(code, taxonomy_id)
            assert tx.project_theme(once, taxonomy_id) == once


def test_canonical_projection_is_the_identity():
    for code in tx.category_codes("T20"):
        assert tx.project_theme(code, "T20") == code


def test_unknown_code_passes_through():
    """Une taxonomie ne doit jamais faire DISPARAÎTRE un code qu'elle ne sait pas classer."""
    assert tx.project_theme("THEME_INCONNU", "T11") == "THEME_INCONNU"
    assert tx.project_theme(None, "T11") == ""


def test_theme_set_is_deduplicated_after_merge():
    """⭐ Deux thèmes fusionnés dans la même classe ⇒ la clause devient mono-étiquette.
    C'est voulu : c'est exactement ce que mesure la baisse du taux multi-label."""
    assert tx.project_theme_set(["LICENSE_IP", "USER_CONTENT"], "T11") == ["CONTENT_IP"]
    assert tx.project_theme_set(["LICENSE_IP", "USER_CONTENT"], "T20") == [
        "LICENSE_IP", "USER_CONTENT",
    ]


def test_secondary_never_equals_primary_after_projection():
    """⭐ LE piège de la fusion : un secondaire absorbé par le primaire doit DISPARAÎTRE,
    sinon la cardinalité et α-MASI sont artificiellement gonflés."""
    primary, secondaries = tx.project_primary_and_secondaries(
        "LICENSE_IP", ["USER_CONTENT", "FEES_PAYMENT"], "T11"
    )
    assert primary == "CONTENT_IP"
    assert secondaries == ["FEES_PAYMENT"]
    assert primary not in secondaries


def test_strata_guard_t11_keeps_liability_and_warranty_apart():
    """Le garde-fou scientifique de T11 : les deux clauses exculpatoires restent séparées
    (P(abusif) 0,385 vs 0,039) — c'est ce qui la distingue de T10."""
    assert tx.project_theme("LIMITATION_LIABILITY", "T11") == "LIMITATION_LIABILITY"
    assert tx.project_theme("WARRANTY_DISCLAIMER", "T11") == "WARRANTY_DISCLAIMER"
    assert tx.project_theme("LIMITATION_LIABILITY", "T10") == "RISK_ALLOCATION"
    assert tx.project_theme("WARRANTY_DISCLAIMER", "T10") == "RISK_ALLOCATION"


def test_every_category_is_intelligible():
    """Exigence de lisibilité : toute catégorie a un libellé, une couleur et une description.

    Les descriptions T20 sont reprises TELLES QUELLES du guide annotateur (fidélité au
    protocole) : on n'y impose pas de longueur. En revanche une classe FUSIONNÉE doit
    énumérer ce qu'elle contient — c'est sa seule chance d'être comprise."""
    for taxonomy_id in tx.taxonomy_ids():
        for category in tx.categories(taxonomy_id):
            assert category["label"].strip(), category["code"]
            assert category["description"].strip(), f"{taxonomy_id}:{category['code']}"
            assert category["color"].startswith("#")
            if len(category["members"]) > 1:
                assert len(category["description"]) > 80, (
                    f"description trop courte pour une fusion : {taxonomy_id}:{category['code']}"
                )


def test_merges_are_justified_where_they_are_decided():
    """T14 et T11 sont des schémas de DÉCISION : chaque fusion y porte sa justification
    mesurée. T10 est un test à charge (non destiné à l'adoption) : ses fusions héritées de
    T11 n'ont pas à se re-justifier, seule la fusion litigieuse doit s'expliquer."""
    for taxonomy_id in ("T14", "T11"):
        for category in tx.categories(taxonomy_id):
            if len(category["members"]) > 1:
                assert category.get("rationale"), f"{taxonomy_id}:{category['code']}"
    risk = next(c for c in tx.categories("T10") if c["code"] == "RISK_ALLOCATION")
    assert "REJET" in risk["rationale"].upper()


def test_refuges_are_preserved_through_merges():
    """Un refuge (jamais secondaire) le reste après fusion, sinon la règle multi-label
    du protocole d'annotation serait silencieusement contournée."""
    for taxonomy_id in ("T14", "T11", "T10"):
        refuges = [c for c in tx.categories(taxonomy_id) if c.get("isRefuge")]
        assert refuges, f"{taxonomy_id} n'a plus de refuge"
        covered = {m for c in refuges for m in c["members"]}
        assert {"PREAMBLE_SCOPE", "MISC_BOILERPLATE"} <= covered


# ── Populations : anti-contamination du hold-out ─────────────────────────────
def test_populations_are_disjoint_and_complete():
    """⭐ Les 17 documents de validation n'ont PAS servi à concevoir les mappings."""
    design = tx.population_documents("designSet")
    holdout = tx.population_documents("holdout")
    assert len(design) == 33 and len(holdout) == 17
    assert not (design & holdout), "contamination : un document dans les deux populations"
    assert len(design | holdout) == 50


def test_holdout_membership():
    assert tx.is_holdout("Skype") and tx.is_holdout("eBay")
    assert not tx.is_holdout("9gag") and not tx.is_holdout("Academia")


def test_spec_is_valid_json_without_duplicate_category_codes():
    spec = tx.load_spec()
    for taxonomy in spec["taxonomies"]:
        codes = [c["code"] for c in taxonomy["categories"]]
        assert len(codes) == len(set(codes)), taxonomy["id"]
    # Le fichier reste lisible/diffable (pas de minification accidentelle).
    raw = tx.SPEC_PATH.read_text(encoding="utf-8")
    assert raw.count("\n") > 50
    json.loads(raw)

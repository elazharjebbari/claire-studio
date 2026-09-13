"""Validation des configurations d'expérience — bloc `data` (taxonomie et population).

Le runner laisse PASSER un code de thème inconnu par conception : une taxonomie ne doit
jamais escamoter une donnée qu'elle ne sait pas classer. La contrepartie est que la faute
de frappe doit être attrapée EN AMONT, à la création de l'expérience — sinon un run
« T12 » serait calculé en T20 et étiqueté T12.
"""

import pytest

# ── Bloc `data` : taxonomie et population ───────────────────────────────────
def _base_config(**data):
    config = {
        "version": 1, "task": "T1_primary", "seed": 42,
        "model": {"family": "tfidf_linear"},
        "evaluation": {"split": {"scheme": "group_kfold_document", "k": 5}},
    }
    if data:
        config["data"] = data
    return config


def test_valid_taxonomy_and_population_pass():
    from claire.lab.contracts import validate_config

    validate_config(_base_config(taxonomy="T11", population="holdout"))
    validate_config(_base_config())  # bloc absent : comportement historique


def test_unknown_taxonomy_is_refused():
    """⭐ Une faute de frappe doit coûter une seconde, pas un run silencieusement faux :
    le runner laisse passer un code inconnu par conception (il n'escamote jamais une
    donnée), donc c'est ICI que la faute doit être attrapée."""
    from claire.lab.contracts import ConfigValidationError, validate_config

    with pytest.raises(ConfigValidationError) as exc:
        validate_config(_base_config(taxonomy="T12"))
    assert "/data/taxonomy" in str(exc.value)


def test_unknown_population_is_refused():
    from claire.lab.contracts import ConfigValidationError, validate_config

    with pytest.raises(ConfigValidationError):
        validate_config(_base_config(population="holdOut"))


def test_data_block_must_be_an_object():
    from claire.lab.contracts import ConfigValidationError, validate_config

    config = _base_config()
    config["data"] = "T11"
    with pytest.raises(ConfigValidationError):
        validate_config(config)

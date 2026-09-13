"""Contrats d'échange entre Pactiva et le runner — module PUR.

Deux frontières à garder étanches :

* **config** : validée AVANT la mise en file. Une faute de frappe doit coûter une
  seconde, pas deux heures de GPU suivies d'un échec.
* **results.json** : validé AVANT ingestion. Un résultat mal formé qui entrerait à
  moitié en base finirait dans un tableau de l'article sans que personne ne s'en
  aperçoive — d'où une ingestion tout-ou-rien.

Validation écrite à la main plutôt que via `jsonschema` : le backend n'a pas à gagner
une dépendance pour vérifier une dizaine de clés, et les messages d'erreur portent ici
le chemin exact du champ fautif (ce que l'éditeur de configuration affiche à la ligne).
"""

from __future__ import annotations

import json
from pathlib import Path

TASKS = (
    "T1_primary", "T2_multilabel", "T3_boundary",
    # Tâches des papiers (docs/pactiva-experiences-papiers/02) : mesures d'accord (E1–E4),
    # cascade gold (E5), anomalie de co-occurrence (G2).
    "M1_agreement", "M2_gold_cascade", "G2_cooccurrence",
)
MODEL_FAMILIES = (
    "majority", "position_only", "tfidf_linear", "embeddings_head",
    "transformer_finetune", "sequence_labeling", "llm_judge",
    "measurement", "cooccurrence_anomaly",
)
# Ces tâches n'entraînent aucun modèle : la famille est verrouillée pour que le lanceur
# ne puisse pas produire une config incohérente (une faute coûte une seconde, pas un run).
TASK_FAMILIES = {
    "M1_agreement": "measurement",
    "M2_gold_cascade": "measurement",
    "G2_cooccurrence": "cooccurrence_anomaly",
}
SPLIT_SCHEME = "group_kfold_document"


class ConfigValidationError(ValueError):
    """Configuration invalide — porte le chemin JSON-pointer du champ fautif."""

    def __init__(self, path: str, message: str):
        self.path = path
        super().__init__(f"{path} : {message}")


class ResultValidationError(ValueError):
    """`results.json` non conforme."""


def _require(condition: bool, path: str, message: str) -> None:
    if not condition:
        raise ConfigValidationError(path, message)


def _taxonomy_spec() -> dict:
    """Spécification des taxonomies — SOURCE UNIQUE partagée avec le Lab et l'interface.

    Lue par chemin (et non importée) parce que le backend ne dépend pas du package
    `pactiva_lab` : c'est le même fichier, lu par trois consommateurs."""
    from django.conf import settings

    path = (
        Path(settings.BASE_DIR).parent
        / "frontend" / "src" / "lib" / "taxonomy" / "taxonomies.json"
    )
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _validate_data_block(config: dict) -> None:
    """Valide `data.taxonomy` et `data.population`.

    Sans ce contrôle, une faute de frappe (« T12 », « holdOut ») passerait la création et
    produirait un run silencieusement calculé en T20 sur tout le corpus — le runner, lui,
    laisse passer un code inconnu par conception (il ne doit jamais escamoter une donnée).
    C'est donc ICI que la faute doit être attrapée."""
    data = config.get("data")
    if data is None:
        return
    _require(isinstance(data, dict), "/data", "objet attendu")

    spec = _taxonomy_spec()
    taxonomy = data.get("taxonomy")
    if taxonomy is not None:
        known = [t["id"] for t in spec.get("taxonomies", [])]
        _require(
            not known or taxonomy in known,
            "/data/taxonomy", f"attendu parmi {known}",
        )
    population = data.get("population")
    if population is not None:
        known_populations = sorted(spec.get("populations", {}))
        _require(
            not known_populations or population in known_populations,
            "/data/population", f"attendu parmi {known_populations}",
        )


def validate_config(config: dict) -> dict:
    """Valide une configuration d'expérience et renvoie sa version normalisée."""
    _require(isinstance(config, dict), "/", "objet attendu")
    _require(config.get("version") == 1, "/version", "doit valoir 1")
    _require(config.get("task") in TASKS, "/task", f"attendu parmi {TASKS}")

    model = config.get("model")
    _require(isinstance(model, dict), "/model", "objet attendu")
    family = model.get("family")
    _require(family in MODEL_FAMILIES, "/model/family", f"attendu parmi {MODEL_FAMILIES}")

    if family == "embeddings_head":
        _require(bool(model.get("encoder")), "/model/encoder", "requis pour embeddings_head")
    if family == "transformer_finetune":
        _require(
            bool(model.get("checkpoint")), "/model/checkpoint", "requis pour transformer_finetune"
        )
    if family == "llm_judge":
        _require(bool(model.get("judge")), "/model/judge", "requis pour llm_judge")
    if family == "cooccurrence_anomaly":
        _require(
            model.get("unit", "segment") in ("segment", "sentence"),
            "/model/unit", "attendu parmi ('segment', 'sentence')",
        )
        _require(
            model.get("deontic", "none") in ("none", "rule_based"),
            "/model/deontic", "attendu parmi ('none', 'rule_based')",
        )
        _require(
            model.get("source", "aggregated") in ("aggregated", "votes"),
            "/model/source", "attendu parmi ('aggregated', 'votes')",
        )

    task = config["task"]
    expected_family = TASK_FAMILIES.get(task)
    if expected_family is not None:
        _require(
            family == expected_family,
            "/model/family",
            f"la tâche {task} exige la famille {expected_family}",
        )
    elif family in set(TASK_FAMILIES.values()):
        _require(
            False,
            "/model/family",
            f"la famille {family} est réservée aux tâches {sorted(TASK_FAMILIES)}",
        )

    evaluation = config.get("evaluation") or {}
    _require(isinstance(evaluation, dict), "/evaluation", "objet attendu")
    split = evaluation.get("split") or {}
    scheme = split.get("scheme", SPLIT_SCHEME)
    # Le découpage par phrase n'est pas une option : il ferait fuir des phrases du même
    # contrat entre entraînement et test. Le refus est ici, pas dans une revue de code.
    _require(
        scheme == SPLIT_SCHEME,
        "/evaluation/split/scheme",
        f"seul {SPLIT_SCHEME} est autorisé (un découpage par phrase créerait une fuite)",
    )
    k = int(split.get("k", 5))
    _require(2 <= k <= 10, "/evaluation/split/k", "attendu entre 2 et 10")

    bootstrap = evaluation.get("bootstrap") or {}
    if bootstrap.get("enabled", True):
        unit = bootstrap.get("unit", "document")
        _require(
            unit == "document",
            "/evaluation/bootstrap/unit",
            "rééchantillonner les documents, pas les phrases (non-indépendance intra-document)",
        )

    sweep = config.get("sweep")
    if sweep is not None:
        _require(isinstance(sweep, dict), "/sweep", "objet attendu")
        axes = sweep.get("axes") or {}
        _require(isinstance(axes, dict), "/sweep/axes", "objet attendu")
        for path, values in axes.items():
            _require(isinstance(values, list) and values, f"/sweep/axes/{path}",
                     "liste non vide attendue")

    _validate_data_block(config)

    seed = config.get("seed", 42)
    _require(isinstance(seed, int) and seed >= 0, "/seed", "entier positif attendu")
    return config


def expand_sweep(config: dict) -> list[dict]:
    """Développe un balayage en configurations concrètes.

    Refuse au-delà de `max_runs` avec le décompte : lancer 400 runs par inadvertance est
    un accident coûteux, pas une fonctionnalité.
    """
    import copy
    from itertools import product

    sweep = config.get("sweep")
    if not sweep:
        return [config]

    max_runs = int(sweep.get("max_runs", 60))

    # Bug réel trouvé le 14 août 2026 (Palier 6, expérience "learning-curve") : ce mode
    # n'était géré NULLE PART — ni ici, ni côté runner (`research/pactiva_lab`). Sans
    # `axes`, la branche ci-dessous `if not axes: return [config]` renvoyait
    # SILENCIEUSEMENT la config de base en un seul run, produisant un résultat étiqueté
    # « courbe d'apprentissage » qui n'en était pas une — un seul point, jamais la
    # variation de taille d'entraînement promise. `mode` n'était même pas lu.
    if sweep.get("mode") == "learning_curve":
        sizes = sweep.get("learning_curve_sizes") or []
        _require(
            isinstance(sizes, list) and sizes,
            "/sweep/learning_curve_sizes", "liste non vide attendue",
        )
        repeats = int(sweep.get("repeats", 1))
        combos = [(size, repeat) for size in sizes for repeat in range(repeats)]
        if len(combos) > max_runs:
            raise ConfigValidationError(
                "/sweep",
                f"{len(combos)} runs générés > max_runs={max_runs} : réduire les tailles "
                "ou les répétitions, ou relever explicitement max_runs",
            )
        base_seed = int(config.get("seed", 42))
        out = []
        for size, repeat in combos:
            variant = copy.deepcopy(config)
            variant.pop("sweep", None)
            variant.setdefault("evaluation", {})["learning_curve"] = {
                # Une graine PAR RÉPÉTITION — sans ça, les 5 répétitions au même N
                # piocheraient EXACTEMENT le même sous-échantillon de documents
                # (`Dataset.subsample_documents` est déterministe par graine), ce qui
                # rendrait chaque « répétition » identique aux autres — aucune variance
                # à mesurer, la moitié du point de la courbe perdue.
                "n_documents": size, "seed": base_seed + repeat,
            }
            out.append(variant)
        return out

    axes = sweep.get("axes") or {}
    if not axes:
        return [config]

    paths = list(axes)
    combos = list(product(*(axes[path] for path in paths)))
    if len(combos) > max_runs:
        raise ConfigValidationError(
            "/sweep",
            f"{len(combos)} runs générés > max_runs={max_runs} : réduire les axes "
            "ou relever explicitement max_runs",
        )

    out = []
    for combo in combos:
        variant = copy.deepcopy(config)
        variant.pop("sweep", None)
        for path, value in zip(paths, combo):
            _set_pointer(variant, path, value)
        out.append(variant)
    return out


def _set_pointer(target: dict, pointer: str, value) -> None:
    """Écrit une valeur à un chemin JSON-pointer (`/preprocess/detokenize`)."""
    parts = [p for p in pointer.split("/") if p]
    node = target
    for part in parts[:-1]:
        node = node.setdefault(part, {})
    node[parts[-1]] = value


def validate_results(payload: dict) -> dict:
    """Valide `results.json`. Tout écart fait échouer le run, sans ingestion partielle."""
    if not isinstance(payload, dict):
        raise ResultValidationError("objet attendu à la racine")
    for key in ("task", "metrics", "environment"):
        if key not in payload:
            raise ResultValidationError(f"clé manquante : {key}")
    if payload["task"] not in TASKS:
        raise ResultValidationError(f"tâche inconnue : {payload['task']}")
    metrics = payload["metrics"]
    if not isinstance(metrics, dict) or not metrics:
        raise ResultValidationError("`metrics` doit être un objet non vide")
    for name, value in metrics.items():
        if value is None:
            continue
        if isinstance(value, (int, float)) and not (-1.0 <= float(value) <= 1e9):
            raise ResultValidationError(f"métrique hors bornes : {name}={value}")
    per_fold = payload.get("per_fold")
    if per_fold is not None and not isinstance(per_fold, list):
        raise ResultValidationError("`per_fold` doit être une liste")
    return payload

"""Boucle d'expérience : charger → prétraiter → entraîner par pli → évaluer → écrire.

Trois garanties tenues ici, et vérifiées par les tests :

* **Les plis viennent du dataset**, jamais recalculés — sinon deux modèles évalués sur
  des découpages différents seraient comparés sans que rien ne le signale.
* **Le plafond humain accompagne chaque résultat** — un score sans lui est ininterprétable.
* **L'écriture est incrémentale** : `progress.json` après chaque pli, et un `_SENTINEL`
  final. Sur Grid'5000, un job tué par le *walltime* doit laisser exploitable ce qui a
  déjà été calculé.
"""

from __future__ import annotations

import json
import time
from collections import defaultdict
from pathlib import Path

from .data import Dataset, load_dataset
from .env import capture_environment
from .evaluation.bootstrap import bootstrap_ci, fold_dispersion
from .evaluation.ceiling import human_ceiling
from .evaluation.metrics import (
    cohen_kappa,
    confusion_matrix,
    expected_calibration_error,
    lrap,
    macro_f1,
    micro_f1,
    multilabel_prf,
    per_class_prf,
    reliability_curve,
    top_confusions,
    window_diff,
)
from .models.baselines import build_model
from .preprocess.pipeline import build_text, describe


class Cancelled(RuntimeError):
    """Annulation coopérative demandée par l'orchestrateur."""


def _targets(dataset: Dataset, task: str):
    if task == "T2_multilabel":
        return [set(s.themes) for s in dataset.sentences]
    if task == "T3_boundary":
        return [s.boundary for s in dataset.sentences]
    return [s.primary for s in dataset.sentences]


def _build_texts(dataset: Dataset, preprocess: dict) -> list[str]:
    """Rend le texte d'entrée de chaque phrase, contexte compris.

    Les voisins sont groupés PAR DOCUMENT : une fenêtre de contexte qui déborderait sur
    le contrat suivant serait une fuite silencieuse (testée).
    """
    by_document: dict[str, list] = defaultdict(list)
    for sentence in dataset.sentences:
        by_document[sentence.document].append(sentence)
    for items in by_document.values():
        items.sort(key=lambda s: s.index)
    return [
        build_text(s, neighbours=by_document[s.document], config=preprocess)
        for s in dataset.sentences
    ]


def run_experiment(
    config: dict,
    data_dir: str | Path,
    out_dir: str | Path,
    *,
    progress_path: str | Path | None = None,
    should_cancel=None,
) -> dict:
    task = config["task"]
    # Tâches de mesure et d'anomalie : pas de modèle entraîné par pli — elles ont leur
    # propre boucle mais écrivent le MÊME contrat de sortie (results.json + _SENTINEL).
    # Imports paresseux pour éviter tout cycle (ces modules importent `Cancelled` d'ici).
    if task == "M1_agreement":
        from .measurement import run_agreement

        return run_agreement(config, data_dir, out_dir,
                             progress_path=progress_path, should_cancel=should_cancel)
    if task == "M2_gold_cascade":
        from .measurement import run_gold_cascade

        return run_gold_cascade(config, data_dir, out_dir,
                                progress_path=progress_path, should_cancel=should_cancel)
    if task == "G2_cooccurrence":
        from .cooccurrence import run_cooccurrence

        return run_cooccurrence(config, data_dir, out_dir,
                                progress_path=progress_path, should_cancel=should_cancel)

    started = time.time()
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    dataset = load_dataset(data_dir)
    preprocess = config.get("preprocess") or {}
    texts = _build_texts(dataset, preprocess)
    targets = _targets(dataset, task)
    extra = [
        {"document": s.document, "index": s.index, "doc_position": s.doc_position}
        for s in dataset.sentences
    ]

    n_folds = len(dataset.folds)
    predictions: list[dict] = []
    fold_scores: list[dict] = []

    # Courbe d'apprentissage : restreint l'ENTRAÎNEMENT à N documents par pli, jamais le
    # test (sinon les points de la courbe ne seraient plus comparables entre eux). Le
    # tirage est scopé au pool de train DU PLI COURANT (`pool=fold_train_docs`) — piocher
    # dans l'ensemble du dataset laisserait passer des documents du pli de test courant,
    # une fuite que `fold_indices` existe justement pour empêcher.
    learning_curve = (config.get("evaluation") or {}).get("learning_curve")
    # Bruit d'étiquettes (ablation A6/G5) : corrompt une fraction des étiquettes
    # d'ENTRAÎNEMENT, jamais le test. Revue adversariale du 15 août 2026 : le preset
    # ablation-label-noise balayait `/evaluation/label_noise` que le runner IGNORAIT —
    # les 4 « niveaux de bruit » produisaient des runs identiques, et la courbe de
    # dégradation aurait affiché du plat mesuré. Pire qu'une absence : une fausse figure.
    label_noise = float((config.get("evaluation") or {}).get("label_noise") or 0.0)

    for fold in range(n_folds):
        if should_cancel and should_cancel():
            raise Cancelled(f"annulé au pli {fold + 1}/{n_folds}")

        train_idx, test_idx = dataset.fold_indices(fold)
        if not train_idx or not test_idx:
            continue

        if learning_curve:
            fold_train_docs = sorted({dataset.sentences[i].document for i in train_idx})
            keep_docs = set(
                dataset.subsample_documents(
                    int(learning_curve["n_documents"]),
                    seed=int(learning_curve.get("seed", config.get("seed", 42))),
                    pool=fold_train_docs,
                )
            )
            train_idx = [i for i in train_idx if dataset.sentences[i].document in keep_docs]
            if not train_idx:
                continue

        model = build_model(
            config["model"], judges_index=dataset.judges, seed=int(config.get("seed", 42))
        )
        # T2 et T3 sont ramenés à une cible scalaire pour l'entraînement : les modèles de
        # référence sont mono-label. La reconstruction multi-label se fait à l'évaluation.
        train_targets = [_scalarize(targets[i], task) for i in train_idx]
        if label_noise > 0:
            train_targets = _corrupt_labels(
                train_targets,
                [dataset.sentences[i] for i in train_idx],
                rate=label_noise,
                seed=int(config.get("seed", 42)),
                fold=fold,
            )
        model.fit(
            [texts[i] for i in train_idx], train_targets, [extra[i] for i in train_idx]
        )

        test_texts = [texts[i] for i in test_idx]
        test_extra = [extra[i] for i in test_idx]
        predicted = model.predict(test_texts, test_extra)
        proba_ok = True
        try:
            scores = model.predict_proba(test_texts, test_extra)
        except Exception:  # pragma: no cover - une tête sans proba ne bloque pas le run
            scores = [{label: 1.0} for label in predicted]
            proba_ok = False

        for position, index in enumerate(test_idx):
            sentence = dataset.sentences[index]
            predictions.append(
                {
                    "document": sentence.document,
                    "index": sentence.index,
                    "fold": fold,
                    "y_true": _serialize(targets[index], task),
                    "y_pred": _serialize(_deserialize(predicted[position], task), task),
                    "confidence": round(max(scores[position].values(), default=0.0), 6),
                    "scores": {k: round(v, 6) for k, v in sorted(
                        scores[position].items(), key=lambda kv: -kv[1]
                    )[:5]},
                    "unfair": sentence.unfair,
                    "agreement": sentence.agreement,
                }
            )

        fold_result = _score(
            [targets[i] for i in test_idx],
            [_deserialize(p, task) for p in predicted],
            task,
        )
        if task == "T2_multilabel" and proba_ok:
            # LRAP se calcule ICI, sur les scores COMPLETS de `predict_proba` — les
            # prédictions écrites sur disque ne conservent que le top-5, insuffisant
            # pour un classement. Par pli, donc moyenné (et dispersé) par `_aggregate`
            # comme les autres métriques. C'était la métrique déclarée clé du preset
            # multilabel-finetune… définie dans metrics.py mais jamais appelée
            # (audit du 15 août 2026, docs/pactiva-lab-resultats/01_AUDIT.md §1.2).
            # `proba_ok` : sur le repli `{label: 1.0}` (tête sans probabilité), un LRAP
            # « se calculerait » sur des rangs ex æquo dégénérés (> 1 possible, revue
            # adversariale) — mieux vaut son absence qu'un chiffre faux.
            fold_result["lrap"] = lrap([targets[i] for i in test_idx], scores)
        fold_scores.append(fold_result)
        _write_progress(progress_path, fold + 1, n_folds)
        _write_partial(out_dir, task, fold_scores, started)

    metrics = _aggregate(fold_scores, task)
    metrics.update(_global_scores(predictions, task))

    # IC par rééchantillonnage de DOCUMENTS — jamais de phrases.
    if (config.get("evaluation") or {}).get("bootstrap", {}).get("enabled", True):
        by_document: dict[str, list[dict]] = defaultdict(list)
        for row in predictions:
            by_document[row["document"]].append(row)

        def metric_on(documents: list[str]) -> float:
            rows = [r for d in documents for r in by_document.get(d, [])]
            if not rows:
                return 0.0
            return _score(
                [_deserialize(r["y_true"], task) for r in rows],
                [_deserialize(r["y_pred"], task) for r in rows],
                task,
            )["macro_f1"]

        metrics["macro_f1_ci"] = bootstrap_ci(
            sorted(by_document),
            metric_on,
            n_resamples=int(
                (config.get("evaluation") or {}).get("bootstrap", {}).get("n_resamples", 1000)
            ),
            seed=int(config.get("seed", 42)),
        )

    result = {
        "task": task,
        "config": config,
        "dataset": {
            "fingerprint": dataset.manifest.get("fingerprint"),
            "nDocuments": dataset.manifest.get("nDocuments"),
            "nSentences": len(dataset.sentences),
        },
        "preprocess": describe(preprocess),
        "metrics": metrics,
        "per_fold": fold_scores,
        "per_label": _per_label(predictions, task),
        "environment": capture_environment(started),
    }

    if (config.get("evaluation") or {}).get("human_ceiling", True):
        result["human_ceiling"] = _ceiling(dataset, task)

    if (config.get("evaluation") or {}).get("error_analysis", True):
        result["errors"] = _errors(predictions, task)
        (out_dir / "errors.json").write_text(
            json.dumps(result["errors"], indent=2, ensure_ascii=False), encoding="utf-8"
        )

    (out_dir / "results.json").write_text(
        json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    with (out_dir / "predictions.jsonl").open("w", encoding="utf-8") as handle:
        for row in predictions:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")
    (out_dir / "environment.json").write_text(
        json.dumps(result["environment"], indent=2), encoding="utf-8"
    )
    # Distingue « terminé normalement » de « tué par le walltime ».
    (out_dir / "_SENTINEL").write_text("DONE\n", encoding="utf-8")
    return result


# --------------------------------------------------------------------------- #

def _corrupt_labels(train_targets: list, sentences: list, *, rate: float,
                    seed: int, fold: int) -> list:
    """Remplace `rate` des étiquettes d'ENTRAÎNEMENT par une autre étiquette du pli.

    Déterministe (SHA-256 en compteur, même famille que le bootstrap) : les phrases
    corrompues sont choisies par rang de hachage, et l'étiquette de remplacement est la
    suivante dans l'ordre trié des étiquettes présentes — reproductible d'une machine à
    l'autre, jamais `random`. Le TEST n'est jamais touché : la dégradation mesurée est
    celle du modèle, pas celle de l'évaluation.
    """
    import hashlib

    labels = sorted({t for t in train_targets if t != ""})
    if len(labels) < 2:
        return train_targets
    n_corrupt = round(rate * len(train_targets))
    if n_corrupt <= 0:
        return train_targets
    ranked = sorted(
        range(len(train_targets)),
        key=lambda i: hashlib.sha256(
            f"{seed}:noise:{fold}:{sentences[i].document}:{sentences[i].index}".encode()
        ).hexdigest(),
    )
    to_corrupt = set(ranked[:n_corrupt])
    out = list(train_targets)
    for i in to_corrupt:
        position = labels.index(out[i]) if out[i] in labels else -1
        out[i] = labels[(position + 1) % len(labels)]
    return out


def _scalarize(target, task: str):
    if task == "T2_multilabel":
        return sorted(target)[0] if target else ""
    if task == "T3_boundary":
        return "B" if target else "I"
    return target


def _deserialize(value, task: str):
    if task == "T2_multilabel":
        return {value} if isinstance(value, str) and value else set(value or [])
    if task == "T3_boundary":
        return value in (True, "B")
    return value


def _serialize(value, task: str):
    if task == "T2_multilabel":
        return sorted(value)
    if task == "T3_boundary":
        return bool(value)
    return value


def _score(y_true: list, y_pred: list, task: str) -> dict:
    if task == "T2_multilabel":
        stats = multilabel_prf(y_true, y_pred)
        return {"macro_f1": stats["macro_f1"], "micro_f1": stats["micro_f1"],
                "hamming_loss": stats["hamming_loss"],
                "subset_accuracy": stats["subset_accuracy"]}
    if task == "T3_boundary":
        truth = [bool(v) for v in y_true]
        pred = [bool(v) for v in y_pred]
        tp = sum(1 for a, b in zip(truth, pred) if a and b)
        fp = sum(1 for a, b in zip(truth, pred) if not a and b)
        fn = sum(1 for a, b in zip(truth, pred) if a and not b)
        p = tp / (tp + fp) if tp + fp else 0.0
        r = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * p * r / (p + r) if p + r else 0.0
        return {"macro_f1": round(f1, 6), "micro_f1": round(f1, 6),
                "boundary_precision": round(p, 6), "boundary_recall": round(r, 6),
                "window_diff": window_diff(truth, pred)}
    return {
        "macro_f1": macro_f1(y_true, y_pred),
        "micro_f1": micro_f1(y_true, y_pred),
        "kappa": cohen_kappa(y_true, y_pred),
    }


def _aggregate(fold_scores: list[dict], task: str) -> dict:
    if not fold_scores:
        return {"macro_f1": 0.0, "micro_f1": 0.0}
    keys = sorted({k for row in fold_scores for k in row})
    out = {}
    fold_stats = {}
    for key in keys:
        values = [row[key] for row in fold_scores if key in row]
        out[key] = round(sum(values) / len(values), 6)
        # La dispersion inter-plis compte autant que la moyenne sur un petit corpus :
        # un écart-type élevé signale un modèle instable qu'une moyenne flatteuse cache.
        # `{key}_dispersion` (le seul std) reste tel quel — contrat de schéma additif,
        # jamais de champ renommé ; le détail complet (mean/std/min/max/n) part dans
        # `fold_stats`, dont l'UI a besoin pour afficher la fourchette inter-plis.
        stats = fold_dispersion(values)
        out[f"{key}_dispersion"] = stats["std"]
        fold_stats[key] = stats
    out["fold_stats"] = fold_stats
    return out


def _global_scores(predictions: list[dict], task: str) -> dict:
    if not predictions:
        return {}
    confidences = [row["confidence"] for row in predictions]
    correct = [
        _deserialize(row["y_true"], task) == _deserialize(row["y_pred"], task)
        for row in predictions
    ]
    return {
        "ece": expected_calibration_error(confidences, correct),
        # La courbe elle-même, pas seulement le score agrégé : un ECE unique cache
        # SI le modèle est trop sûr de lui, pas assez, ou juste sur une tranche de
        # confiance — c'est la courbe qui répond, et F10 en a besoin pour exister.
        "reliability_curve": reliability_curve(confidences, correct),
    }


def _per_label(predictions: list[dict], task: str) -> list[dict]:
    if task != "T1_primary":
        return []
    stats = per_class_prf(
        [row["y_true"] for row in predictions], [row["y_pred"] for row in predictions]
    )
    # Trié par support décroissant : c'est l'ordre qui rend visible l'effondrement sur
    # la longue traîne, et donc l'écart micro/macro.
    return [
        {"label": label, **values}
        for label, values in sorted(stats.items(), key=lambda kv: -kv[1]["support"])
    ]


def _ceiling(dataset: Dataset, task: str) -> dict:
    """Plafond humain : nécessite des phrases couvertes par plusieurs annotateurs.

    Le dataset agrégé ne conserve pas les votes individuels ; on utilise donc le nombre
    d'annotateurs et la classe d'accord comme approximation, en le DISANT franchement.
    """
    multi = [s for s in dataset.sentences if s.n_annotators >= 2]
    if not multi:
        return {
            "value": None, "task": task, "pairs": 0,
            "warning": "insufficient_annotators",
            "note": "aucune phrase multi-annotée dans ce dataset",
        }
    strict = sum(1 for s in multi if s.agreement == "strict")

    # IC bootstrap PAR DOCUMENT sur le plafond lui-même : le plafond devient une BANDE
    # de référence, pas une ligne faussement certaine — il est estimé sur le même petit
    # effectif que les modèles, son incertitude doit se voir au même titre
    # (docs/pactiva-lab-resultats/03_CADRE_STATISTIQUE.md §d).
    by_document: dict[str, list] = defaultdict(list)
    for sentence in multi:
        by_document[sentence.document].append(sentence)

    def strict_rate_on(documents: list[str]) -> float:
        rows = [s for d in documents for s in by_document.get(d, [])]
        if not rows:
            return 0.0
        return sum(1 for s in rows if s.agreement == "strict") / len(rows)

    return {
        # Proportion d'accord strict = borne haute observable sur le matériau agrégé.
        "value": round(strict / len(multi), 6),
        "metric": "strict_agreement_rate",
        "task": task,
        "pairs": len(multi),
        "ci": bootstrap_ci(sorted(by_document), strict_rate_on),
        "note": (
            "Approximation calculée sur le dataset AGRÉGÉ (taux d'accord strict). "
            "Le plafond exact demande les votes individuels : construire un dataset "
            "avec aggregation='soft' pour l'obtenir."
        ),
    }


def _errors(predictions: list[dict], task: str) -> dict:
    """Analyse d'erreurs — la section qui distingue un article sérieux d'un tableau."""
    wrong = [
        row for row in predictions
        if _deserialize(row["y_true"], task) != _deserialize(row["y_pred"], task)
    ]
    unfair_total = sum(1 for row in predictions if row["unfair"])
    unfair_wrong = sum(1 for row in wrong if row["unfair"])
    by_agreement: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for row in predictions:
        bucket = by_agreement[row["agreement"] or "unknown"]
        bucket[0] += 1
        bucket[1] += _deserialize(row["y_true"], task) != _deserialize(row["y_pred"], task)

    out = {
        "nErrors": len(wrong),
        "errorRate": round(len(wrong) / len(predictions), 6) if predictions else 0.0,
        # Le modèle est-il moins bon sur les clauses abusives ? Ce serait un problème
        # pratique majeur, et un résultat.
        "unfairErrorRate": round(unfair_wrong / unfair_total, 6) if unfair_total else None,
        "unfairSentences": unfair_total,
        # Là où les humains divergeaient, le modèle échoue-t-il aussi ? C'est la mesure
        # de l'ambiguïté irréductible, au lieu de la postuler.
        "byAgreementClass": {
            key: {"n": n, "errors": e, "rate": round(e / n, 6) if n else None}
            for key, (n, e) in sorted(by_agreement.items())
        },
        "lowestConfidenceErrors": sorted(wrong, key=lambda r: r["confidence"])[:20],
    }
    if task == "T1_primary":
        out["topConfusions"] = top_confusions(
            [row["y_true"] for row in predictions], [row["y_pred"] for row in predictions]
        )
        out["confusionMatrix"] = confusion_matrix(
            [row["y_true"] for row in predictions], [row["y_pred"] for row in predictions]
        )
    return out


def _write_progress(path, done: int, total: int) -> None:
    if not path:
        return
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(
        json.dumps({"fold": done, "folds": total, "percent": round(100 * done / total)}),
        encoding="utf-8",
    )


def _write_partial(out_dir: Path, task: str, fold_scores: list[dict], started: float) -> None:
    """Résultat partiel après chaque pli.

    Sur Grid'5000, le *walltime* est un couperet : sans écriture incrémentale, un job tué
    à 90 % ne laisse rien. Avec, l'orchestrateur ingère en `partial` ce qui est acquis.
    """
    (out_dir / "results.partial.json").write_text(
        json.dumps(
            {
                "task": task,
                "metrics": _aggregate(fold_scores, task),
                "per_fold": fold_scores,
                "environment": capture_environment(started),
                "partial": True,
            },
            indent=2, ensure_ascii=False,
        ),
        encoding="utf-8",
    )

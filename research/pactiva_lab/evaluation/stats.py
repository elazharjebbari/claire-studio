"""Tests statistiques appariés — au niveau DOCUMENT, comme tout le module.

Trois outils, choisis dans `docs/pactiva-lab-resultats/03_CADRE_STATISTIQUE.md` pour
être défendables devant un relecteur JURIX sans fragilité paramétrique :

* **bootstrap apparié par document** sur la différence de métrique entre deux runs —
  l'IC du Δ qui exclut 0 est LA preuve confirmatoire ;
* **test de permutation apparié par document** — p-value exacte, même unité, même code ;
* **accords multi-juges** (κ de Cohen par paire, α de Krippendorff nominal) pour la
  baseline des juges LLM, avec IC bootstrap par document.

Écartés sciemment (et pourquoi, pour l'UI et l'article) :
* t-test sur 5 plis : n = 5 et les ensembles d'entraînement se recouvrent — la variance
  est sous-estimée (Bengio & Grandvalet, 2004) ;
* McNemar par phrase : les ~195 phrases d'un document ne sont pas indépendantes —
  anticonservateur.

Tout est déterministe à graine donnée (générateur SHA-256 en compteur, comme
`bootstrap.py`) et sans dépendance hors bibliothèque standard.
"""

from __future__ import annotations

import hashlib
from collections import Counter, defaultdict
from collections.abc import Callable

from .metrics import cohen_kappa, macro_f1


class PredictionsMismatch(ValueError):
    """Les deux runs ne couvrent pas exactement les mêmes phrases.

    Calculer un Δ sur des couvertures différentes donnerait un chiffre silencieusement
    faux — on refuse explicitement plutôt que d'approximer.
    """


Metric = Callable[[list, list], float]


def _rng_ints(seed: int, tag: str, size: int, draws: int):
    """Tirages d'entiers [0, size) reproductibles — même famille que `bootstrap._rng_stream`,
    avec un `tag` pour que deux usages distincts (bootstrap vs permutation) ne partagent
    jamais la même suite."""
    counter = 0
    for _ in range(draws):
        row: list[int] = []
        while len(row) < size:
            digest = hashlib.sha256(f"{seed}:{tag}:{counter}".encode()).digest()
            counter += 1
            for i in range(0, len(digest), 4):
                if len(row) >= size:
                    break
                row.append(int.from_bytes(digest[i : i + 4], "big") % size)
        yield row


def _rng_bits(seed: int, tag: str, size: int, draws: int):
    """Suites de bits reproductibles (un par document) pour les échanges de permutation."""
    counter = 0
    for _ in range(draws):
        bits: list[bool] = []
        while len(bits) < size:
            digest = hashlib.sha256(f"{seed}:{tag}:{counter}".encode()).digest()
            counter += 1
            for byte in digest:
                for shift in range(8):
                    if len(bits) >= size:
                        break
                    bits.append(bool((byte >> shift) & 1))
        yield bits


def align_by_document(rows_a: list[dict], rows_b: list[dict]) -> dict[str, list[tuple]]:
    """Apparie deux jeux de prédictions sur la clé `(document, index)`.

    Renvoie `{document: [(y_true, y_pred_a, y_pred_b), ...]}`. Lève
    `PredictionsMismatch` si les couvertures diffèrent (documents ou phrases), ou si
    les vérités terrain ne coïncident pas — trois symptômes d'une comparaison invalide
    (datasets différents, plis différents, tâche différente).
    """
    index_a = {(r["document"], r["index"]): r for r in rows_a}
    index_b = {(r["document"], r["index"]): r for r in rows_b}
    if index_a.keys() != index_b.keys():
        only_a = len(index_a.keys() - index_b.keys())
        only_b = len(index_b.keys() - index_a.keys())
        raise PredictionsMismatch(
            f"couvertures différentes : {only_a} phrase(s) propres au run A, "
            f"{only_b} au run B — mêmes dataset et plis requis"
        )
    aligned: dict[str, list[tuple]] = defaultdict(list)
    for key in index_a:
        a, b = index_a[key], index_b[key]
        if a["y_true"] != b["y_true"]:
            raise PredictionsMismatch(
                f"vérités terrain divergentes sur {key} — les runs ne partagent pas le "
                "même dataset"
            )
        aligned[a["document"]].append((a["y_true"], a["y_pred"], b["y_pred"]))
    return dict(aligned)


def _delta_on(documents: list[str], aligned: dict[str, list[tuple]], metric: Metric) -> float:
    y_true: list = []
    pred_a: list = []
    pred_b: list = []
    for document in documents:
        for truth, a, b in aligned[document]:
            y_true.append(truth)
            pred_a.append(a)
            pred_b.append(b)
    if not y_true:
        return 0.0
    return metric(y_true, pred_a) - metric(y_true, pred_b)


def paired_bootstrap_diff(
    rows_a: list[dict],
    rows_b: list[dict],
    *,
    metric: Metric = macro_f1,
    n_resamples: int = 1000,
    confidence: float = 0.95,
    seed: int = 42,
) -> dict:
    """IC du Δ métrique(A) − métrique(B) par rééchantillonnage de DOCUMENTS.

    L'IC qui exclut 0 est la preuve confirmatoire ; l'IC qui contient 0 se lit
    « aucune différence démontrée à cet effectif » — jamais « équivalents ».
    """
    aligned = align_by_document(rows_a, rows_b)
    documents = sorted(aligned)
    point = _delta_on(documents, aligned, metric)
    if len(documents) < 2:
        return {
            "delta": round(point, 6), "low": None, "high": None,
            "n_documents": len(documents), "n_resamples": 0,
            "unit": "document", "warning": "insufficient_groups",
        }

    values = []
    for draw in _rng_ints(seed, "paired-bootstrap", len(documents), n_resamples):
        sample = [documents[i] for i in draw]
        values.append(_delta_on(sample, aligned, metric))
    values.sort()
    alpha = (1.0 - confidence) / 2.0
    low = values[max(0, int(alpha * len(values)))]
    high = values[min(len(values) - 1, int((1 - alpha) * len(values)))]
    return {
        "delta": round(point, 6),
        "low": round(low, 6),
        "high": round(high, 6),
        "n_documents": len(documents),
        "n_resamples": len(values),
        "confidence": confidence,
        "unit": "document",
    }


def permutation_test_paired(
    rows_a: list[dict],
    rows_b: list[dict],
    *,
    metric: Metric = macro_f1,
    n_permutations: int = 10000,
    seed: int = 42,
) -> dict:
    """p-value bilatérale par permutation appariée : on échange A↔B document par
    document. Sous l'hypothèse nulle (A et B interchangeables), le |Δ| observé n'a
    rien de spécial parmi les |Δ| permutés.

    Le `+1` au numérateur et au dénominateur est la correction standard : une p-value
    de permutation n'est jamais exactement 0 (l'identité fait partie des permutations).
    """
    aligned = align_by_document(rows_a, rows_b)
    documents = sorted(aligned)
    observed = _delta_on(documents, aligned, metric)
    if len(documents) < 2:
        return {
            "p_value": None, "observed_delta": round(observed, 6),
            "n_documents": len(documents), "n_permutations": 0,
            "warning": "insufficient_groups",
        }

    at_least_as_extreme = 0
    for bits in _rng_bits(seed, "paired-permutation", len(documents), n_permutations):
        swapped = {
            document: (
                [(t, b, a) for t, a, b in aligned[document]] if bits[i] else aligned[document]
            )
            for i, document in enumerate(documents)
        }
        if abs(_delta_on(documents, swapped, metric)) >= abs(observed) - 1e-12:
            at_least_as_extreme += 1
    return {
        "p_value": round((at_least_as_extreme + 1) / (n_permutations + 1), 6),
        "observed_delta": round(observed, 6),
        "n_documents": len(documents),
        "n_permutations": n_permutations,
        "unit": "document",
    }


# --------------------------------------------------------------------------- #
# Chemin rapide T1 — mêmes résultats, coût par tirage en O(documents × étiquettes)
# --------------------------------------------------------------------------- #

def _confusion_by_document(aligned: dict[str, list[tuple]]) -> dict[str, tuple[Counter, Counter]]:
    """Matrices de confusion par document et par run : `Counter[(y_true, y_pred)]`.

    Le point de l'optimisation : macro-F1, micro-F1 et κ se recalculent depuis la SOMME
    de ces compteurs — un tirage bootstrap devient une addition de 39 compteurs au lieu
    d'un passage sur ~7 600 phrases. Sans ce chemin, un endpoint HTTP qui enchaîne
    1 000 tirages + 10 000 permutations mettrait plusieurs minutes à répondre."""
    out: dict[str, tuple[Counter, Counter]] = {}
    for document, rows in aligned.items():
        counter_a: Counter = Counter()
        counter_b: Counter = Counter()
        for truth, a, b in rows:
            counter_a[(truth, a)] += 1
            counter_b[(truth, b)] += 1
        out[document] = (counter_a, counter_b)
    return out


def _macro_f1_from_confusion(confusion: Counter) -> float:
    """Reproduction EXACTE de `metrics.macro_f1` (arrondis compris) depuis une matrice
    de confusion — la parité bit-à-bit avec le chemin générique est testée."""
    labels = {t for t, _ in confusion} | {p for _, p in confusion}
    if not labels:
        return 0.0
    truth_totals: Counter = Counter()
    pred_totals: Counter = Counter()
    for (t, p), count in confusion.items():
        truth_totals[t] += count
        pred_totals[p] += count
    f1_sum = 0.0
    for label in labels:
        tp = confusion.get((label, label), 0)
        fp = pred_totals[label] - tp
        fn = truth_totals[label] - tp
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        f1_sum += round(f1, 6)
    return round(f1_sum / len(labels), 6)


def _micro_f1_from_confusion(confusion: Counter) -> float:
    total = sum(confusion.values())
    if not total:
        return 0.0
    diagonal = sum(count for (t, p), count in confusion.items() if t == p)
    return round(diagonal / total, 6)


def _kappa_from_confusion(confusion: Counter) -> float:
    total = sum(confusion.values())
    if not total:
        return 0.0
    po = sum(count for (t, p), count in confusion.items() if t == p) / total
    truth_totals: Counter = Counter()
    pred_totals: Counter = Counter()
    for (t, p), count in confusion.items():
        truth_totals[t] += count
        pred_totals[p] += count
    pe = sum(
        (truth_totals[c] / total) * (pred_totals[c] / total)
        for c in set(truth_totals) | set(pred_totals)
    )
    if pe >= 1.0:
        return 1.0 if po >= 1.0 else 0.0
    return round((po - pe) / (1 - pe), 6)


_CONFUSION_METRICS = {
    "macro_f1": _macro_f1_from_confusion,
    "micro_f1": _micro_f1_from_confusion,
    "kappa": _kappa_from_confusion,
}


def paired_tests_t1(
    rows_a: list[dict],
    rows_b: list[dict],
    *,
    metric: str = "macro_f1",
    n_resamples: int = 1000,
    n_permutations: int = 10000,
    confidence: float = 0.95,
    seed: int = 42,
) -> dict:
    """Bootstrap apparié ET permutation en un seul passage — tâche T1 uniquement.

    Résultats identiques à `paired_bootstrap_diff` + `permutation_test_paired` avec la
    même graine (mêmes suites pseudo-aléatoires, mêmes arrondis — parité testée), en
    temps compatible avec un endpoint HTTP synchrone.
    """
    if metric not in _CONFUSION_METRICS:
        raise ValueError(f"métrique inconnue pour le chemin T1 : {metric}")
    metric_fn = _CONFUSION_METRICS[metric]
    aligned = align_by_document(rows_a, rows_b)
    documents = sorted(aligned)
    confusions = _confusion_by_document(aligned)

    def delta_of(selection: list[str], swap_bits: list[bool] | None = None) -> float:
        total_a: Counter = Counter()
        total_b: Counter = Counter()
        for i, document in enumerate(selection):
            counter_a, counter_b = confusions[document]
            if swap_bits is not None and swap_bits[i]:
                counter_a, counter_b = counter_b, counter_a
            total_a.update(counter_a)
            total_b.update(counter_b)
        return metric_fn(total_a) - metric_fn(total_b)

    observed = delta_of(documents)
    base = {
        "metric": metric,
        "delta": round(observed, 6),
        "n_documents": len(documents),
        "unit": "document",
        "confidence": confidence,
    }
    if len(documents) < 2:
        return {
            **base, "low": None, "high": None, "p_value": None,
            "n_resamples": 0, "n_permutations": 0, "warning": "insufficient_groups",
        }

    values = []
    for draw in _rng_ints(seed, "paired-bootstrap", len(documents), n_resamples):
        values.append(delta_of([documents[i] for i in draw]))
    values.sort()
    alpha = (1.0 - confidence) / 2.0
    low = values[max(0, int(alpha * len(values)))]
    high = values[min(len(values) - 1, int((1 - alpha) * len(values)))]

    at_least_as_extreme = 0
    for bits in _rng_bits(seed, "paired-permutation", len(documents), n_permutations):
        if abs(delta_of(documents, bits)) >= abs(observed) - 1e-12:
            at_least_as_extreme += 1

    return {
        **base,
        "low": round(low, 6),
        "high": round(high, 6),
        "n_resamples": len(values),
        "p_value": round((at_least_as_extreme + 1) / (n_permutations + 1), 6),
        "n_permutations": n_permutations,
    }


# --------------------------------------------------------------------------- #
# Accords multi-juges (baseline des juges LLM)
# --------------------------------------------------------------------------- #

def _align_many(runs: dict[str, list[dict]]) -> tuple[list[tuple], list[str], dict[str, list]]:
    """Aligne N jeux de prédictions sur les clés communes à tous.

    Renvoie `(keys, names, {name: y_pred alignés})` — la vérité terrain alignée est
    accessible via le premier run (elles coïncident, vérifié)."""
    names = sorted(runs)
    if len(names) < 2:
        raise PredictionsMismatch("au moins deux jeux de prédictions requis")
    indexed = {
        name: {(r["document"], r["index"]): r for r in rows} for name, rows in runs.items()
    }
    keys = set(indexed[names[0]])
    for name in names[1:]:
        if set(indexed[name]) != keys:
            raise PredictionsMismatch(
                f"couvertures différentes entre « {names[0]} » et « {name} » — mêmes "
                "dataset et plis requis"
            )
    ordered = sorted(keys)
    for key in ordered:
        truths = {name: indexed[name][key]["y_true"] for name in names}
        if len(set(truths.values())) > 1:
            raise PredictionsMismatch(f"vérités terrain divergentes sur {key}")
    return (
        ordered,
        names,
        {name: [indexed[name][key]["y_pred"] for key in ordered] for name in names},
    )


def kappa_pairwise(runs: dict[str, list[dict]]) -> dict:
    """Matrice symétrique de κ de Cohen entre chaque paire de juges, plus le κ de
    chaque juge contre le gold (`y_true`). Diagonale à 1 par construction."""
    keys, names, preds = _align_many(runs)
    first = names[0]
    indexed_first = {(r["document"], r["index"]): r["y_true"] for r in runs[first]}
    y_true = [indexed_first[key] for key in keys]

    matrix = {
        a: {
            b: 1.0 if a == b else cohen_kappa(preds[a], preds[b]) for b in names
        }
        for a in names
    }
    versus_gold = {name: cohen_kappa(y_true, preds[name]) for name in names}
    return {"judges": names, "matrix": matrix, "vsGold": versus_gold, "n": len(keys)}


def krippendorff_alpha_nominal(runs: dict[str, list[dict]]) -> float:
    """α de Krippendorff, données nominales — la statistique d'accord du papier
    ressource (α-MASI en est la variante multi-label), via la matrice de coïncidences."""
    keys, names, preds = _align_many(runs)
    coincidence: Counter = Counter()
    totals: Counter = Counter()
    n = 0.0
    for i in range(len(keys)):
        ratings = [preds[name][i] for name in names]
        m = len(ratings)
        if m < 2:
            continue
        weight = 1.0 / (m - 1)
        for a in range(m):
            for b in range(m):
                if a == b:
                    continue
                coincidence[(ratings[a], ratings[b])] += weight
                totals[ratings[a]] += weight
                n += weight
    if n <= 1:
        return 0.0
    observed_disagreement = sum(
        value for (a, b), value in coincidence.items() if a != b
    )
    expected_pairs = sum(
        totals[a] * totals[b] for a in totals for b in totals if a != b
    )
    if expected_pairs == 0:
        return 1.0
    return round(1.0 - (n - 1) * observed_disagreement / expected_pairs, 6)


def krippendorff_alpha_ci(
    runs: dict[str, list[dict]],
    *,
    n_resamples: int = 1000,
    confidence: float = 0.95,
    seed: int = 42,
) -> dict:
    """IC bootstrap PAR DOCUMENT de l'α — pas d'erreur-type analytique fragile."""
    point = krippendorff_alpha_nominal(runs)
    by_document: dict[str, dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))
    for name, rows in runs.items():
        for row in rows:
            by_document[row["document"]][name].append(row)
    documents = sorted(by_document)
    if len(documents) < 2:
        return {"point": point, "low": None, "high": None, "nResamples": 0,
                "unit": "document", "warning": "insufficient_groups"}

    values = []
    for draw in _rng_ints(seed, "alpha-bootstrap", len(documents), n_resamples):
        sample_runs: dict[str, list[dict]] = defaultdict(list)
        for copy, i in enumerate(draw):
            document = documents[i]
            for name, rows in by_document[document].items():
                for row in rows:
                    # Chaque tirage du même document devient une « unité » distincte :
                    # sans ce suffixe, deux copies s'écraseraient dans l'alignement.
                    sample_runs[name].append({**row, "document": f"{document}#{copy}"})
        values.append(krippendorff_alpha_nominal(dict(sample_runs)))
    values.sort()
    alpha = (1.0 - confidence) / 2.0
    return {
        "point": point,
        "low": round(values[max(0, int(alpha * len(values)))], 6),
        "high": round(values[min(len(values) - 1, int((1 - alpha) * len(values)))], 6),
        "nResamples": len(values),
        "confidence": confidence,
        "unit": "document",
    }

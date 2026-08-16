"""Mesures d'accord sur ENSEMBLES d'étiquettes — la matière d'E1/E2/E3 du papier de mesure.

Port PUR de `backend/claire/projects/masi.py` (parité testée en golden), étendu de ce que
la plateforme n'a pas : l'IC bootstrap PAR DOCUMENT de l'α (les phrases d'un ToS ne sont
pas indépendantes — règle du cadre statistique, `docs/pactiva-lab-resultats/03`), le test
apparié de la différence α_nominal − α_MASI (E1), et Gwet AC1 (garde-fou de prévalence sur
les thèmes rares, où κ n'est pas interprétable seul — `META` κ 0,42 sur support 9).

Conventions du module : déterminisme par flux SHA-256 étiquetés (jamais `random`), unités
= séquences d'ensembles (un ensemble de thèmes par juge), None quand l'accord n'est pas
calculable (jamais un 0 silencieux).
"""

from __future__ import annotations

import hashlib
from collections import Counter
from itertools import combinations
from typing import Callable, Iterable, Sequence

SetDistance = Callable[[frozenset, frozenset], float]


def masi_distance(a: frozenset, b: frozenset) -> float:
    """Distance MASI ∈ [0, 1] (Passonneau 2006) : 1 − M·Jaccard, M ∈ {1, 2/3, 1/3, 0}."""
    if not a and not b:
        return 0.0
    union = len(a | b)
    if union == 0:
        return 0.0
    inter = len(a & b)
    jaccard = inter / union
    if a == b:
        m = 1.0
    elif a <= b or b <= a:
        m = 2.0 / 3.0
    elif inter > 0:
        m = 1.0 / 3.0
    else:
        m = 0.0
    return 1.0 - m * jaccard


def nominal_set_distance(a: frozenset, b: frozenset) -> float:
    """Distance nominale 0/1 sur ensembles (contrôle mono-label : α_MASI = α nominal)."""
    return 0.0 if a == b else 1.0


def krippendorff_alpha_set(
    units: Iterable[Sequence[frozenset]],
    distance: SetDistance = masi_distance,
) -> float | None:
    """α de Krippendorff (forme par paires) pour une distance d'ensembles.

    Même arithmétique que `projects/masi.py::krippendorff_alpha` (regroupement EXACT des
    jugements identiques, O(U²) sur les ensembles distincts) — la parité est un test.
    """
    items = [list(u) for u in units if len(u) >= 2]
    if not items:
        return None

    obs_sum = 0.0
    obs_pairs = 0
    for unit in items:
        for x, y in combinations(unit, 2):
            obs_sum += distance(x, y)
            obs_pairs += 1
    if obs_pairs == 0:
        return None
    d_observed = obs_sum / obs_pairs

    frequencies = Counter(x for unit in items for x in unit)
    unique = list(frequencies.items())
    n_total = sum(frequencies.values())
    exp_pairs = n_total * (n_total - 1) // 2
    if exp_pairs == 0:
        return None
    exp_sum = 0.0
    for i in range(len(unique)):
        set_i, count_i = unique[i]
        for set_j, count_j in unique[i + 1:]:
            exp_sum += count_i * count_j * distance(set_i, set_j)
    d_expected = exp_sum / exp_pairs

    if d_expected == 0:
        return 1.0
    return 1.0 - d_observed / d_expected


# --------------------------------------------------------------------------- #
# IC bootstrap par document + test apparié E1 (α nominal − α MASI)
# --------------------------------------------------------------------------- #

def _rng_ints(seed: int, tag: str, size: int, draws: int):
    """Même famille de flux que `stats._rng_ints` — étiquetée pour ne jamais partager
    une suite entre deux usages."""
    counter = 0
    for _ in range(draws):
        row: list[int] = []
        while len(row) < size:
            digest = hashlib.sha256(f"{seed}:{tag}:{counter}".encode()).digest()
            counter += 1
            for i in range(0, len(digest), 4):
                if len(row) >= size:
                    break
                row.append(int.from_bytes(digest[i: i + 4], "big") % size)
        yield row


class _AlphaPool:
    """Pré-calculs par document pour rejouer l'α sur des rééchantillons de documents.

    Par document : (somme des distances intra-unités, nb de paires intra-unités,
    Counter des jugements). L'attendu se recalcule à chaque tirage sur les ensembles
    distincts du rééchantillon, via une matrice de distances mémoïsée UNE fois — le
    coût par tirage est en O(U²) lookups, pas en O(N²) distances.
    """

    def __init__(self, units_by_doc: dict[str, list[Sequence[frozenset]]],
                 distance: SetDistance):
        self.documents = sorted(units_by_doc)
        self.obs: dict[str, tuple[float, int]] = {}
        self.freq: dict[str, Counter] = {}
        vocabulary: set[frozenset] = set()
        for document, units in units_by_doc.items():
            items = [list(u) for u in units if len(u) >= 2]
            obs_sum, obs_pairs = 0.0, 0
            frequencies: Counter = Counter()
            for unit in items:
                for x, y in combinations(unit, 2):
                    obs_sum += distance(x, y)
                    obs_pairs += 1
                frequencies.update(unit)
            self.obs[document] = (obs_sum, obs_pairs)
            self.freq[document] = frequencies
            vocabulary.update(frequencies)
        self.sets = sorted(vocabulary, key=lambda s: sorted(s))
        self.index = {s: i for i, s in enumerate(self.sets)}
        size = len(self.sets)
        self.dist = [[0.0] * size for _ in range(size)]
        for i in range(size):
            for j in range(i + 1, size):
                d = distance(self.sets[i], self.sets[j])
                self.dist[i][j] = d
                self.dist[j][i] = d

    def alpha(self, documents: list[str]) -> float | None:
        obs_sum = 0.0
        obs_pairs = 0
        frequencies: Counter = Counter()
        for document in documents:
            s, p = self.obs[document]
            obs_sum += s
            obs_pairs += p
            frequencies.update(self.freq[document])
        if obs_pairs == 0:
            return None
        d_observed = obs_sum / obs_pairs
        counts = [(self.index[s], c) for s, c in frequencies.items()]
        n_total = sum(c for _, c in counts)
        exp_pairs = n_total * (n_total - 1) // 2
        if exp_pairs == 0:
            return None
        exp_sum = 0.0
        for a in range(len(counts)):
            i, count_i = counts[a]
            for b in range(a + 1, len(counts)):
                j, count_j = counts[b]
                exp_sum += count_i * count_j * self.dist[i][j]
        d_expected = exp_sum / exp_pairs
        if d_expected == 0:
            return 1.0
        return 1.0 - d_observed / d_expected


def alpha_set_ci(
    units_by_doc: dict[str, list[Sequence[frozenset]]],
    *,
    distance: SetDistance = masi_distance,
    n_resamples: int = 1000,
    confidence: float = 0.95,
    seed: int = 42,
    tag: str = "alpha-set",
) -> dict:
    """α + IC bootstrap par document pour une distance d'ensembles donnée."""
    pool = _AlphaPool(units_by_doc, distance)
    point = pool.alpha(pool.documents)
    result = {
        "point": round(point, 6) if point is not None else None,
        "low": None, "high": None, "nResamples": 0,
        "nDocuments": len(pool.documents), "unit": "document",
        "confidence": confidence,
    }
    if point is None or len(pool.documents) < 2:
        result["warning"] = "insufficient_groups"
        return result
    values = []
    for draw in _rng_ints(seed, tag, len(pool.documents), n_resamples):
        value = pool.alpha([pool.documents[i] for i in draw])
        if value is not None:
            values.append(value)
    if not values:
        result["warning"] = "insufficient_groups"
        return result
    values.sort()
    alpha_level = (1.0 - confidence) / 2.0
    result["low"] = round(values[max(0, int(alpha_level * len(values)))], 6)
    result["high"] = round(values[min(len(values) - 1, int((1 - alpha_level) * len(values)))], 6)
    result["nResamples"] = len(values)
    return result


def alpha_masi_vs_nominal(
    masi_units_by_doc: dict[str, list[Sequence[frozenset]]],
    nominal_units_by_doc: dict[str, list[Sequence[frozenset]]] | None = None,
    *,
    n_resamples: int = 1000,
    confidence: float = 0.95,
    seed: int = 42,
) -> dict:
    """E1 — le coût du multi-label : α_MASI sur les ENSEMBLES complets de thèmes vs
    α nominal sur la projection MONO-label (thème primaire en singleton — c'est ainsi
    que le contrôle 0,701 de la campagne est défini), et leur différence APPARIÉE
    (mêmes tirages de documents pour les deux → l'IC porte sur la différence, pas sur
    deux IC marginaux qu'on comparerait à l'œil).

    `p_direction` = part des tirages où la différence (nominal − MASI) est ≤ 0 : petite
    → le coût du multi-label est stable au rééchantillonnage des documents. Ce n'est pas
    une p-value de test nul (les deux α partagent les mêmes données par construction),
    et l'UI doit la présenter comme une stabilité de signe.
    """
    if nominal_units_by_doc is None:
        nominal_units_by_doc = masi_units_by_doc
    if sorted(masi_units_by_doc) != sorted(nominal_units_by_doc):
        raise ValueError(
            "E1 exige les MÊMES documents des deux côtés — la différence appariée "
            "n'a pas de sens sinon."
        )
    masi_pool = _AlphaPool(masi_units_by_doc, masi_distance)
    nominal_pool = _AlphaPool(nominal_units_by_doc, nominal_set_distance)
    documents = masi_pool.documents
    point_masi = masi_pool.alpha(documents)
    point_nominal = nominal_pool.alpha(documents)
    diff = (
        round(point_nominal - point_masi, 6)
        if point_masi is not None and point_nominal is not None else None
    )
    out = {
        "alphaMasi": round(point_masi, 6) if point_masi is not None else None,
        "alphaNominal": round(point_nominal, 6) if point_nominal is not None else None,
        "diff": diff,
        "diffLow": None, "diffHigh": None, "pDirection": None,
        "nDocuments": len(documents), "nResamples": 0,
        "unit": "document", "confidence": confidence,
    }
    if diff is None or len(documents) < 2:
        out["warning"] = "insufficient_groups"
        return out
    diffs = []
    below = 0
    for draw in _rng_ints(seed, "alpha-diff", len(documents), n_resamples):
        sample = [documents[i] for i in draw]
        masi = masi_pool.alpha(sample)
        nominal = nominal_pool.alpha(sample)
        if masi is None or nominal is None:
            continue
        d = nominal - masi
        diffs.append(d)
        if d <= 0:
            below += 1
    if not diffs:
        out["warning"] = "insufficient_groups"
        return out
    diffs.sort()
    alpha_level = (1.0 - confidence) / 2.0
    out["diffLow"] = round(diffs[max(0, int(alpha_level * len(diffs)))], 6)
    out["diffHigh"] = round(diffs[min(len(diffs) - 1, int((1 - alpha_level) * len(diffs)))], 6)
    out["pDirection"] = round(below / len(diffs), 6)
    out["nResamples"] = len(diffs)
    return out


# --------------------------------------------------------------------------- #
# Gwet AC1 — binaire multi-juges (par thème)
# --------------------------------------------------------------------------- #

def gwet_ac1_binary(units: Iterable[Sequence[bool]]) -> float | None:
    """Gwet AC1 pour une catégorie binaire, plusieurs juges par unité (Gwet 2008).

    Pa = accord observé moyen intra-unité ; Pe = 2π(1−π) avec π = prévalence moyenne
    (part moyenne de « présent » par unité). Robuste au paradoxe de κ sur prévalence
    extrême — exactement le régime des thèmes rares (`FEEDBACK` 0,34 %).
    """
    items = [list(u) for u in units if len(u) >= 2]
    if not items:
        return None
    pa_sum = 0.0
    pi_sum = 0.0
    for ratings in items:
        r = len(ratings)
        positive = sum(1 for value in ratings if value)
        pa_sum += (
            positive * (positive - 1) + (r - positive) * (r - positive - 1)
        ) / (r * (r - 1))
        pi_sum += positive / r
    pa = pa_sum / len(items)
    pi = pi_sum / len(items)
    pe = 2.0 * pi * (1.0 - pi)
    if pe >= 1.0:
        return None
    return round((pa - pe) / (1.0 - pe), 6)

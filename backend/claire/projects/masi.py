"""α de Krippendorff avec distance MASI — accord inter-annotateurs MULTI-LABEL.

Indicateur tête de gondole du protocole « confiance graduée + multi-label » : il mesure
l'accord sur des ENSEMBLES de thèmes (et pas un thème unique). Distance MASI (Passonneau
2006) = 1 − J·Jaccard, où J ∈ {1, 2/3, 1/3, 0} selon l'inclusion des ensembles.

Propriété de cohérence (vérifiée par les tests) : sur des étiquettes MONO (singletons), la
distance MASI se réduit à la distance nominale 0/1, donc α_MASI = α nominal de Krippendorff
(≈ κ de Fleiss) — c'est le « sanity-check » du protocole (α_MASI = κ = 0,422 sur le mono).

Pur (aucune dépendance Django) : `units` = liste, par phrase, des ensembles de thèmes
proposés par chaque juge/annotateur. Seules les phrases avec ≥ 2 jugements comptent.
"""

from __future__ import annotations

from itertools import combinations
from typing import Iterable, Sequence


def masi_distance(a: set[str], b: set[str]) -> float:
    """Distance MASI ∈ [0, 1] entre deux ensembles d'étiquettes (0 = identiques)."""
    if not a and not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    if union == 0:
        return 0.0
    jaccard = inter / union
    if a == b:
        m = 1.0  # identiques
    elif a <= b or b <= a:
        m = 2.0 / 3.0  # l'un inclus dans l'autre
    elif inter > 0:
        m = 1.0 / 3.0  # intersection non vide, sans inclusion
    else:
        m = 0.0  # disjoints
    return 1.0 - m * jaccard


def nominal_distance(a: set[str], b: set[str]) -> float:
    """Distance nominale 0/1 (référence mono-label : 0 si égaux, sinon 1)."""
    return 0.0 if a == b else 1.0


def krippendorff_alpha(
    units: Iterable[Sequence[set[str]]],
    distance=masi_distance,
) -> float | None:
    """α de Krippendorff (forme par paires) pour une distance d'ensembles donnée.

    units : itérable d'unités (phrases) ; chaque unité = séquence d'ensembles (un par juge).
    Renvoie None si l'accord n'est pas calculable (< 2 jugements appariables au total).
    α = 1 − D_observé / D_attendu. α=1 accord parfait ; α≈0 niveau du hasard ; α<0 pire.
    """
    items = [list(u) for u in units if len(u) >= 2]
    if not items:
        return None

    # Désaccord observé : moyenne des distances par paires À L'INTÉRIEUR de chaque unité.
    obs_sum = 0.0
    obs_pairs = 0
    for u in items:
        for x, y in combinations(u, 2):
            obs_sum += distance(set(x), set(y))
            obs_pairs += 1
    if obs_pairs == 0:
        return None
    d_observed = obs_sum / obs_pairs

    # Désaccord attendu : moyenne des distances sur TOUTES les paires de jugements regroupés.
    pool = [set(x) for u in items for x in u]
    exp_sum = 0.0
    exp_pairs = 0
    for x, y in combinations(pool, 2):
        exp_sum += distance(x, y)
        exp_pairs += 1
    if exp_pairs == 0:
        return None
    d_expected = exp_sum / exp_pairs

    if d_expected == 0:
        # Aucun désaccord possible (tout le monde dit la même chose partout) → accord parfait.
        return 1.0
    return 1.0 - d_observed / d_expected


def alpha_masi(units: Iterable[Sequence[set[str]]]) -> float | None:
    """Raccourci : α de Krippendorff avec distance MASI (multi-label)."""
    return krippendorff_alpha(units, distance=masi_distance)

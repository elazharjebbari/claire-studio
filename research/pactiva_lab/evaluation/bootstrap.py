"""Intervalles de confiance par rééchantillonnage — au niveau DOCUMENT.

L'unité de rééchantillonnage est le point de rigueur central de tout le module. Les
phrases d'un même contrat ne sont pas indépendantes : elles partagent vocabulaire,
structure et style. Rééchantillonner des phrases donnerait des intervalles faussement
étroits — l'erreur classique qui fait passer pour significatif un écart qui ne l'est pas.

Avec 30 à 50 documents, l'incertitude est réelle et doit être visible : un résultat sans
intervalle ne va pas dans l'article.
"""

from __future__ import annotations

import hashlib
from collections.abc import Callable


def _rng_stream(seed: int, size: int, draws: int):
    """Suite d'entiers pseudo-aléatoires reproductible, sans `random`.

    `random` dépend de l'implémentation de Python ; une empreinte de run doit rester
    stable d'une version à l'autre et d'une machine à l'autre. Un SHA-256 en compteur
    fait l'affaire et se relit sans dépendance.
    """
    counter = 0
    for _ in range(draws):
        row = []
        while len(row) < size:
            digest = hashlib.sha256(f"{seed}:{counter}".encode()).digest()
            counter += 1
            for i in range(0, len(digest), 4):
                if len(row) >= size:
                    break
                row.append(int.from_bytes(digest[i : i + 4], "big") % size)
        yield row


def bootstrap_ci(
    groups: list[str],
    metric: Callable[[list[str]], float],
    *,
    n_resamples: int = 1000,
    confidence: float = 0.95,
    seed: int = 42,
) -> dict:
    """IC par rééchantillonnage avec remise des GROUPES (documents).

    `groups` : identifiants des documents évalués.
    `metric` : fonction qui, pour un sous-ensemble de documents (avec répétitions),
    renvoie la valeur de la métrique.
    """
    unique = sorted(set(groups))
    if len(unique) < 2:
        # Un intervalle sur un seul document n'aurait aucun sens : on le dit plutôt que
        # de rendre un intervalle de largeur nulle qui serait lu comme une certitude.
        return {
            "point": round(metric(unique), 6) if unique else None,
            "low": None,
            "high": None,
            "nResamples": 0,
            "unit": "document",
            "warning": "insufficient_groups",
        }

    point = metric(unique)
    values = []
    for draw in _rng_stream(seed, len(unique), n_resamples):
        sample = [unique[i] for i in draw]
        try:
            values.append(metric(sample))
        except Exception:  # pragma: no cover - un tirage dégénéré ne doit pas tout casser
            continue
    if not values:
        return {
            "point": round(point, 6), "low": None, "high": None,
            "nResamples": 0, "unit": "document", "warning": "all_resamples_failed",
        }

    values.sort()
    alpha = (1.0 - confidence) / 2.0
    low = values[max(0, int(alpha * len(values)))]
    high = values[min(len(values) - 1, int((1 - alpha) * len(values)))]
    return {
        "point": round(point, 6),
        "low": round(low, 6),
        "high": round(high, 6),
        "nResamples": len(values),
        "confidence": confidence,
        "unit": "document",
    }


def fold_dispersion(values: list[float]) -> dict:
    """Dispersion entre plis — un écart-type élevé signale un modèle instable, souvent
    plus informatif que la moyenne elle-même sur un petit corpus."""
    if not values:
        return {"mean": None, "std": None, "min": None, "max": None, "n": 0}
    n = len(values)
    mean = sum(values) / n
    variance = sum((v - mean) ** 2 for v in values) / n if n > 1 else 0.0
    return {
        "mean": round(mean, 6),
        "std": round(variance ** 0.5, 6),
        "min": round(min(values), 6),
        "max": round(max(values), 6),
        "n": n,
    }

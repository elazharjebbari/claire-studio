"""Agrégation des votes d'annotateurs vers une étiquette de référence — module PUR.

Trois politiques, pour trois usages :

    single      un annotateur désigné            → corpus mono-annoté, analyse par personne
    consensus   la cascade de `gold_scoring`     → l'étiquette « dure » d'entraînement
    soft        distribution des votes conservée → apprentissage perspectiviste, calibration

La politique `consensus` **réutilise `claire.projects.gold_scoring`** au lieu de
réimplémenter un vote : le moteur de résolution est déjà écrit, testé, déployé, et il
porte un invariant qu'il ne faut surtout pas contourner — **les LLM ne sont jamais
parties au conflit**, ils ne servent que de référence indicative. Réécrire un vote ici
risquerait de réintroduire la logique « humain contre LLM » qui a été explicitement
retirée du produit.

La politique `soft` répond au reproche de Braun (2023) aux corpus juridiques : ils
effacent le désaccord. Conserver la distribution permet de publier deux couches — le
gold arbitré et les votes bruts — et de mesurer l'ambiguïté irréductible au lieu de la
postuler.
"""

from __future__ import annotations

from collections import defaultdict

from claire.projects.gold_scoring import Vote, default_config, score_sentence


class UnknownAggregation(ValueError):
    """Politique inconnue — refus explicite plutôt que repli silencieux."""


AGGREGATIONS = ("single", "consensus", "soft")


def aggregate_sentence(
    votes: list[tuple[str, str | None, tuple[str, ...]]],
    *,
    policy: str = "consensus",
    single_annotator: str | None = None,
    config: dict | None = None,
) -> dict | None:
    """Étiquette de référence d'UNE phrase à partir des votes (annotateur, primaire, secondaires).

    Renvoie ``None`` quand aucune étiquette ne peut être produite (phrase non couverte),
    ce qui est différent d'une phrase couverte mais en désaccord total : cette dernière
    reçoit bien une étiquette, assortie d'une classe d'accord `divergence`.
    """
    if policy not in AGGREGATIONS:
        raise UnknownAggregation(f"politique inconnue : {policy!r} (attendu {AGGREGATIONS})")

    covered = [(who, primary, secondaries) for who, primary, secondaries in votes if primary]
    if not covered:
        return None

    if policy == "single":
        if single_annotator is None:
            raise UnknownAggregation("politique 'single' : `single_annotator` est requis")
        for who, primary, secondaries in covered:
            if who == single_annotator:
                return {
                    "primary": primary,
                    "secondaries": sorted(secondaries),
                    "agreement": "single",
                    "confidence": 1.0,
                    "annotators": [who],
                    "nAnnotators": 1,
                }
        return None

    scored = score_sentence(
        [Vote(voter_id=who, primary=primary, secondaries=tuple(secondaries))
         for who, primary, secondaries in covered],
        config or default_config(),
    )

    result = {
        "primary": scored.primary,
        "secondaries": sorted(scored.secondaries),
        "agreement": scored.agreement_class,
        "confidence": round(scored.confidence, 4),
        "autoLevel": scored.auto_level,
        "riskBand": scored.risk_band,
        "annotators": sorted(who for who, _, _ in covered),
        "nAnnotators": len(covered),
    }

    if policy == "soft":
        # Distribution des votes PRIMAIRES, normalisée. On conserve aussi la masse des
        # secondaires : un thème proposé en secondaire par tous les annotateurs porte
        # une information que le seul primaire perdrait.
        primary_mass: dict[str, float] = defaultdict(float)
        secondary_mass: dict[str, float] = defaultdict(float)
        for _, primary, secondaries in covered:
            primary_mass[primary] += 1.0
            for code in secondaries:
                secondary_mass[code] += 1.0
        total = sum(primary_mass.values())
        result["soft"] = {
            code: round(mass / total, 6) for code, mass in sorted(primary_mass.items())
        }
        result["softSecondary"] = {
            code: round(mass / len(covered), 6)
            for code, mass in sorted(secondary_mass.items())
        }
        # L'entropie du vote est la mesure directe de l'ambiguïté de la phrase — c'est
        # elle qui sert à quantifier l'« ambiguïté irréductible » plutôt que de la
        # postuler à 18 % comme le faisaient les premiers dossiers.
        result["voteEntropy"] = _entropy(list(result["soft"].values()))

    return result


def _entropy(probabilities: list[float]) -> float:
    """Entropie de Shannon normalisée d'une distribution de votes (0 = unanime)."""
    import math

    positive = [p for p in probabilities if p > 0]
    if len(positive) < 2:
        return 0.0
    raw = -sum(p * math.log(p) for p in positive)
    return round(raw / math.log(len(positive)), 4)

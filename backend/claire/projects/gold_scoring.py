"""Moteur de scoring GOLD (PUR) — résolution de conflits PUREMENT inter-annotateurs.

À côté d'iaa.py / concordance.py : aucune dépendance Django, testable en unité + property-based.
Décide, PAR PHRASE, le gold à partir des SEULS votes d'annotateurs.

Principe FONDAMENTAL : les conflits ne sont JAMAIS « annotateur vs LLM ». Les LLM ne sont
PAS parties au conflit — ils n'entrent ni dans la décision, ni dans la classe d'accord, ni
dans le risque, ni dans l'auto-résolution. Ils sont seulement exposés (`llm_block`) à titre
de RÉFÉRENCE indicative pour aider l'arbitre humain.

- Classification (annotateurs) : strict / majority / divergence.
- Auto-résolution (annotateurs) : auto_1click (accord absolu) / auto (majorité ≥ 2/3) / manual.
- Multi-label : primaire + secondaires décidés séparément.
"""

from __future__ import annotations

from dataclasses import dataclass

ANNOTATOR_WEIGHT_DEFAULT = 1.0  # plus aucun LLM à surpondérer
SECONDARY_MIN_ANNOTATORS = 2
MAJORITY_RATIO = 2.0 / 3.0


@dataclass(frozen=True)
class Vote:
    """Vote d'une source pour UNE phrase. `primary=None` = phrase non couverte par cette source."""
    voter_id: str
    primary: str | None
    secondaries: tuple[str, ...] = ()
    is_llm: bool = False


@dataclass
class GoldScore:
    primary: str | None
    secondaries: list[str]
    agreement_class: str  # strict | majority | divergence | empty
    confidence: float
    risk_band: str  # low | medium | high
    human_dissent: bool  # DÉPRÉCIÉ : toujours False (les LLM ne créent jamais de conflit)
    human_block: str | None
    llm_block: str | None  # référence indicative (n'entre pas dans la décision)
    auto_level: str  # auto_1click | auto | manual
    tally: dict  # thème -> masse de poids (annotateurs seuls)


def default_config() -> dict:
    """Config par défaut — pondération des ANNOTATEURS uniquement."""
    return {
        "annotator_weight": ANNOTATOR_WEIGHT_DEFAULT,
        "per_annotator": {},   # voter_id (username) -> poids
        "secondary_min_annotators": SECONDARY_MIN_ANNOTATORS,
        "reliability": {},     # thème -> kappa de fiabilité (∈[0,1]) ; défaut 1.0
    }


def _clamp01(x: float) -> float:
    return 0.0 if x < 0 else 1.0 if x > 1 else x


def _weight(vote: Vote, config: dict) -> float:
    # Les LLM ne servent qu'au consensus indicatif (`llm_block`) → poids uniforme.
    if vote.is_llm:
        return 1.0
    return float(
        config.get("per_annotator", {}).get(
            vote.voter_id, config.get("annotator_weight", ANNOTATOR_WEIGHT_DEFAULT)
        )
    )


def _tally(votes: list[Vote], config: dict) -> dict:
    """Masse de poids par thème PRIMAIRE (ignore les votes non couvrants)."""
    out: dict[str, float] = {}
    for v in votes:
        if v.primary is None:
            continue
        out[v.primary] = out.get(v.primary, 0.0) + _weight(v, config)
    return out


def _argmax(tally: dict) -> str | None:
    """Thème de masse maximale ; départage LEXICOGRAPHIQUE (déterminisme/idempotence)."""
    if not tally:
        return None
    return max(sorted(tally), key=lambda k: tally[k])


def _block(votes: list[Vote], config: dict) -> tuple[str | None, dict]:
    t = _tally(votes, config)
    return _argmax(t), t


def score_sentence(votes: list[Vote], config: dict | None = None) -> GoldScore:
    """Décide le gold d'une phrase — PUREMENT inter-annotateurs.

    Les LLM ne sont JAMAIS parties au conflit : ils n'entrent NI dans la décision, NI dans
    la classe d'accord, NI dans le risque, NI dans l'auto-résolution. Ils sont seulement
    exposés (`llm_block`) à titre de RÉFÉRENCE indicative. La résolution arbitre les
    désaccords ENTRE ANNOTATEURS uniquement. PUR.
    """
    cfg = {**default_config(), **(config or {})}

    humans = [v for v in votes if not v.is_llm]
    llms = [v for v in votes if v.is_llm]
    covering_humans = [v for v in humans if v.primary is not None]

    # Électorat de décision = ANNOTATEURS uniquement.
    human_block, human_tally = _block(humans, cfg)
    llm_block, _ = _block(llms, cfg)  # référence indicative seulement (aucun effet)
    decision = dict(human_tally)
    primary = _argmax(decision)

    # ── Confiance = soutien pondéré des ANNOTATEURS pour le primaire ─────────
    support_total = sum(_weight(v, cfg) for v in covering_humans)
    support_top = sum(_weight(v, cfg) for v in covering_humans if v.primary == primary)
    support = (support_top / support_total) if support_total > 0 else 0.0
    reliability = float(cfg.get("reliability", {}).get(primary, 1.0)) if primary else 0.0
    confidence = _clamp01(support) * reliability

    # ── Classification (ANNOTATEURS seuls) ───────────────────────────────────
    if not covering_humans:
        agreement_class = "empty"
    else:
        primaries = {v.primary for v in covering_humans}
        sec_sets = {tuple(sorted(set(v.secondaries))) for v in covering_humans}
        if len(primaries) == 1 and len(sec_sets) == 1:
            agreement_class = "strict"
        else:
            human_total = sum(human_tally.values())
            if human_block is not None and human_tally.get(human_block, 0.0) > human_total / 2.0:
                agreement_class = "majority"
            else:
                agreement_class = "divergence"

    # ── Secondaires : portés par ≥ N annotateurs (hors primaire) ─────────────
    sec_min = int(cfg.get("secondary_min_annotators", SECONDARY_MIN_ANNOTATORS))
    sec_counts: dict[str, int] = {}
    for v in covering_humans:
        for s in set(v.secondaries):
            if s != primary:
                sec_counts[s] = sec_counts.get(s, 0) + 1
    secondaries = sorted([s for s, n in sec_counts.items() if n >= sec_min])

    # ── Bande de risque (sur l'accord entre annotateurs uniquement) ──────────
    if agreement_class == "divergence":
        risk_band = "high"
    elif agreement_class == "strict":
        risk_band = "low"
    else:
        risk_band = "medium"

    # ── Auto-résolution (ANNOTATEURS seuls — aucun critère LLM) ──────────────
    secondaries_identical = (
        len({tuple(sorted(set(v.secondaries))) for v in covering_humans}) == 1
        if covering_humans else False
    )
    # Ratio sur le NOMBRE d'annotateurs d'accord avec le primaire.
    ratio = (
        sum(1 for v in covering_humans if v.primary == human_block) / len(covering_humans)
        if covering_humans else 0.0
    )
    if agreement_class == "strict" and secondaries_identical:
        auto_level = "auto_1click"
    elif agreement_class == "majority" and ratio >= MAJORITY_RATIO - 1e-9:
        auto_level = "auto"
    else:
        auto_level = "manual"

    return GoldScore(
        primary=primary,
        secondaries=secondaries,
        agreement_class=agreement_class,
        confidence=round(confidence, 4),
        risk_band=risk_band,
        human_dissent=False,  # déprécié : les LLM ne créent JAMAIS de conflit
        human_block=human_block,
        llm_block=llm_block,  # référence indicative (n'entre pas dans la décision)
        auto_level=auto_level,
        tally=decision,
    )

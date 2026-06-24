"""Moteur de scoring GOLD (PUR) — résolution de conflits inter-annotateurs.

À côté d'iaa.py / concordance.py : aucune dépendance Django, testable en unité + property-based.
Décide, PAR PHRASE, le gold à partir des votes : électorat PONDÉRÉ où les annotateurs pèsent
PLUS que les LLM (dossier docs/pactiva/dossier-gold-tech/02-scoring-engine.md, ADR-003).

Principes :
- Les ANNOTATEURS font autorité (le gold est humain) ; les LLM aident selon `llm_role`.
- Une décision humaine ≠ consensus LLM (`human_dissent`) est un SIGNAL FORT → jamais d'auto.
- Classification : strict / majority / divergence (sur les annotateurs).
- Niveaux d'auto-résolution : auto_1click (accord absolu) / auto (cas peu risqué) / manual.
- Multi-label : primaire + secondaires décidés séparément.
"""

from __future__ import annotations

from dataclasses import dataclass

ANNOTATOR_WEIGHT_DEFAULT = 3.0
LLM_WEIGHT_DEFAULT = 1.0
LOW_CONFIDENCE = 0.34
SECONDARY_MIN_ANNOTATORS = 2
LLM_UNANIMOUS_MIN = 3
MAJORITY_RATIO = 2.0 / 3.0

LLM_ROLES = ("ignore", "tiebreak", "signal", "full")


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
    human_dissent: bool
    human_block: str | None
    llm_block: str | None
    auto_level: str  # auto_1click | auto | manual
    tally: dict  # thème -> masse de poids (électorat de décision)


def default_config() -> dict:
    """Config par défaut « confiance aux annotateurs » (cf. presets.yaml)."""
    return {
        "annotator_weight": ANNOTATOR_WEIGHT_DEFAULT,
        "llm_weight": LLM_WEIGHT_DEFAULT,
        "llm_role": "tiebreak",
        "per_annotator": {},   # voter_id -> poids
        "per_llm": {},         # voter_id -> poids
        "secondary_min_annotators": SECONDARY_MIN_ANNOTATORS,
        "reliability": {},     # thème -> kappa de fiabilité (∈[0,1]) ; défaut 1.0
    }


def _clamp01(x: float) -> float:
    return 0.0 if x < 0 else 1.0 if x > 1 else x


def _weight(vote: Vote, config: dict) -> float:
    if vote.is_llm:
        return float(config.get("per_llm", {}).get(vote.voter_id, config.get("llm_weight", LLM_WEIGHT_DEFAULT)))
    return float(config.get("per_annotator", {}).get(vote.voter_id, config.get("annotator_weight", ANNOTATOR_WEIGHT_DEFAULT)))


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
    """Calcule la décision gold d'une phrase à partir des votes (annotateurs + LLM). PUR."""
    cfg = {**default_config(), **(config or {})}
    role = cfg.get("llm_role", "tiebreak")
    if role not in LLM_ROLES:
        role = "tiebreak"

    humans = [v for v in votes if not v.is_llm]
    llms = [v for v in votes if v.is_llm]
    covering_humans = [v for v in humans if v.primary is not None]
    covering_llms = [v for v in llms if v.primary is not None]

    human_block, human_tally = _block(humans, cfg)
    llm_block, llm_tally = _block(llms, cfg)

    # ── Électorat de DÉCISION selon le rôle des LLM ──────────────────────────
    if role == "full":
        decision = dict(human_tally)
        for k, w in llm_tally.items():
            decision[k] = decision.get(k, 0.0) + w
    elif role == "tiebreak":
        decision = dict(human_tally)
        # LLM ne départagent QUE les ex-aequo humains de tête.
        if human_tally:
            top = max(human_tally.values())
            tied = [k for k, w in human_tally.items() if w == top]
            if len(tied) > 1:
                for k in tied:
                    decision[k] = decision.get(k, 0.0) + llm_tally.get(k, 0.0)
    else:  # ignore | signal : les LLM ne participent pas à la décision
        decision = dict(human_tally)

    # Repli LLM si AUCUN humain n'a couvert la phrase (rare) et rôle non-ignore.
    if not decision and role in ("full", "tiebreak", "signal") and llm_tally:
        decision = dict(llm_tally)

    primary = _argmax(decision)

    # ── Confiance = soutien pondéré du primaire sur l'électorat de confiance ──
    # Humains toujours ; LLM SAUF rôle 'ignore' (un renfort LLM concordant remonte la
    # confiance et abaisse le risque, cohérent avec l'auto-résolution des cas peu risqués).
    support_votes = covering_humans + ([] if role == "ignore" else covering_llms)
    support_total = sum(_weight(v, cfg) for v in support_votes)
    support_top = sum(_weight(v, cfg) for v in support_votes if v.primary == primary)
    support = (support_top / support_total) if support_total > 0 else 0.0
    reliability = float(cfg.get("reliability", {}).get(primary, 1.0)) if primary else 0.0
    confidence = _clamp01(support) * reliability

    # ── Signal fort : décision humaine ≠ consensus LLM ───────────────────────
    human_dissent = (
        human_block is not None and llm_block is not None and human_block != llm_block
    )

    # ── Classification (sur les ANNOTATEURS, autorité du gold) ───────────────
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

    # ── Bande de risque ──────────────────────────────────────────────────────
    if agreement_class == "divergence" or human_dissent or confidence < LOW_CONFIDENCE:
        risk_band = "high"
    elif agreement_class == "strict" and not human_dissent:
        risk_band = "low"
    else:
        risk_band = "medium"

    # ── Niveau d'auto-résolution (politique auto-resolution.yaml) ────────────
    secondaries_identical = (
        len({tuple(sorted(set(v.secondaries))) for v in covering_humans}) == 1
        if covering_humans else False
    )
    llm_unanimous = (
        len(covering_llms) >= LLM_UNANIMOUS_MIN
        and len({v.primary for v in covering_llms}) == 1
    )
    # Ratio sur le NOMBRE d'annotateurs (fidèle à « 2/3 des annotateurs d'accord »).
    ratio = (
        sum(1 for v in covering_humans if v.primary == human_block) / len(covering_humans)
        if covering_humans else 0.0
    )
    if human_dissent:
        auto_level = "manual"
    elif agreement_class == "strict" and secondaries_identical:
        auto_level = "auto_1click"
    elif ratio >= MAJORITY_RATIO - 1e-9 and llm_unanimous and llm_block == human_block:
        auto_level = "auto"
    else:
        auto_level = "manual"

    return GoldScore(
        primary=primary,
        secondaries=secondaries,
        agreement_class=agreement_class,
        confidence=round(confidence, 4),
        risk_band=risk_band,
        human_dissent=human_dissent,
        human_block=human_block,
        llm_block=llm_block,
        auto_level=auto_level,
        tally=decision,
    )

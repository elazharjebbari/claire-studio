"""Moteur de scoring GOLD (PUR) — résolution PUREMENT inter-annotateurs.

Invariant FONDAMENTAL testé : les LLM ne sont JAMAIS parties au conflit. Ils n'affectent ni
la décision, ni la classe d'accord, ni le risque, ni l'auto-résolution. Couvre aussi accord
strict / majorité 2/3 / divergence, secondaires, pondérations, et propriétés (permutation /
idempotence / indépendance LLM).

Module PUR → aucun accès DB.
"""

from hypothesis import given, settings
from hypothesis import strategies as st

from claire.projects.gold_scoring import GoldScore, Vote, default_config, score_sentence


def H(vid, primary, *secondaries):
    return Vote(voter_id=vid, primary=primary, secondaries=tuple(secondaries), is_llm=False)


def L(vid, primary, *secondaries):
    return Vote(voter_id=vid, primary=primary, secondaries=tuple(secondaries), is_llm=True)


# ════════════════════════════════════════════════════════════════════════════
# 1. La décision est PUREMENT inter-annotateurs — les LLM n'y entrent jamais
# ════════════════════════════════════════════════════════════════════════════
def test_annotators_decide_llms_ignored():
    # 3 annotateurs X, 3 LLM Y → gold = X (les LLM ne votent pas).
    votes = [H("a1", "X"), H("a2", "X"), H("a3", "X"), L("c", "Y"), L("d", "Y"), L("m", "Y")]
    s = score_sentence(votes)
    assert s.primary == "X"
    assert s.agreement_class == "strict"
    assert s.auto_level == "auto_1click"
    assert s.llm_block == "Y"  # exposé en référence seulement
    assert s.human_dissent is False  # déprécié : aucun conflit « humain vs LLM »


def test_strict_annotators_despite_llm_divergence_is_not_a_conflict():
    # Accord STRICT entre annotateurs alors que les LLM divergent totalement → PAS un conflit.
    votes = [H("a1", "PRIVACY"), H("a2", "PRIVACY"), H("a3", "PRIVACY"),
             L("c", "LIABILITY"), L("d", "LIABILITY"), L("m", "LIABILITY")]
    s = score_sentence(votes)
    assert s.agreement_class == "strict"
    assert s.risk_band == "low"
    assert s.auto_level == "auto_1click"
    assert s.human_dissent is False


def test_llms_never_change_the_outcome():
    base = score_sentence([H("a1", "X"), H("a2", "X"), H("a3", "Y")])
    with_llms = score_sentence(
        [H("a1", "X"), H("a2", "X"), H("a3", "Y"), L("c", "Z"), L("d", "Z"), L("m", "Z")]
    )
    assert with_llms.primary == base.primary
    assert with_llms.agreement_class == base.agreement_class
    assert with_llms.risk_band == base.risk_band
    assert with_llms.auto_level == base.auto_level
    assert with_llms.confidence == base.confidence


# ════════════════════════════════════════════════════════════════════════════
# 2. Accord strict = 1 clic
# ════════════════════════════════════════════════════════════════════════════
def test_absolute_agreement_is_one_click_low_risk():
    s = score_sentence([H("a1", "X", "S1"), H("a2", "X", "S1"), H("a3", "X", "S1")])
    assert s.agreement_class == "strict"
    assert s.auto_level == "auto_1click"
    assert s.risk_band == "low"
    assert s.secondaries == ["S1"]
    assert s.confidence == 1.0


def test_single_annotator_is_strict():
    s = score_sentence([H("a1", "X")])
    assert s.agreement_class == "strict"
    assert s.auto_level == "auto_1click"


# ════════════════════════════════════════════════════════════════════════════
# 3. Majorité d'annotateurs ≥ 2/3 → auto
# ════════════════════════════════════════════════════════════════════════════
def test_two_thirds_majority_is_auto():
    s = score_sentence([H("a1", "X"), H("a2", "X"), H("a3", "Y")])
    assert s.primary == "X"
    assert s.agreement_class == "majority"
    assert s.auto_level == "auto"
    assert s.risk_band == "medium"


def test_weighted_minority_count_below_two_thirds_is_manual():
    # a1 pèse 10 (décide X), mais seul 1/3 des annotateurs vote X → manuel (arbitre confirme).
    cfg = {**default_config(), "per_annotator": {"a1": 10.0, "a2": 1.0, "a3": 1.0}}
    s = score_sentence([H("a1", "X"), H("a2", "Y"), H("a3", "Y")], cfg)
    assert s.primary == "X"
    assert s.agreement_class == "majority"
    assert s.auto_level == "manual"


# ════════════════════════════════════════════════════════════════════════════
# 4. Divergence
# ════════════════════════════════════════════════════════════════════════════
def test_total_divergence_high_risk_manual():
    s = score_sentence([H("a1", "X"), H("a2", "Y"), H("a3", "Z")])
    assert s.agreement_class == "divergence"
    assert s.risk_band == "high"
    assert s.auto_level == "manual"


def test_two_way_tie_is_divergence():
    s = score_sentence([H("a1", "X"), H("a2", "Y")])
    assert s.agreement_class == "divergence"
    assert s.auto_level == "manual"


# ════════════════════════════════════════════════════════════════════════════
# 5. Secondaires multi-label (≥ N annotateurs)
# ════════════════════════════════════════════════════════════════════════════
def test_secondary_accepted_when_two_annotators_carry_it():
    s = score_sentence([H("a1", "X", "S1"), H("a2", "X", "S1"), H("a3", "X")])
    assert s.secondaries == ["S1"]


def test_secondary_rejected_when_only_one_annotator():
    s = score_sentence([H("a1", "X", "S1"), H("a2", "X"), H("a3", "X")])
    assert s.secondaries == []


def test_secondary_threshold_configurable():
    cfg = {**default_config(), "secondary_min_annotators": 1}
    s = score_sentence([H("a1", "X", "S1"), H("a2", "X"), H("a3", "X")], cfg)
    assert s.secondaries == ["S1"]


# ════════════════════════════════════════════════════════════════════════════
# 6. Cas vides / pondérations / confiance
# ════════════════════════════════════════════════════════════════════════════
def test_no_human_votes_is_empty():
    s = score_sentence([L("c", "Y"), L("d", "Y")])
    assert s.agreement_class == "empty"
    assert s.primary is None
    assert s.auto_level == "manual"


def test_per_annotator_weight_tips_decision():
    cfg = {**default_config(), "per_annotator": {"a1": 10.0, "a2": 1.0, "a3": 1.0}}
    s = score_sentence([H("a1", "X"), H("a2", "Y"), H("a3", "Y")], cfg)
    assert s.primary == "X"


def test_confidence_within_bounds():
    s = score_sentence([H("a1", "X"), H("a2", "Y"), H("a3", "X")])
    assert 0.0 <= s.confidence <= 1.0


def test_reliability_factor_scales_confidence():
    cfg = {**default_config(), "reliability": {"X": 0.5}}
    s = score_sentence([H("a1", "X"), H("a2", "X"), H("a3", "X")])
    assert score_sentence([H("a1", "X")], cfg).confidence == 0.5
    assert s.confidence == 1.0


# ════════════════════════════════════════════════════════════════════════════
# 7. Propriétés (hypothesis)
# ════════════════════════════════════════════════════════════════════════════
THEMES = st.sampled_from(["A", "B", "C", "D"])
HUMAN_VOTE = st.builds(lambda i, p: H(f"a{i}", p), st.integers(0, 5), THEMES)
LLM_VOTE = st.builds(lambda i, p: L(f"l{i}", p), st.integers(0, 5), THEMES)


@settings(max_examples=300)
@given(humans=st.lists(HUMAN_VOTE, min_size=1, max_size=6), llms=st.lists(LLM_VOTE, max_size=6))
def test_property_llms_never_affect_decision(humans, llms):
    # INVARIANT clé : ajouter n'importe quels votes LLM ne change RIEN à la résolution.
    base = score_sentence(humans)
    withllm = score_sentence(humans + llms)
    assert withllm.primary == base.primary
    assert withllm.agreement_class == base.agreement_class
    assert withllm.risk_band == base.risk_band
    assert withllm.auto_level == base.auto_level
    assert withllm.confidence == base.confidence
    assert withllm.secondaries == base.secondaries


@settings(max_examples=200)
@given(humans=st.lists(HUMAN_VOTE, min_size=1, max_size=6))
def test_property_bounds_and_enums(humans):
    s = score_sentence(humans)
    assert 0.0 <= s.confidence <= 1.0
    assert s.agreement_class in ("strict", "majority", "divergence", "empty")
    assert s.risk_band in ("low", "medium", "high")
    assert s.auto_level in ("auto_1click", "auto", "manual")
    assert s.human_dissent is False


@settings(max_examples=200)
@given(humans=st.lists(HUMAN_VOTE, min_size=1, max_size=6))
def test_property_permutation_invariance(humans):
    base = score_sentence(humans)
    shuffled = score_sentence(list(reversed(humans)))
    assert base.primary == shuffled.primary
    assert base.agreement_class == shuffled.agreement_class
    assert base.auto_level == shuffled.auto_level


@settings(max_examples=200)
@given(humans=st.lists(HUMAN_VOTE, min_size=1, max_size=6))
def test_property_idempotent(humans):
    assert score_sentence(humans) == score_sentence(humans)


def test_returns_gold_score_type():
    assert isinstance(score_sentence([H("a1", "X")]), GoldScore)

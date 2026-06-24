"""Moteur de scoring GOLD (PUR) — résolution de conflits inter-annotateurs.

Couvre les exigences explicites : annotateurs > LLM, signal fort « humain ≠ LLM »,
accord absolu = 1 clic, niveaux d'auto-résolution, bandes de risque, secondaires,
rôles LLM, bornes de confiance, et propriétés (monotonie / permutation / idempotence).

Module PUR → aucun accès DB (pas de marker django_db).
"""

from hypothesis import given, settings
from hypothesis import strategies as st

from claire.projects.gold_scoring import (
    GoldScore,
    Vote,
    default_config,
    score_sentence,
)


# ── Helpers de construction de votes ────────────────────────────────────────
def H(vid, primary, *secondaries):
    return Vote(voter_id=vid, primary=primary, secondaries=tuple(secondaries), is_llm=False)


def L(vid, primary, *secondaries):
    return Vote(voter_id=vid, primary=primary, secondaries=tuple(secondaries), is_llm=True)


# ════════════════════════════════════════════════════════════════════════════
# 1. Les ANNOTATEURS l'emportent sur les LLM
# ════════════════════════════════════════════════════════════════════════════
def test_humans_outweigh_llms_default():
    # 3 annotateurs disent X, 3 LLM disent Y → gold = X (annotator_weight=3 > llm 1).
    votes = [H("a1", "X"), H("a2", "X"), H("a3", "X"), L("claude", "Y"), L("codex", "Y"), L("mistral", "Y")]
    s = score_sentence(votes)
    assert s.primary == "X"
    assert s.human_block == "X"
    assert s.llm_block == "Y"


def test_single_human_beats_three_llms():
    # Un seul annotateur (poids 3) face à 3 LLM (poids 1 chacun) en rôle 'full' → humain gagne (3 > 3? égalité).
    # En 'tiebreak' (défaut), les LLM ne comptent pas hors égalité humaine → humain gagne franchement.
    votes = [H("a1", "X"), L("c", "Y"), L("d", "Y"), L("m", "Y")]
    s = score_sentence(votes)
    assert s.primary == "X"


def test_full_role_llms_can_tip_only_with_enough_mass():
    # En rôle 'full', il faut une masse LLM > au poids annotateur pour renverser.
    cfg = {**default_config(), "llm_role": "full"}
    # 1 humain (3) vs 4 LLM (4) → LLM l'emporte.
    votes = [H("a1", "X"), L("c", "Y"), L("d", "Y"), L("m", "Y"), L("n", "Y")]
    s = score_sentence(votes, cfg)
    assert s.primary == "Y"


# ════════════════════════════════════════════════════════════════════════════
# 2. Signal fort : décision humaine ≠ consensus LLM
# ════════════════════════════════════════════════════════════════════════════
def test_human_dissent_is_strong_signal_and_blocks_auto():
    # Humains unanimes sur X, LLM unanimes sur Y → dissent = vrai, risque haut, JAMAIS auto.
    votes = [H("a1", "X"), H("a2", "X"), H("a3", "X"), L("c", "Y"), L("d", "Y"), L("m", "Y")]
    s = score_sentence(votes)
    assert s.human_dissent is True
    assert s.primary == "X"           # le gold reste humain
    assert s.risk_band == "high"      # mérite attention
    assert s.auto_level == "manual"   # jamais d'auto sur un dissent


def test_no_dissent_when_no_llm():
    votes = [H("a1", "X"), H("a2", "X")]
    s = score_sentence(votes)
    assert s.human_dissent is False
    assert s.llm_block is None


def test_no_dissent_when_llm_agrees():
    votes = [H("a1", "X"), H("a2", "X"), L("c", "X"), L("d", "X"), L("m", "X")]
    s = score_sentence(votes)
    assert s.human_dissent is False


# ════════════════════════════════════════════════════════════════════════════
# 3. Accord absolu = 1 clic
# ════════════════════════════════════════════════════════════════════════════
def test_absolute_agreement_is_one_click_low_risk():
    votes = [H("a1", "X", "S1"), H("a2", "X", "S1"), H("a3", "X", "S1")]
    s = score_sentence(votes)
    assert s.agreement_class == "strict"
    assert s.auto_level == "auto_1click"
    assert s.risk_band == "low"
    assert s.secondaries == ["S1"]
    assert s.confidence == 1.0


def test_strict_primary_but_divergent_secondaries_not_strict():
    # Même primaire mais secondaires différents → pas 'strict' (donc pas auto_1click).
    votes = [H("a1", "X", "S1"), H("a2", "X", "S2"), H("a3", "X")]
    s = score_sentence(votes)
    assert s.primary == "X"
    assert s.agreement_class != "strict"
    assert s.auto_level != "auto_1click"


# ════════════════════════════════════════════════════════════════════════════
# 4. Niveau 'auto' : LLM unanimes (>=3) + 2/3 annotateurs, sans dissent
# ════════════════════════════════════════════════════════════════════════════
def test_auto_when_llm_unanimous_and_two_thirds_annotators():
    # 2/3 annotateurs sur X, le 3e sur Y ; 3 LLM unanimes sur X (= bloc humain) → auto.
    votes = [H("a1", "X"), H("a2", "X"), H("a3", "Y"), L("c", "X"), L("d", "X"), L("m", "X")]
    s = score_sentence(votes)
    assert s.human_block == "X"
    assert s.agreement_class == "majority"
    assert s.human_dissent is False
    assert s.auto_level == "auto"


def test_no_auto_when_llm_unanimous_but_dissent():
    # 2/3 annotateurs sur X, mais 3 LLM unanimes sur Y → dissent → manual (signal fort).
    votes = [H("a1", "X"), H("a2", "X"), H("a3", "Z"), L("c", "Y"), L("d", "Y"), L("m", "Y")]
    s = score_sentence(votes)
    assert s.human_dissent is True
    assert s.auto_level == "manual"


def test_no_auto_when_only_two_llms():
    # LLM non unanimes (seulement 2) → pas d'auto sur la majorité.
    votes = [H("a1", "X"), H("a2", "X"), H("a3", "Y"), L("c", "X"), L("d", "X")]
    s = score_sentence(votes)
    assert s.auto_level == "manual"


# ════════════════════════════════════════════════════════════════════════════
# 5. Divergence totale
# ════════════════════════════════════════════════════════════════════════════
def test_total_divergence_high_risk_manual():
    votes = [H("a1", "X"), H("a2", "Y"), H("a3", "Z")]
    s = score_sentence(votes)
    assert s.agreement_class == "divergence"
    assert s.risk_band == "high"
    assert s.auto_level == "manual"


def test_majority_is_medium_risk():
    votes = [H("a1", "X"), H("a2", "X"), H("a3", "Y")]
    s = score_sentence(votes)
    assert s.agreement_class == "majority"
    assert s.risk_band in ("medium", "high")  # confiance faible peut élever
    assert s.primary == "X"


# ════════════════════════════════════════════════════════════════════════════
# 6. Secondaires multi-label (≥ N annotateurs)
# ════════════════════════════════════════════════════════════════════════════
def test_secondary_accepted_when_two_annotators_carry_it():
    votes = [H("a1", "X", "S1"), H("a2", "X", "S1"), H("a3", "X")]
    s = score_sentence(votes)
    assert s.secondaries == ["S1"]


def test_secondary_rejected_when_only_one_annotator():
    votes = [H("a1", "X", "S1"), H("a2", "X"), H("a3", "X")]
    s = score_sentence(votes)
    assert s.secondaries == []


def test_secondary_threshold_configurable():
    cfg = {**default_config(), "secondary_min_annotators": 1}
    votes = [H("a1", "X", "S1"), H("a2", "X"), H("a3", "X")]
    s = score_sentence(votes, cfg)
    assert s.secondaries == ["S1"]


def test_primary_never_appears_in_secondaries():
    votes = [H("a1", "X", "X"), H("a2", "X", "X"), H("a3", "X")]
    s = score_sentence(votes)
    assert "X" not in s.secondaries


# ════════════════════════════════════════════════════════════════════════════
# 7. Rôles LLM
# ════════════════════════════════════════════════════════════════════════════
def test_role_ignore_drops_llms_from_decision_and_tally():
    cfg = {**default_config(), "llm_role": "ignore"}
    votes = [H("a1", "X"), L("c", "Y"), L("d", "Y"), L("m", "Y"), L("n", "Y")]
    s = score_sentence(votes, cfg)
    assert s.primary == "X"
    assert "Y" not in s.tally  # les LLM n'entrent pas dans l'électorat


def test_role_tiebreak_breaks_human_tie():
    # 2 annotateurs ex-aequo (X vs Y), LLM penchent pour Y → départage vers Y.
    cfg = {**default_config(), "llm_role": "tiebreak"}
    votes = [H("a1", "X"), H("a2", "Y"), L("c", "Y"), L("d", "Y")]
    s = score_sentence(votes, cfg)
    assert s.primary == "Y"


def test_role_signal_keeps_dissent_but_excludes_from_decision():
    cfg = {**default_config(), "llm_role": "signal"}
    votes = [H("a1", "X"), H("a2", "X"), L("c", "Y"), L("d", "Y"), L("m", "Y")]
    s = score_sentence(votes, cfg)
    assert s.primary == "X"
    assert s.human_dissent is True       # le signal reste visible
    assert "Y" not in s.tally            # mais n'entre pas dans la décision


# ════════════════════════════════════════════════════════════════════════════
# 8. Cas vides / dégénérés
# ════════════════════════════════════════════════════════════════════════════
def test_no_human_votes_is_empty_class():
    votes = [L("c", "Y"), L("d", "Y")]
    s = score_sentence(votes)
    assert s.agreement_class == "empty"
    assert s.auto_level == "manual"


def test_all_uncovered_returns_none_primary():
    votes = [H("a1", None), H("a2", None)]
    s = score_sentence(votes)
    assert s.primary is None
    assert s.agreement_class == "empty"


def test_uncovered_annotators_are_ignored_for_class():
    # a3 ne couvre pas la phrase → on classe sur a1/a2 (accord strict).
    votes = [H("a1", "X"), H("a2", "X"), H("a3", None)]
    s = score_sentence(votes)
    assert s.primary == "X"
    assert s.agreement_class == "strict"


# ════════════════════════════════════════════════════════════════════════════
# 9. Pondérations par annotateur
# ════════════════════════════════════════════════════════════════════════════
def test_per_annotator_weight_tips_decision():
    # a1 pèse 10, a2+a3 pèsent 1 chacun → a1 (X) l'emporte malgré l'infériorité numérique.
    cfg = {**default_config(), "per_annotator": {"a1": 10.0, "a2": 1.0, "a3": 1.0}}
    votes = [H("a1", "X"), H("a2", "Y"), H("a3", "Y")]
    s = score_sentence(votes, cfg)
    assert s.primary == "X"


# ════════════════════════════════════════════════════════════════════════════
# 10. Bornes de confiance
# ════════════════════════════════════════════════════════════════════════════
def test_confidence_within_bounds():
    votes = [H("a1", "X"), H("a2", "Y"), H("a3", "X"), L("c", "X")]
    s = score_sentence(votes)
    assert 0.0 <= s.confidence <= 1.0


def test_reliability_factor_scales_confidence():
    cfg = {**default_config(), "reliability": {"X": 0.5}}
    votes = [H("a1", "X"), H("a2", "X"), H("a3", "X")]
    s = score_sentence(votes, cfg)
    assert s.confidence == 0.5  # marge 1.0 × fiabilité 0.5


# ════════════════════════════════════════════════════════════════════════════
# 11. Propriétés (property-based, hypothesis)
# ════════════════════════════════════════════════════════════════════════════
THEMES = st.sampled_from(["A", "B", "C", "D"])
HUMAN_VOTE = st.builds(lambda i, p: H(f"a{i}", p), st.integers(0, 5), THEMES)
LLM_VOTE = st.builds(lambda i, p: L(f"l{i}", p), st.integers(0, 5), THEMES)


@settings(max_examples=300)
@given(humans=st.lists(HUMAN_VOTE, min_size=1, max_size=6), llms=st.lists(LLM_VOTE, max_size=6))
def test_property_confidence_bounded(humans, llms):
    s = score_sentence(humans + llms)
    assert 0.0 <= s.confidence <= 1.0
    assert s.agreement_class in ("strict", "majority", "divergence", "empty")
    assert s.risk_band in ("low", "medium", "high")
    assert s.auto_level in ("auto_1click", "auto", "manual")


@settings(max_examples=300)
@given(humans=st.lists(HUMAN_VOTE, min_size=1, max_size=6), llms=st.lists(LLM_VOTE, max_size=6))
def test_property_permutation_invariance(humans, llms):
    # L'ordre des votes ne change pas la décision (déterminisme).
    base = score_sentence(humans + llms)
    shuffled = score_sentence(list(reversed(llms)) + list(reversed(humans)))
    assert base.primary == shuffled.primary
    assert base.agreement_class == shuffled.agreement_class
    assert base.auto_level == shuffled.auto_level


@settings(max_examples=200)
@given(humans=st.lists(HUMAN_VOTE, min_size=1, max_size=6), llms=st.lists(LLM_VOTE, max_size=6))
def test_property_idempotent(humans, llms):
    a = score_sentence(humans + llms)
    b = score_sentence(humans + llms)
    assert a == b


@settings(max_examples=200)
@given(humans=st.lists(HUMAN_VOTE, min_size=2, max_size=6))
def test_property_dissent_or_strict_or_uncovered_never_auto_on_divergence(humans):
    s = score_sentence(humans)
    # Une divergence totale ne doit jamais être auto-résolue.
    if s.agreement_class == "divergence":
        assert s.auto_level == "manual"


@settings(max_examples=200)
@given(
    humans=st.lists(HUMAN_VOTE, min_size=3, max_size=3),
)
def test_property_monotonic_reinforcement(humans):
    # Ajouter un annotateur qui CONFIRME le primaire ne dégrade pas la confiance.
    base = score_sentence(humans)
    if base.primary is None:
        return
    reinforced = score_sentence(humans + [H("a_extra", base.primary)])
    assert reinforced.confidence >= base.confidence - 1e-9
    assert reinforced.primary == base.primary


def test_returns_gold_score_type():
    s = score_sentence([H("a1", "X")])
    assert isinstance(s, GoldScore)

"""Cas dorés du moteur de règles (sémantique de référence) + gel + étanchéité du Cypher généré."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from detection.rules import NormRecord, RulesError, compile_rules_to_cypher, evaluate_rules, load_rules  # noqa: E402
from detection.rules.evaluate import project_to_sentences  # noqa: E402
from detection.rules.loader import RULES_DIR, lint_rules_text, verify_frozen  # noqa: E402

RULES = load_rules()


def N(nid, **kw):
    base = dict(norm_id=nid, clause_id="clause:doc:consensus:0001", document="doc", theme_T11="TERMINATION",
                actor="provider", modality="power", action="terminate", condition="discretion", notice="not_stated",
                remedy="not_stated", status="validated", evidence=[3])
    base.update(kw)
    return NormRecord(**base)


def fired(matches, rule_id):
    return [m for m in matches if m.rule_id == rule_id]


def test_rules_are_frozen_and_loadable():
    assert RULES["version"] == "0.2"
    assert RULES["_frozen"] is not None, "le fichier de règles doit être gelé (FROZEN.txt)"
    assert verify_frozen(RULES_DIR / "grey_list_queries.yaml", population="holdout") is not None


def test_unfrozen_rules_refused_on_holdout(tmp_path):
    p = tmp_path / "rules.yaml"
    p.write_text("version: x\nrules: []\n", encoding="utf-8")
    with pytest.raises(RulesError):
        verify_frozen(p, population="holdout")


def test_lint_blocks_reference_leak():
    assert lint_rules_text("where: {actor: provider}") == []
    assert lint_rules_text("MATCH (s)-[:LABELED]->(c)") != []
    assert lint_rules_text("categories: [LTD]") != []


def test_Qg_fires_on_discretionary_termination_without_notice():
    m = evaluate_rules(RULES, [N("n1")])
    assert fired(m, "Q-g") and fired(m, "Q-g")[0].item == "g"
    assert fired(m, "Q-g")[0].evidence == [3]


def test_Qg_blocked_by_notice_or_cause_or_exception():
    assert not fired(evaluate_rules(RULES, [N("n1", notice="reasonable")]), "Q-g")
    assert not fired(evaluate_rules(RULES, [N("n1", condition="for_cause")]), "Q-g")
    # exception : la norme est liée (EXCEPTION_TO) à une norme « pour motif »
    base = N("n1", related=[("EXCEPTION_TO", "n2")])
    other = N("n2", condition="for_cause", action="terminate")
    assert not fired(evaluate_rules(RULES, [base, other]), "Q-g")


def test_Qf_asymmetry_depends_on_user_right_in_document():
    prov = N("n1")
    assert fired(evaluate_rules(RULES, [prov]), "Q-f-asymmetry")
    user = N("n2", clause_id="clause:doc:consensus:0009", actor="user", modality="permission", action="terminate", condition="none_stated")
    assert not fired(evaluate_rules(RULES, [prov, user]), "Q-f-asymmetry")
    # même norme utilisateur dans un AUTRE document : ne compte pas
    user_other_doc = N("n3", document="other", actor="user", modality="permission", action="terminate")
    assert fired(evaluate_rules(RULES, [prov, user_other_doc]), "Q-f-asymmetry")


def test_Qj_variants():
    mod = N("m1", theme_T11="MODIFICATION_OF_TERMS", action="modify_terms", condition="discretion", notice="not_stated", remedy="not_stated")
    m = evaluate_rules(RULES, [mod])
    assert fired(m, "Q-j") and fired(m, "Q-j-strict") and fired(m, "Q-j-absence")
    # une notification dans la même clause éteint Q-j-absence, pas Q-j
    notif = N("m2", theme_T11="MODIFICATION_OF_TERMS", action="notify_change", modality="obligation", condition="none_stated", notice="duration", notice_duration_days=30)
    m = evaluate_rules(RULES, [mod, notif])
    assert fired(m, "Q-j") and not fired(m, "Q-j-absence")
    # préavis + droit de résiliation : Q-j-strict s'éteint, Q-j reste (raison toujours absente)
    m = evaluate_rules(RULES, [N("m3", theme_T11="MODIFICATION_OF_TERMS", action="modify_terms", condition="discretion", notice="duration", notice_duration_days=30, remedy="right_to_cancel")])
    assert fired(m, "Q-j") and not fired(m, "Q-j-strict")
    # raison spécifiée : rien
    assert not fired(evaluate_rules(RULES, [N("m4", theme_T11="MODIFICATION_OF_TERMS", action="modify_terms", condition="specified_reason")]), "Q-j")


def test_Qab_item_selector():
    a = evaluate_rules(RULES, [N("l1", theme_T11="LIMITATION_LIABILITY", action="exclude_liability", object="liability for personal_injury", condition="none_stated")])
    assert fired(a, "Q-ab")[0].item == "a"
    b = evaluate_rules(RULES, [N("l2", theme_T11="LIMITATION_LIABILITY", action="cap_liability", object="unbounded cap", condition="none_stated")])
    assert fired(b, "Q-ab")[0].item == "b"
    assert not fired(evaluate_rules(RULES, [N("l3", action="exclude_liability", object="indirect damages", condition="none_stated")]), "Q-ab")


def test_Qq_disjunction():
    m = evaluate_rules(RULES, [N("q1", theme_T11="DISPUTES_LAW", actor="user", modality="obligation", action="impose_arbitration", condition="none_stated")])
    assert fired(m, "Q-q")
    m = evaluate_rules(RULES, [N("q2", theme_T11="DISPUTES_LAW", actor="provider", modality="power", action="choose_forum", condition="none_stated")])
    assert fired(m, "Q-q")
    assert not fired(evaluate_rules(RULES, [N("q3", actor="user", modality="permission", action="impose_arbitration")]), "Q-q")


def test_Ql_indexation_exception_and_Qe_threshold():
    assert fired(evaluate_rules(RULES, [N("p1", theme_T11="FEES_PAYMENT", action="change_price", remedy="none")]), "Q-l")
    assert not fired(evaluate_rules(RULES, [N("p2", theme_T11="FEES_PAYMENT", action="change_price", remedy="none", object="indexation clause")]), "Q-l")
    assert not fired(evaluate_rules(RULES, [N("p3", theme_T11="FEES_PAYMENT", action="change_price", remedy="right_to_cancel")]), "Q-l")
    e_hi = N("e1", theme_T11="FEES_PAYMENT", actor="user", modality="obligation", action="pay_compensation", condition="none_stated", amount_ratio=3.0)
    e_lo = N("e2", theme_T11="FEES_PAYMENT", actor="user", modality="obligation", action="pay_compensation", condition="none_stated", amount_ratio=1.2)
    e_na = N("e3", theme_T11="FEES_PAYMENT", actor="user", modality="obligation", action="pay_compensation", condition="none_stated")
    m = evaluate_rules(RULES, [e_hi, e_lo, e_na])
    assert [x.norm_id for x in fired(m, "Q-e")] == ["e1"]


def test_status_filter_and_projection():
    prop = N("s1", status="proposed")
    assert not evaluate_rules(RULES, [prop])
    m = evaluate_rules(RULES, [prop], statuses=("proposed",))
    assert fired(m, "Q-g")
    proj = project_to_sentences(m)
    assert ("doc", 3) in proj and "g" in proj[("doc", 3)]


def test_compiled_cypher_is_isolated_and_complete(tmp_path):
    text = compile_rules_to_cypher(RULES, tmp_path / "rules.cypher")
    assert "LABELED" not in text and "Category" not in text
    for r in RULES["rules"]:
        assert f"rule_id: \"{r['id']}\"" in text
    assert "MATCHES_ITEM" in text and "$run_id" in text and "$status" in text


def test_v02_limit_claim_period_fires_Qq_and_deem_acceptance_fires_Qi():
    m = evaluate_rules(RULES, [N("v1", theme_T11="DISPUTES_LAW", actor="user", modality="obligation", action="limit_claim_period", condition="none_stated")])
    assert fired(m, "Q-q") and fired(m, "Q-q")[0].item == "q"
    assert not fired(evaluate_rules(RULES, [N("v2", actor="provider", modality="power", action="limit_claim_period")]), "Q-q")
    m = evaluate_rules(RULES, [N("v3", theme_T11="MODIFICATION_OF_TERMS", actor="provider", modality="power", action="deem_acceptance_by_use", condition="none_stated")])
    assert fired(m, "Q-i") and fired(m, "Q-i")[0].item == "i"
    assert not fired(evaluate_rules(RULES, [N("v4", actor="user", modality="obligation", action="deem_acceptance_by_use")]), "Q-i")

"""Préférences d'interface PAR COMPTE : merge/whitelist pur + endpoint /me (PATCH partiel)."""

import pytest
from rest_framework.test import APIClient

from claire.accounts.ui_prefs import (
    DEFAULTS,
    UI_PREFS_SCHEMA_VERSION,
    merge_ui_preferences,
    normalize_ui_preferences,
)

pytestmark = pytest.mark.django_db

API = "/api/v1"


# ── merge pur (whitelist, bornage, ids libres) ──────────────────────────────────
def test_normalize_empty_gives_defaults():
    assert normalize_ui_preferences({}) == DEFAULTS
    assert normalize_ui_preferences(None) == DEFAULTS


def test_merge_partial_keeps_existing_unsent_keys():
    existing = merge_ui_preferences(DEFAULTS, {"overlays": {"showUnfairness": False}})
    # PATCH ne touchant QUE prefill → showUnfairness préservé.
    merged = merge_ui_preferences(existing, {"prefill": {"enabled": True, "judge": "mistral"}})
    assert merged["overlays"]["showUnfairness"] is False
    assert merged["prefill"] == {"enabled": True, "judge": "mistral", "asked": False}


def test_merge_rejects_unknown_keys_and_bounds_enum():
    merged = merge_ui_preferences(DEFAULTS, {
        "overlays": {"displayLang": "klingon", "hacker": 1},
        "bogus": {"x": 1},
    })
    assert merged["overlays"]["displayLang"] == "orig"  # borné
    assert "hacker" not in merged["overlays"]
    assert "bogus" not in merged


def test_merge_keeps_free_judge_ids():
    merged = merge_ui_preferences(DEFAULTS, {
        "overlays": {"llmSource": "futur-modele"},
        "prefill": {"judge": "gpt_5"},
        "ghostJudges": {"claude": True, "gpt_5": True, "x": "nope"},
    })
    assert merged["overlays"]["llmSource"] == "futur-modele"
    assert merged["prefill"]["judge"] == "gpt_5"
    assert merged["ghostJudges"] == {"claude": True, "gpt_5": True}  # non-bool ignoré
    assert merged["v"] == UI_PREFS_SCHEMA_VERSION


# ── endpoint /me ────────────────────────────────────────────────────────────────
def test_me_patch_ui_preferences_partial_and_camelcase(annotator):
    c = APIClient()
    c.force_authenticate(user=annotator)

    # GET initial : ui_preferences vide ({}).
    assert c.get(f"{API}/me").json()["uiPreferences"] == {}

    # PATCH partiel (camelCase, blob verbatim) — auto-prefill armé.
    r = c.patch(
        f"{API}/me",
        {"uiPreferences": {"prefill": {"enabled": True, "judge": "mistral", "asked": True}}},
        format="json",
    )
    assert r.status_code == 200, r.content
    prefs = r.json()["uiPreferences"]
    assert prefs["prefill"] == {"enabled": True, "judge": "mistral", "asked": True}
    assert prefs["overlays"]["showUnfairness"] is True  # défaut complété

    # 2e PATCH ne touchant QUE les overlays → prefill PRÉSERVÉ (merge partiel).
    r2 = c.patch(
        f"{API}/me",
        {"uiPreferences": {"overlays": {"displayLang": "fr", "showUnfairness": False}}},
        format="json",
    )
    prefs2 = r2.json()["uiPreferences"]
    assert prefs2["overlays"]["displayLang"] == "fr"
    assert prefs2["overlays"]["showUnfairness"] is False
    assert prefs2["prefill"]["judge"] == "mistral"  # non écrasé


def test_me_patch_rejects_non_object_prefs(annotator):
    c = APIClient()
    c.force_authenticate(user=annotator)
    r = c.patch(f"{API}/me", {"uiPreferences": "nope"}, format="json")
    assert r.status_code == 400


def test_me_patch_profile_still_works_alongside(annotator):
    c = APIClient()
    c.force_authenticate(user=annotator)
    r = c.patch(f"{API}/me", {"displayName": "Alice X"}, format="json")
    assert r.status_code == 200, r.content
    assert r.json()["displayName"] == "Alice X"

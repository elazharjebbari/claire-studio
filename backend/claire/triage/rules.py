"""Règles de routage du triage — MIROIR Python de frontend/src/lib/triage/rules.ts.

Source de vérité humaine : docs/pactiva/dossier-annotation-assistee/moteur/07-regles-routage.yaml.
Codes CANONIQUES de l'app (ceux que produit normalize_theme_code). Doit rester synchronisé
avec rules.ts — la parité est testée (backend/tests/test_triage_parity.py) sur un golden
PARTAGÉ (frontend/src/lib/triage/golden.cases.json).
"""

from __future__ import annotations

RULES = {
    "version": "1.0.0",
    "refuges": ["PREAMBLE_SCOPE", "MISC_BOILERPLATE"],
    "clusters": [
        ("LICENSE_IP", "USER_CONTENT"),
        ("ACCEPTABLE_USE", "LICENSE_IP"),
        ("ACCEPTABLE_USE", "USER_CONTENT"),
        ("LIMITATION_LIABILITY", "WARRANTY_DISCLAIMER"),
        ("ELIGIBILITY_ACCOUNT", "FEES_PAYMENT"),
        ("ACCEPTABLE_USE", "ELIGIBILITY_ACCOUNT"),
    ],
    "precedence": [
        {"over": "LICENSE_IP", "under": "USER_CONTENT"},
        {"over": "LICENSE_IP", "under": "ACCEPTABLE_USE"},
    ],
    "priority": [
        "ARBITRATION_DISPUTES", "GOVERNING_LAW", "LIMITATION_LIABILITY",
        "WARRANTY_DISCLAIMER", "DMCA", "LICENSE_IP", "USER_CONTENT",
        "PRIVACY_DATA", "FEES_PAYMENT", "ACCEPTABLE_USE", "ELIGIBILITY_ACCOUNT",
        "TERMINATION", "MODIFICATION_OF_TERMS", "THIRD_PARTY_SERVICES",
        "PROMOTIONS", "COMMUNICATIONS", "FEEDBACK", "META", "PREAMBLE_SCOPE",
        "MISC_BOILERPLATE",
    ],
    "reliability_kappa": {
        "ARBITRATION_DISPUTES": 0.73, "FEES_PAYMENT": 0.57, "WARRANTY_DISCLAIMER": 0.48,
        "ELIGIBILITY_ACCOUNT": 0.47, "LICENSE_IP": 0.47, "USER_CONTENT": 0.45,
        "MISC_BOILERPLATE": 0.27, "META": 0.26, "LIMITATION_LIABILITY": 0.24,
        "PREAMBLE_SCOPE": 0.18,
    },
    "theme_aliases": {
        "THIRD_PARTY": "THIRD_PARTY_SERVICES",
        "PAYMENT_BILLING": "FEES_PAYMENT",
        "LIABILITY_LIMITATION": "LIMITATION_LIABILITY",
        "DISPUTE_ARBITRATION": "ARBITRATION_DISPUTES",
        "DEFINITIONS": "PREAMBLE_SCOPE",
        "INDEMNIFICATION": "LIMITATION_LIABILITY",
        "SUBSCRIPTION_RENEWAL": "FEES_PAYMENT",
    },
    "thresholds": {"min_judges": 2},
}

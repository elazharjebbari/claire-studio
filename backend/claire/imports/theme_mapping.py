"""Normalisation of LLM pre-annotation theme codes -> closed scheme codes.

The v9.x pre-annotations use a slightly different / older theme nomenclature
than the canonical vocabulary.yaml (CONTRACT §5). This map reconciles them so
that seeding a human annotation never violates INV-3 (theme in scheme).

Any code already canonical maps to itself implicitly.
"""

# Canonical theme codes (vocabulary.yaml v1).
CANONICAL_THEMES = {
    "META", "PREAMBLE_SCOPE", "PRIVACY_DATA", "ELIGIBILITY_ACCOUNT",
    "ACCEPTABLE_USE", "USER_CONTENT", "LICENSE_IP", "MODIFICATION_OF_TERMS",
    "TERMINATION", "WARRANTY_DISCLAIMER", "LIMITATION_LIABILITY",
    "ARBITRATION_DISPUTES", "GOVERNING_LAW", "THIRD_PARTY_SERVICES",
    "FEES_PAYMENT", "COMMUNICATIONS", "FEEDBACK", "PROMOTIONS", "DMCA",
    "MISC_BOILERPLATE",
}

# Aliases observed in the v9.x pre-annotation corpus -> canonical.
THEME_ALIASES = {
    "THIRD_PARTY": "THIRD_PARTY_SERVICES",
    "PAYMENT_BILLING": "FEES_PAYMENT",
    "LIABILITY_LIMITATION": "LIMITATION_LIABILITY",
    "DISPUTE_ARBITRATION": "ARBITRATION_DISPUTES",
    "DEFINITIONS": "PREAMBLE_SCOPE",
    "INDEMNIFICATION": "LIMITATION_LIABILITY",
    "SUBSCRIPTION_RENEWAL": "FEES_PAYMENT",
}


def normalize_theme_code(code: str) -> str:
    """Map a raw pre-annotation theme code to a canonical scheme code.

    Falls back to MISC_BOILERPLATE for unknown codes so import never fails
    INV-3; callers may inspect the original via the PreClause.theme_code.
    """
    code = (code or "").strip().upper()
    if code in CANONICAL_THEMES:
        return code
    if code in THEME_ALIASES:
        return THEME_ALIASES[code]
    return "MISC_BOILERPLATE"

"""Schémas de fusion candidats — source unique pour les scripts d'analyse.

Les mappings sont documentés et justifiés au fascicule 02 §4. Toute évolution
passe par ce fichier (et, côté Lab, par `docs/pactiva-lab/specs/theme-maps.yaml`
lorsque l'axe `data.theme_map` sera implémenté — protocole 03 §1).
"""
from __future__ import annotations

S1_MAP = {  # T14 — fiabilité ciblée : 4 grappes de confusion résorbées a minima
    "DMCA": "LICENSE_IP", "FEEDBACK": "LICENSE_IP",
    "META": "PREAMBLE_SCOPE", "MISC_BOILERPLATE": "PREAMBLE_SCOPE",
    "PROMOTIONS": "COMMUNICATIONS",
    "GOVERNING_LAW": "ARBITRATION_DISPUTES",
}
S2_MAP = {  # T10 — familles fonctionnelles (viole le garde-fou G sur le risque)
    "META": "FRAMEWORK", "PREAMBLE_SCOPE": "FRAMEWORK",
    "MISC_BOILERPLATE": "FRAMEWORK", "COMMUNICATIONS": "FRAMEWORK",
    "PROMOTIONS": "FRAMEWORK",
    "LICENSE_IP": "CONTENT_IP", "USER_CONTENT": "CONTENT_IP",
    "DMCA": "CONTENT_IP", "FEEDBACK": "CONTENT_IP",
    "LIMITATION_LIABILITY": "RISK_ALLOCATION", "WARRANTY_DISCLAIMER": "RISK_ALLOCATION",
    "ARBITRATION_DISPUTES": "DISPUTES_LAW", "GOVERNING_LAW": "DISPUTES_LAW",
    "ELIGIBILITY_ACCOUNT": "ACCOUNT_USE", "ACCEPTABLE_USE": "ACCOUNT_USE",
}
S3_MAP = dict(S2_MAP)  # T11 — variante recommandée : garanties ≠ responsabilité
del S3_MAP["LIMITATION_LIABILITY"]
del S3_MAP["WARRANTY_DISCLAIMER"]

SCHEMES = {
    "T20-statuquo": {},
    "T14-fiabilite": S1_MAP,
    "T11-fonctionnel-strate": S3_MAP,
    "T10-fonctionnel": S2_MAP,
}


def remap(theme: str, mapping: dict) -> str:
    return mapping.get(theme, theme)


def remap_set(s, mapping: dict) -> frozenset:
    return frozenset(mapping.get(t, t) for t in s)

"""Couleur d'identité déterministe par utilisateur (attribution / présence).

Palette accessible (contraste AA), stable pour un même id → la couleur d'un
annotateur ne change pas d'une session à l'autre. Sert l'overlay d'attribution
(point 3) et la présence collaborative (points 4b/7) sans stocker de couleur.
"""

PALETTE = [
    "#06B6D4",  # cyan
    "#F59E0B",  # amber
    "#A78BFA",  # violet
    "#34D399",  # emerald
    "#F472B6",  # pink
    "#60A5FA",  # blue
]


def user_color(user_id) -> str:
    """Renvoie une couleur stable de la palette pour cet identifiant utilisateur."""
    try:
        n = int(user_id)
    except (TypeError, ValueError):
        n = sum(ord(c) for c in str(user_id or "0"))
    return PALETTE[n % len(PALETTE)]


def display_name(user) -> str:
    """Nom lisible d'un utilisateur (get_full_name → username → id)."""
    if user is None:
        return "—"
    full = (getattr(user, "get_full_name", lambda: "")() or "").strip()
    return full or getattr(user, "username", None) or f"user#{getattr(user, 'pk', '?')}"


def approx_pages(n_sentences: int) -> int:
    """Estimation du nombre de pages d'un document à partir du nombre de phrases.

    Heuristique simple et robuste : ~25 phrases / page (densité typique d'un
    contrat). Toujours >= 1 dès qu'il existe au moins une phrase.
    """
    if not n_sentences or n_sentences <= 0:
        return 0
    return max(1, round(n_sentences / 25))

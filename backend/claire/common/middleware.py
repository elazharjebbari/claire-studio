"""Security headers middleware (security.md §7, A05).

Django's ``SecurityMiddleware`` and ``XFrameOptionsMiddleware`` already cover
HSTS / SSL-redirect / X-Frame-Options when the matching settings are on. This
middleware adds the remaining defensive headers unconditionally (they are safe
in every environment) so the API responses are hardened regardless of the
``SECURE_*`` toggles:

- ``X-Content-Type-Options: nosniff`` — anti MIME-sniffing.
- ``Referrer-Policy`` — limit referrer leakage.
- ``X-Frame-Options: DENY`` — anti-clickjacking (belt-and-braces).

HSTS itself is left to ``SecurityMiddleware`` (prod ``SECURE_HSTS_SECONDS``).
"""

from __future__ import annotations


class SecurityHeadersMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response.setdefault("X-Content-Type-Options", "nosniff")
        response.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        # DENY unless an upstream (XFrameOptionsMiddleware) already set it.
        response.setdefault("X-Frame-Options", "DENY")
        return response


# --------------------------------------------------------------------------- #
# Compte invité (accès reviewer) — périmètre d'API borné
# --------------------------------------------------------------------------- #

# Lecture refusée : tout ce qui n'est pas la consultation des annotations et du gold.
GUEST_DENIED_PREFIXES = (
    "/api/v1/lab",
    "/api/v1/analysis",
    "/api/v1/exports",
    "/api/v1/audit",
    "/api/v1/users",
    "/api/v1/admin",
    "/api/v1/imports",
)
# Écriture autorisée : ses propres sessions (verrou de projet et propriété déjà garantis par les
# vues), l'authentification et ses préférences d'interface.
GUEST_WRITE_ALLOWED_PREFIXES = (
    "/api/v1/annotations",
    "/api/v1/auth/",
    "/api/v1/me",
)
# Sous-ressources COLLABORATIVES des sessions : lecture oui, écriture non (commentaires, revues,
# partage) — l'invité annote son contenu, il n'intervient pas sur celui des autres.
GUEST_WRITE_DENIED_SUFFIXES = ("/comments", "/reviews", "/share", "/share-links", "/steal")
SAFE_METHODS = ("GET", "HEAD", "OPTIONS")


def guest_decision(method: str, path: str) -> str | None:
    """Retourne None si la requête est permise à un invité, sinon un code de refus."""
    if any(path.startswith(p) for p in GUEST_DENIED_PREFIXES):
        return "guest_read_only_scope"
    if method.upper() in SAFE_METHODS:
        return None
    if any(path.startswith(p) for p in GUEST_WRITE_ALLOWED_PREFIXES):
        bare = path.rstrip("/")
        if any(bare.endswith(sfx) or f"{sfx}/" in bare for sfx in GUEST_WRITE_DENIED_SUFFIXES):
            return "guest_no_write"
        return None
    return "guest_no_write"


class GuestAccessMiddleware:
    """Borne l'API pour les comptes `is_guest` (accès reviewer JURIX 2026).

    L'authentification DRF (JWT Bearer) se joue APRÈS les middlewares Django : on décode donc le
    jeton ici, avec la même classe que DRF, et on ne fait rien si la requête n'en porte pas (les
    vues appliqueront leurs propres permissions). Le refus est un 403 JSON explicite ; il ne
    remplace aucune garde existante, il s'ajoute devant."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path
        if path.startswith("/api/v1/") and request.META.get("HTTP_AUTHORIZATION", "").startswith("Bearer "):
            user = self._user(request)
            if user is not None and getattr(user, "is_guest", False):
                code = guest_decision(request.method, path)
                if code:
                    from django.http import JsonResponse
                    return JsonResponse(
                        {"code": code,
                         "detail": "Reviewer account: read access to annotations and gold only."},
                        status=403,
                    )
        return self.get_response(request)

    @staticmethod
    def _user(request):
        try:
            from rest_framework_simplejwt.authentication import JWTAuthentication

            result = JWTAuthentication().authenticate(request)
        except Exception:  # jeton absent, expiré ou invalide : les vues répondront 401
            return None
        return result[0] if result else None

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

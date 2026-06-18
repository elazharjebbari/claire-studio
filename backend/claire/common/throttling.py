"""Rate limiting (security.md §4, A07).

Login is the highest-value brute-force target (threat_model.md §3.1 D), so it
gets a dedicated, strict scope keyed on the client IP. DRF returns ``429`` with
a ``Retry-After`` header automatically once the scope budget is exhausted.
"""

from __future__ import annotations

from rest_framework.throttling import ScopedRateThrottle, SimpleRateThrottle


class LoginRateThrottle(SimpleRateThrottle):
    """Anti brute-force throttle for ``POST /auth/login`` keyed by client IP.

    Uses the ``login`` scope rate from ``DEFAULT_THROTTLE_RATES``. We key on IP
    (not user) because login is unauthenticated; the account-level lockout is a
    complementary control documented in security.md §4.
    """

    scope = "login"

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}


# Re-export DRF's ScopedRateThrottle so views can declare ``throttle_scope``.
__all__ = ["LoginRateThrottle", "ScopedRateThrottle"]

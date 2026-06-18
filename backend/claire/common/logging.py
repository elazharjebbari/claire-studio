"""PII-scrubbing logging filter (security.md §9, rgpd_dpia.md §4 `PIIScrubber`).

A09 (Logging/Monitoring Failures) — structured logs must never carry raw PII.
This filter rewrites the formatted message *and* the positional/dict args of
every ``LogRecord`` so that emails, bearer/JWT tokens and password-like values
come out masked. It is wired in ``LOGGING['filters']`` and attached to every
handler so no log line escapes the scrubbing.
"""

from __future__ import annotations

import logging
import re

# --- patterns ---------------------------------------------------------------
# Email addresses -> local part masked, domain kept for debuggability.
_EMAIL_RE = re.compile(
    r"([A-Za-z0-9._%+\-]+)@([A-Za-z0-9.\-]+\.[A-Za-z]{2,})"
)
# JWT-ish tokens (three base64url segments) and long opaque bearer tokens.
_JWT_RE = re.compile(r"\b[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\b")
_BEARER_RE = re.compile(r"(?i)(bearer\s+)[A-Za-z0-9._\-]+")
# key=value or "key": "value" for sensitive keys (password, token, secret...).
_SECRET_KV_RE = re.compile(
    r"(?i)(password|passwd|pwd|secret|token|authorization|refresh|access)"
    r"(['\"]?\s*[:=]\s*['\"]?)([^\s'\",}]+)"
)

_MASK = "***"


def scrub(text: str) -> str:
    """Return ``text`` with emails, tokens and secret values masked."""
    if not text:
        return text
    text = _SECRET_KV_RE.sub(lambda m: f"{m.group(1)}{m.group(2)}{_MASK}", text)
    text = _BEARER_RE.sub(lambda m: f"{m.group(1)}{_MASK}", text)
    text = _JWT_RE.sub(_MASK, text)
    text = _EMAIL_RE.sub(lambda m: f"{_MASK}@{m.group(2)}", text)
    return text


class PIIScrubber(logging.Filter):
    """Logging filter masking PII in the rendered message and its args."""

    def filter(self, record: logging.LogRecord) -> bool:
        # Render the message with its args, scrub the result, then store it as
        # a plain (arg-less) message. This is robust even when the format
        # string itself contains sensitive keys next to ``%s`` placeholders
        # (scrubbing the raw format string alone would corrupt formatting).
        try:
            rendered = record.getMessage()
        except Exception:  # pragma: no cover - defensive: malformed log call
            rendered = str(record.msg)
        record.msg = scrub(rendered)
        record.args = None
        return True

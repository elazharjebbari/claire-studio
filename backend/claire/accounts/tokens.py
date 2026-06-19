"""Stateless signed tokens for e-mail flows (chantier E).

- Email verification : signed payload (django.core.signing), idempotent, expiring.
- Password reset     : Django's PasswordResetTokenGenerator (one-time — invalidated
  as soon as the password changes) + base64-encoded uid, the standard Django pattern.

No token table needed: both are cryptographically signed and time-bounded.
"""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core import signing
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode

User = get_user_model()

_VERIFY_SALT = "claire.accounts.email-verify"


# ----------------------------------------------------------- email verification
def make_email_verify_token(user) -> str:
    return signing.dumps({"uid": user.pk}, salt=_VERIFY_SALT)


def read_email_verify_token(token: str, max_age: int) -> int | None:
    """Return the user id encoded in ``token`` if valid & fresh, else None."""
    try:
        data = signing.loads(token, salt=_VERIFY_SALT, max_age=max_age)
        return int(data["uid"])
    except (signing.BadSignature, signing.SignatureExpired, KeyError, ValueError, TypeError):
        return None


# -------------------------------------------------------------- password reset
def make_password_reset_pair(user) -> tuple[str, str]:
    """Return (uidb64, token) for a password-reset link."""
    return (
        urlsafe_base64_encode(force_bytes(user.pk)),
        default_token_generator.make_token(user),
    )


def read_password_reset(uidb64: str, token: str):
    """Return the User if (uidb64, token) is a valid, unused reset pair, else None."""
    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = User.objects.get(pk=uid)
    except (User.DoesNotExist, ValueError, TypeError, OverflowError):
        return None
    if not default_token_generator.check_token(user, token):
        return None
    return user

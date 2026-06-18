"""Path-safety helpers (security.md §5, threat_model.md §3.3, A10).

File-based features (translations sync, pre-annotation auto-pull) must confine
all filesystem access to a configured root. We reject:

- absolute paths that escape the root,
- ``..`` traversal,
- resolved paths (symlinks included) that land outside the root.

``TRANSLATIONS_ROOT`` is configured in settings; tests may point it at a tmp
dir. The function returns the safe, resolved :class:`pathlib.Path`.
"""

from __future__ import annotations

from pathlib import Path


class UnsafePathError(ValueError):
    """Raised when a path tries to escape its allowed root."""


def safe_join(root: str | Path, candidate: str | Path) -> Path:
    """Resolve ``candidate`` under ``root``; raise if it escapes the root.

    ``candidate`` may be relative (joined to root) or absolute (must already be
    inside root). Symlinks are resolved before the containment check so an
    outgoing symlink cannot be used to break out.
    """
    root_resolved = Path(root).resolve()
    cand = Path(candidate)

    if ".." in cand.parts:
        raise UnsafePathError(f"Path traversal ('..') is not allowed: {candidate!r}")

    if cand.is_absolute():
        target = cand
    else:
        target = root_resolved / cand

    target_resolved = target.resolve()
    if target_resolved != root_resolved and root_resolved not in target_resolved.parents:
        raise UnsafePathError(
            f"Path {candidate!r} resolves outside the allowed root."
        )
    return target_resolved

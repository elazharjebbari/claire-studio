"""Chargement des règles YAML et vérification du gel (graph/rules/FROZEN.txt)."""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[3]
RULES_DIR = ROOT / "graph" / "rules"
FORBIDDEN = [r"\bLABELED\b", r"\bCategory\b", r"\bunfair", r"\babusive", r"\b(LTD|TER|CH|CR|USE|LAW)\b"]
ALLOWED_FIELDS = {"theme", "actor", "modality", "action", "object_contains", "object_contains_any", "condition",
                  "notice", "remedy", "has_norm", "any"}
ALLOWED_UNLESS = {"related", "exists_in_document", "has_norm", "object_contains"}


class RulesError(RuntimeError):
    pass


@dataclass(frozen=True)
class FrozenEntry:
    sha256: str
    path: str
    version: str
    frozen_at: str
    commit: str


def sha256_of(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_frozen(frozen_path: Path = RULES_DIR / "FROZEN.txt") -> list[FrozenEntry]:
    entries = []
    if not frozen_path.exists():
        return entries
    for line in frozen_path.read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        parts = line.split(None, 4)
        if len(parts) >= 4:
            entries.append(FrozenEntry(parts[0], parts[1], parts[2], parts[3], parts[4] if len(parts) > 4 else ""))
    return entries


def verify_frozen(rules_path: Path, *, population: str | None = None, frozen_path: Path = RULES_DIR / "FROZEN.txt") -> FrozenEntry | None:
    """Retourne l'entrée de gel correspondant au fichier, ou lève RulesError si `population == "holdout"`
    et que le fichier n'est pas gelé (hash absent ou différent)."""
    digest = sha256_of(rules_path)
    rel = str(rules_path.resolve().relative_to(ROOT)) if rules_path.resolve().is_relative_to(ROOT) else str(rules_path)
    for e in read_frozen(frozen_path):
        if e.path == rel and e.sha256 == digest:
            return e
    if population == "holdout":
        raise RulesError(f"règles non gelées pour {rel} (hash {digest[:12]}…) : exécution sur le hold-out refusée")
    return None


def lint_rules_text(text: str) -> list[str]:
    """Étanchéité : aucune référence à l'abusivité dans le corps (hors commentaires)."""
    body = "\n".join(l for l in text.splitlines() if not l.strip().startswith("#"))
    return [pat for pat in FORBIDDEN if re.search(pat, body)]


def load_rules(rules_path: Path = RULES_DIR / "grey_list_queries.yaml", *, population: str | None = None) -> dict:
    text = rules_path.read_text(encoding="utf-8")
    bad = lint_rules_text(text)
    if bad:
        raise RulesError(f"règles non étanches : motifs interdits {bad}")
    data = yaml.safe_load(text)
    for rule in data.get("rules", []):
        for key in rule.get("where", {}):
            if key not in ALLOWED_FIELDS:
                raise RulesError(f"{rule['id']}: champ `where.{key}` non autorisé")
        for u in rule.get("unless", []) or []:
            for key in u:
                if key not in ALLOWED_UNLESS:
                    raise RulesError(f"{rule['id']}: exception `{key}` non autorisée")
    data["_frozen"] = verify_frozen(rules_path, population=population)
    data["_sha256"] = sha256_of(rules_path)
    data["_path"] = str(rules_path)
    return data

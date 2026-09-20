"""Services de la démonstration publique : jeu figé, pseudonymes, garde-fous, comparaison.

Sources de données (toutes en lecture seule) :
- le jeu de données figé du Lab (`var/lab/datasets/<DEMO_DATASET_ID>/`, empreinte 7116e627…) pour
  le texte des 17 contrats hold-out, les votes, le gold, les juges et les labels CLAUDETTE ;
- la spécification des taxonomies (`frontend/src/lib/taxonomy/taxonomies.json`) pour la
  population hold-out et la projection T20 → T11 ;
- `frontend/public/downloads/RELEASE.json` pour les chiffres clés et la carte du modèle.

Invariants : aucun identifiant réel d'annotateur ne sort d'ici (pseudonymes A1, A2, A3 par
ordre alphabétique des identifiants, la même règle que `scripts/build_thematic_layer_release.py`) ;
le texte des phrases n'est servi que pour les documents de la population hold-out.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import re
from collections import Counter, defaultdict
from functools import lru_cache
from pathlib import Path

from django.conf import settings

from claire.imports.models import Judge
from claire.lab.contracts import _taxonomy_spec
from claire.lab.services import lab_storage_root

# Dérivé de la source unique (ordre d'affichage), jamais une liste littérale.
JUDGE_IDS = tuple(Judge.import_judges())
# Modèle réellement servi derrière chaque juge (data/thematic-layer/prompts/README.md).
JUDGE_MODELS = {Judge.FABLE.value: "Claude Fable 5", Judge.CLAUDE.value: "Claude Opus 4.7",
                Judge.MISTRAL.value: "Mistral Medium 3.5", Judge.CODEX.value: "GPT-5.5"}

_STOPWORDS = frozenset("""
the of and to in a is that for you or by with as be on this any are your not will may
shall from at if we our all such other its use terms which these can under have has
without including between provided agree service services account
""".split())


class DemoInputError(ValueError):
    def __init__(self, code: str, detail: str):
        super().__init__(detail)
        self.code = code
        self.detail = detail


# --------------------------------------------------------------------------- #
# Chemins et lectures paresseuses
# --------------------------------------------------------------------------- #

def dataset_dir() -> Path:
    configured = getattr(settings, "DEMO_DATASET_DIR", None)
    if configured:
        return Path(configured)
    return lab_storage_root() / "datasets" / str(getattr(settings, "DEMO_DATASET_ID", ""))


def release_path() -> Path:
    configured = getattr(settings, "DEMO_RELEASE_PATH", None)
    if configured:
        return Path(configured)
    return Path(settings.BASE_DIR).parent / "frontend" / "public" / "downloads" / "RELEASE.json"


def _read_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


@lru_cache(maxsize=1)
def taxonomy_projection() -> dict[str, str]:
    """T20 → T11 (membres des catégories T11)."""
    spec = _taxonomy_spec()
    for tax in spec.get("taxonomies", []):
        if tax.get("id") == "T11":
            return {m: c["code"] for c in tax["categories"] for m in c.get("members", [c["code"]])}
    return {}


@lru_cache(maxsize=1)
def holdout_documents() -> tuple[str, ...]:
    spec = _taxonomy_spec()
    docs = (spec.get("populations") or {}).get("holdout") or []
    if isinstance(docs, dict):
        docs = docs.get("documents", [])
    return tuple(sorted(docs))


def reset_caches() -> None:
    """Pour les tests : les fixtures changent de dossier de données entre deux cas."""
    taxonomy_projection.cache_clear()
    holdout_documents.cache_clear()
    _corpus.cache_clear()


@lru_cache(maxsize=1)
def _corpus() -> dict:
    """Charge une fois le jeu figé (≈ 18 Mo) et l'indexe par document."""
    root = dataset_dir()
    sentences = defaultdict(list)
    for row in _read_jsonl(root / "sentences.jsonl"):
        sentences[row["document"]].append(row)
    for rows in sentences.values():
        rows.sort(key=lambda r: r["index"])
    votes = defaultdict(list)
    identifiers: set[str] = set()
    for row in _read_jsonl(root / "votes.jsonl"):
        votes[(row["document"], row["index"])].append(row)
        identifiers.add(row["annotator"])
    gold = {(r["document"], r["index"]): r for r in _read_jsonl(root / "gold.jsonl")}
    judges = defaultdict(dict)
    for row in _read_jsonl(root / "judges.jsonl"):
        judges[(row["document"], row["index"])][row["judge"]] = row.get("theme")
    reference = defaultdict(list)
    for row in _read_jsonl(root / "reference.jsonl"):
        reference[(row["document"], row["index"])].append(row["category"])
    pseudonyms = {name: f"A{k}" for k, name in enumerate(sorted(identifiers), start=1)}
    return {"sentences": sentences, "votes": votes, "gold": gold, "judges": judges,
            "reference": reference, "pseudonyms": pseudonyms}


# --------------------------------------------------------------------------- #
# Contrats hold-out
# --------------------------------------------------------------------------- #

def list_contracts() -> list[dict]:
    corpus = _corpus()
    out = []
    for doc in holdout_documents():
        rows = corpus["sentences"].get(doc)
        if not rows:
            continue
        out.append({"document": doc, "n_sentences": len(rows),
                    "n_unfair": sum(1 for r in rows if r.get("unfair"))})
    return out


def contract_sentences(document: str) -> list[str]:
    if document not in holdout_documents():
        raise DemoInputError("unknown_document", "This document is not part of the held-out set.")
    rows = _corpus()["sentences"].get(document) or []
    if not rows:
        raise DemoInputError("unknown_document", "This document is not available.")
    return [r.get("text_detok") or r["text"] for r in rows]


def display_text(text: str) -> str:
    """Texte lisible pour l'écran : les artefacts de tokenisation CLAUDETTE (-lrb-, ``, '' …) sont
    résolus avec les règles de l'import du corpus. L'entrée du modèle, elle, reste le texte du jeu
    figé (celui de l'entraînement)."""
    from claire.corpora.loaders import clean_sentence

    return clean_sentence(text)


def contract_detail(document: str) -> dict:
    """Phrases (texte à l'écran), gold, votes pseudonymisés, juges, labels CLAUDETTE."""
    texts = [display_text(t) for t in contract_sentences(document)]
    corpus = _corpus()
    projection = taxonomy_projection()
    pseud = corpus["pseudonyms"]
    out = []
    for i, text in enumerate(texts):
        key = (document, i)
        g = corpus["gold"].get(key) or {}
        primary = g.get("decided_primary") or g.get("proposed_primary")
        out.append({
            "index": i,
            "text": text,
            "gold": {
                "primary": primary,
                "primary_t11": projection.get(primary, primary) if primary else None,
                "secondaries": g.get("decided_secondaries") or [],
                "agreement_class": g.get("agreement_class"),
                "tier": g.get("auto_level"),
                "confidence": g.get("confidence"),
                "tally": g.get("tally") or {},
            } if g else None,
            "votes": [{"annotator": pseud[v["annotator"]], "primary": v["primary"],
                       "secondaries": v.get("secondaries") or []}
                      for v in sorted(corpus["votes"].get(key, []), key=lambda v: pseud[v["annotator"]])],
            "judges": {j: corpus["judges"].get(key, {}).get(j) for j in JUDGE_IDS},
            "unfair": sorted(corpus["reference"].get(key, [])),
        })
    return {"document": document, "taxonomy": "T20", "sentences": out,
            "judges_legend": {j: JUDGE_MODELS.get(j, j) for j in JUDGE_IDS}}


# --------------------------------------------------------------------------- #
# Garde-fous d'entrée
# --------------------------------------------------------------------------- #

def english_share(text: str) -> float:
    sample = text[:2000].lower()
    tokens = re.findall(r"[a-z']+", sample)
    if not tokens:
        return 0.0
    return sum(1 for t in tokens if t in _STOPWORDS) / len(tokens)


def validate_text(text: str) -> str:
    text = (text or "").replace("\r\n", "\n").strip()
    if not text:
        raise DemoInputError("empty", "Paste or upload some text first.")
    max_chars = int(getattr(settings, "DEMO_MAX_CHARS", 60000))
    if len(text) > max_chars:
        raise DemoInputError("too_long", f"This text exceeds {max_chars:,} characters. Please shorten it.")
    if english_share(text) < float(getattr(settings, "DEMO_MIN_ENGLISH_SHARE", 0.05)):
        raise DemoInputError("not_english",
                             "The classifier was trained on English contracts; please provide English text.")
    return text


def client_hash(request) -> str:
    """HMAC (clé serveur) de l'adresse tronquée : /24 en IPv4, /48 en IPv6."""
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    address = (forwarded.split(",")[0].strip() if forwarded else request.META.get("REMOTE_ADDR", "")) or ""
    if ":" in address:
        truncated = ":".join(address.split(":")[:3])
    else:
        truncated = ".".join(address.split(".")[:3])
    digest = hmac.new(settings.SECRET_KEY.encode("utf-8"), truncated.encode("utf-8"), hashlib.sha256)
    return digest.hexdigest()[:32]


# --------------------------------------------------------------------------- #
# Comparaison avec la référence (contrats hold-out)
# --------------------------------------------------------------------------- #

def cohen_kappa(a: list[str], b: list[str]) -> float | None:
    n = len(a)
    if n == 0:
        return None
    agree = sum(1 for x, y in zip(a, b) if x == y) / n
    ca, cb = Counter(a), Counter(b)
    expected = sum(ca[k] * cb.get(k, 0) for k in ca) / (n * n)
    if expected >= 1.0:
        return 1.0
    return round((agree - expected) / (1 - expected), 4)


def comparison(document: str, predicted: list[dict]) -> dict:
    """Aligne les prédictions (T11) sur gold, votes et juges (T20 projeté en T11)."""
    detail = contract_detail(document)
    projection = taxonomy_projection()
    by_index = {s["index"]: s for s in detail["sentences"]}
    gold_rows, vote_rows, judge_rows = [], [], []
    pred_t11, gold_t11 = [], []
    judges_pred: dict[str, list[str]] = {j: [] for j in JUDGE_IDS}
    for p in predicted:
        s = by_index.get(p["index"])
        if not s or not s["gold"]:
            continue
        g11 = s["gold"]["primary_t11"]
        pred_t11.append(p["label"])
        gold_t11.append(g11)
        gold_rows.append({"index": p["index"], "primary_t20": s["gold"]["primary"], "primary_t11": g11,
                          "agreement_class": s["gold"]["agreement_class"], "tier": s["gold"]["tier"],
                          "secondaries": s["gold"]["secondaries"]})
        vote_rows.append({"index": p["index"], **{v["annotator"]: v["primary"] for v in s["votes"]}})
        row = {"index": p["index"]}
        for j in JUDGE_IDS:
            theme = s["judges"].get(j)
            row[j] = theme
            judges_pred[j].append(projection.get(theme, theme) if theme else None)
        judge_rows.append(row)
    n = len(pred_t11)
    summary = {
        "n_sentences": n,
        "accuracy_t11": round(sum(1 for a, b in zip(pred_t11, gold_t11) if a == b) / n, 4) if n else None,
        "kappa_t11": cohen_kappa(pred_t11, gold_t11) if n else None,
        "judges_accuracy_t11": {
            j: (round(sum(1 for a, b in zip(judges_pred[j], gold_t11) if a == b) / n, 4) if n else None)
            for j in JUDGE_IDS
        },
    }
    return {"gold": gold_rows, "votes": vote_rows, "judges": judge_rows, "summary": summary,
            "judges_legend": detail["judges_legend"]}


# --------------------------------------------------------------------------- #
# Manifeste
# --------------------------------------------------------------------------- #

def manifest() -> dict:
    path = release_path()
    release = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    return {
        "dataset_fingerprint": release.get("datasetFingerprint"),
        "release": {"version": release.get("version"), "built_at": release.get("builtAt")},
        "counts": release.get("counts") or {},
        "zip": release.get("zip"),
        "downloads": release.get("downloads") or [],
        "judges": release.get("judges") or [],
        "figures": release.get("figures") or [],
        "model": release.get("model"),
        "limits": {"max_chars": int(getattr(settings, "DEMO_MAX_CHARS", 60000)),
                   "max_sentences": int(getattr(settings, "DEMO_MAX_SENTENCES", 400)),
                   "language": "en"},
        "access_code_required": bool(getattr(settings, "DEMO_ACCESS_CODE", "")),
        "model_available": Path(str(getattr(settings, "DEMO_MODEL_DIR", ""))).joinpath("model_config.json").exists(),
        "holdout_documents": list(holdout_documents()),
        "reviewer_access": reviewer_access(),
    }


def reviewer_access() -> dict | None:
    """Identifiants du compte invité, servis seulement si le porteur l'a rendu public."""
    if not getattr(settings, "DEMO_REVIEWER_PUBLIC", False):
        return None
    password = getattr(settings, "DEMO_REVIEWER_PASSWORD", "") or ""
    if not password:
        return None
    return {"username": getattr(settings, "DEMO_REVIEWER_USERNAME", "jurix-reviewer"), "password": password,
            "campaign": "campagne-pactiva", "sandbox": "jurix2026-sandbox"}

"""Inférence sur un texte NOUVEAU : segmentation en phrases, même prétraitement que
l'entraînement (détokenisation + fenêtre de contexte), prédiction du thème par phrase.

Sert la démonstration publique (page reviewer) : un contrat collé ou un document CLAUDETTE
tenu à l'écart de l'entraînement → une liste de phrases avec thème prédit, confiance et
distribution. Aucune dépendance à Django ; s'exécute dans `research/.venv`
(`python -m pactiva_lab predict --model DIR --input in.json --out out.json`).

Invariants :
- le texte d'entrée d'une phrase est rendu par `preprocess.pipeline.build_text` avec la
  configuration `preprocess` enregistrée dans `model_config.json` — la fenêtre de contexte
  (±1 phrase) et la détokenisation sont donc IDENTIQUES à l'entraînement ;
- la segmentation est déterministe ; pysbd (règles, sans modèle) si disponible, sinon un
  découpage par ponctuation forte, déclaré dans la sortie (`segmenter`) ;
- rien n'est écrit ailleurs que dans `--out` ; le texte collé ne quitte pas le processus.
"""

from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass
from pathlib import Path

from .preprocess.pipeline import build_text

MAX_SENTENCES = 600           # borne dure : un contrat CLAUDETTE compte au plus ~450 phrases
MAX_CHARS = 200_000


@dataclass
class _Item:
    """Le strict nécessaire pour `build_text` (mêmes attributs que `data.Sentence`)."""
    document: str
    index: int
    text: str
    text_detok: str


# --------------------------------------------------------------------------- #
# Segmentation
# --------------------------------------------------------------------------- #

_FALLBACK_SPLIT = re.compile(r"(?<=[.!?;])\s+(?=[A-Z0-9(\"'“])")
_LINE_BREAKS = re.compile(r"\n\s*\n+")


def _normalise(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t ]+", " ", text)
    return text.strip()


def segment(text: str) -> tuple[list[str], str]:
    """Découpe `text` en phrases ; retourne (phrases, nom du segmenteur).

    Les paragraphes (lignes vides) sont des frontières dures : un titre de section ou un
    élément de liste reste une unité, comme dans CLAUDETTE où chaque ligne est une phrase.
    """
    text = _normalise(text)[:MAX_CHARS]
    if not text:
        return [], "none"
    paragraphs = [p.strip() for p in _LINE_BREAKS.split(text) if p.strip()]
    try:
        import pysbd  # type: ignore

        splitter = pysbd.Segmenter(language="en", clean=False)
        name = "pysbd"

        def split(par: str) -> list[str]:
            return [s.strip() for s in splitter.segment(par) if s.strip()]
    except Exception:  # pragma: no cover - repli sans dépendance
        name = "punctuation_rules"

        def split(par: str) -> list[str]:
            return [s.strip() for s in _FALLBACK_SPLIT.split(par) if s.strip()]

    sentences: list[str] = []
    for par in paragraphs:
        lines = [l.strip() for l in par.split("\n") if l.strip()]
        for line in lines:
            sentences.extend(split(line))
            if len(sentences) >= MAX_SENTENCES:
                return sentences[:MAX_SENTENCES], name
    return sentences, name


# --------------------------------------------------------------------------- #
# Prédiction
# --------------------------------------------------------------------------- #

def _load(model_dir: Path):
    from .models.heavy import TransformerFinetune

    meta = json.loads((model_dir / "model_config.json").read_text(encoding="utf-8"))
    preprocess = (meta.get("preprocess") or meta["config"].get("preprocess")
                  or {"detokenize": "regex_rules", "max_length": 128,
                      "context": {"window_before": 1, "window_after": 1}})
    return TransformerFinetune.load(model_dir), preprocess, meta


def predict_sentences(model_dir: str | Path, sentences: list[str], *, document: str = "input",
                      model=None, preprocess: dict | None = None) -> dict:
    """Prédit le thème de chaque phrase (contexte ±1 borné au document)."""
    started = time.time()
    model_dir = Path(model_dir)
    if model is None or preprocess is None:
        model, preprocess, _ = _load(model_dir)
    items = [_Item(document, i, s, s) for i, s in enumerate(sentences)]
    texts = [build_text(it, neighbours=items, config=preprocess) for it in items]
    scores = model.predict_proba(texts) if texts else []
    rows = []
    for it, dist in zip(items, scores):
        label = max(dist, key=dist.get)
        ordered = sorted(dist.items(), key=lambda kv: -kv[1])
        rows.append({
            "index": it.index,
            "text": it.text,
            "label": label,
            "confidence": round(dist[label], 6),
            "scores": {k: round(v, 6) for k, v in ordered[:5]},
        })
    return {
        "document": document,
        "n_sentences": len(rows),
        "classes": list(model.classes),
        "sentences": rows,
        "timing_s": round(time.time() - started, 3),
    }


def predict_text(model_dir: str | Path, text: str, *, document: str = "input") -> dict:
    sentences, segmenter = segment(text)
    out = predict_sentences(model_dir, sentences, document=document)
    out["segmenter"] = segmenter
    return out


def run_cli(model_dir: str, input_path: str, out_path: str) -> dict:
    """Entrée : `{"text": "..."}` OU `{"sentences": ["...", ...], "document": "..."}`."""
    payload = json.loads(Path(input_path).read_text(encoding="utf-8"))
    document = str(payload.get("document") or "input")
    if payload.get("sentences") is not None:
        result = predict_sentences(model_dir, [str(s) for s in payload["sentences"]], document=document)
        result["segmenter"] = "provided"
    else:
        result = predict_text(model_dir, str(payload.get("text") or ""), document=document)
    meta = json.loads((Path(model_dir) / "model_config.json").read_text(encoding="utf-8"))
    result["model"] = {"checkpoint": meta.get("checkpoint"), "family": meta.get("family"),
                       "seed": meta.get("seed")}
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    Path(out_path).write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    return result

"""CLAUDETTE loader (feature 12): txt + label files -> Document/Sentence/ReferenceLabel.

Data layout (data/raw/claudette_tos/):
- Sentences/<Doc>.txt        : one tokenised sentence per line (index = line no.)
- Labels_<CAT>/<Doc>.txt     : one value per line aligned to sentence index
                               (-1 = none, 1/2/3 = unfairness level)
Categories: A, CH, CR, J, LAW, LTD, TER, USE.

Enforces INV-1 (contiguous indices 0..n-1) in an atomic transaction.
"""

from __future__ import annotations

import hashlib
import logging
import re
from pathlib import Path

from django.db import transaction

from claire.common.models import UNFAIRNESS_CATEGORIES
from claire.common.persistence import update_or_create_changed
from claire.corpora.models import Corpus, Document, ReferenceLabel, Sentence

logger = logging.getLogger("claire.corpora")

# Detokenisation of CLAUDETTE PTB-style tokens for the "clean" text.
_DETOK = {
    " -lrb- ": " (",
    " -rrb- ": ") ",
    "-lrb-": "(",
    "-rrb-": ")",
    " 's": "'s",
    " n't": "n't",
    " ,": ",",
    " .": ".",
    " ;": ";",
    " :": ":",
    " '": "'",
    " `` ": ' "',
    " '' ": '" ',
    "``": '"',
    "''": '"',
}


def clean_sentence(raw: str) -> str:
    text = raw.strip()
    for k, v in _DETOK.items():
        text = text.replace(k, v)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def read_label_file(path: Path) -> list[int]:
    if not path.exists():
        return []
    values: list[int] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line == "":
            continue
        try:
            values.append(int(line))
        except ValueError:
            values.append(-1)
    return values


@transaction.atomic
def load_claudette_document(corpus: Corpus, claudette_dir: Path, doc_name: str) -> Document:
    """Load one CLAUDETTE document with its sentences and reference labels."""
    claudette_dir = Path(claudette_dir)
    sent_path = claudette_dir / "Sentences" / f"{doc_name}.txt"
    if not sent_path.exists():
        raise FileNotFoundError(f"Missing Sentences file: {sent_path}")

    raw_lines = [
        ln for ln in sent_path.read_text(encoding="utf-8").splitlines() if ln.strip() != ""
    ]
    n = len(raw_lines)
    checksum = hashlib.sha256(sent_path.read_text(encoding="utf-8").encode("utf-8")).hexdigest()

    document, _ = update_or_create_changed(
        Document,
        corpus=corpus,
        external_id=doc_name,
        defaults={
            "title": doc_name,
            "language": "en",
            "n_sentences": n,
            "checksum": checksum,
            "source_meta": {"loader": "claudette", "source_file": str(sent_path.name)},
        },
    )

    # Idempotency: if the document is already loaded identically, do nothing.
    # We must not delete sentences that are referenced by clauses (PROTECT).
    existing = list(document.sentences.values_list("index", flat=True))
    if sorted(existing) == list(range(n)):
        logger.info("claudette_skip_unchanged doc=%s sentences=%d", doc_name, n)
        return document

    if document.clauses_exist():
        raise ValueError(f"Refusing to reload {doc_name}: sentences are referenced by clauses.")
    document.sentences.all().delete()

    sentences = [
        Sentence(
            document=document,
            index=i,
            raw_text=raw.strip(),
            clean_text=clean_sentence(raw),
        )
        for i, raw in enumerate(raw_lines)
    ]
    Sentence.objects.bulk_create(sentences)

    # INV-1 verification.
    persisted = list(document.sentences.values_list("index", flat=True))
    if sorted(persisted) != list(range(n)):
        raise ValueError(f"INV-1 violated for {doc_name}: indices not contiguous 0..{n - 1}")

    # Reference labels per category.
    sentence_map = {s.index: s for s in document.sentences.all()}
    ref_labels: list[ReferenceLabel] = []
    for cat in UNFAIRNESS_CATEGORIES:
        values = read_label_file(claudette_dir / f"Labels_{cat}" / f"{doc_name}.txt")
        for idx, val in enumerate(values):
            if val in (1, 2, 3) and idx in sentence_map:
                ref_labels.append(
                    ReferenceLabel(
                        sentence=sentence_map[idx],
                        category=cat,
                        level=val,
                        source="claudette",
                    )
                )
    ReferenceLabel.objects.bulk_create(ref_labels)

    logger.info(
        "claudette_loaded doc=%s sentences=%d ref_labels=%d",
        doc_name,
        n,
        len(ref_labels),
    )
    return document


def list_available_documents(claudette_dir: Path) -> list[str]:
    sent_dir = Path(claudette_dir) / "Sentences"
    if not sent_dir.exists():
        return []
    return sorted(p.stem for p in sent_dir.glob("*.txt"))

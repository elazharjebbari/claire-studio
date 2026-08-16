"""Dataset jouet — reproduit en miniature les propriétés du corpus réel.

Trois propriétés sont délibérément reproduites, parce que ce sont elles qui font échouer
les implémentations naïves :

* **longue traîne** : un thème dominant, un thème très rare (comme `FEEDBACK` à 0,34 %) ;
* **structure positionnelle** : les thèmes viennent par blocs, comme dans un vrai ToS ;
* **documents de tailles très inégales** : de 8 à 40 phrases (le corpus va de 60 à 548).
"""

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

THEMES = [
    "PREAMBLE_SCOPE", "ELIGIBILITY_ACCOUNT", "ACCEPTABLE_USE", "USER_CONTENT",
    "LICENSE_IP", "FEES_PAYMENT", "TERMINATION", "LIMITATION_LIABILITY",
    "ARBITRATION_DISPUTES", "FEEDBACK",
]

DOCUMENTS = {
    "Atlas": 8, "Google": 12, "Netflix": 16, "9gag": 20, "Academia": 24,
    "Airbnb": 40, "Uber": 14, "Dropbox": 18, "Spotify": 22, "eBay": 26,
}


def _theme_for(position: float, seed: int) -> str:
    """Thème d'une phrase selon sa position : un ToS suit un ordre très régulier."""
    zones = [
        "PREAMBLE_SCOPE", "PREAMBLE_SCOPE", "ELIGIBILITY_ACCOUNT", "ACCEPTABLE_USE",
        "USER_CONTENT", "LICENSE_IP", "FEES_PAYMENT", "TERMINATION",
        "LIMITATION_LIABILITY", "ARBITRATION_DISPUTES",
    ]
    zone = zones[min(9, int(position * 10))]
    # Une phrase sur onze porte le thème rare : reproduit la longue traîne.
    return "FEEDBACK" if seed % 11 == 0 else zone


def build_toy_dataset(root: Path, *, k: int = 5, n_annotators: int = 2) -> Path:
    root.mkdir(parents=True, exist_ok=True)
    rows = []
    counter = 0
    for document, n in sorted(DOCUMENTS.items()):
        previous = None
        for index in range(n):
            counter += 1
            position = index / max(1, n - 1)
            theme = _theme_for(position, counter)
            themes = [theme]
            if counter % 7 == 0 and theme != "LIMITATION_LIABILITY":
                themes.append("LIMITATION_LIABILITY")
            rows.append(
                {
                    "document": document,
                    "index": index,
                    "text": f"the provider may {theme.lower()} at any time .",
                    "text_detok": f"The provider may {theme.lower()} at any time.",
                    "doc_position": round(position, 6),
                    "n_sentences": n,
                    "primary": theme,
                    "themes": themes,
                    "boundary": tuple(themes) != previous,
                    "n_annotators": n_annotators,
                    "agreement": "strict" if counter % 3 else "majority",
                    "confidence": 0.9,
                    "unfair": ["LTD"] if theme == "LIMITATION_LIABILITY" else [],
                    "source_maturity": "complete",
                }
            )
            previous = tuple(themes)

    documents = sorted(DOCUMENTS)
    folds = [sorted(documents[i::k]) for i in range(k)]

    with (root / "sentences.jsonl").open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row) + "\n")

    with (root / "judges.jsonl").open("w", encoding="utf-8") as handle:
        for position, row in enumerate(rows):
            for judge in ("fable", "claude", "codex", "mistral"):
                # Chaque juge se trompe à une cadence différente : reproduit le fait que
                # les juges ne s'accordent qu'à 34–81 % entre eux.
                wrong = position % {"fable": 4, "claude": 5, "codex": 3, "mistral": 2}[judge] == 0
                handle.write(
                    json.dumps(
                        {
                            "document": row["document"],
                            "index": row["index"],
                            "judge": judge,
                            "theme": "MISC_BOILERPLATE" if wrong else row["primary"],
                            "is_segment_start": row["boundary"],
                        }
                    )
                    + "\n"
                )

    (root / "reference.jsonl").write_text("", encoding="utf-8")

    # Votes bruts (matière de M1) : deux annotateurs sur 4 documents, un troisième sur
    # Atlas (triple). Le désaccord est déterministe : bob change le primaire d'une
    # phrase sur 4 et ajoute un secondaire une phrase sur 5 — assez pour que MASI,
    # nominal, frontières et divergence aient tous quelque chose à mesurer.
    multi_docs = ["9gag", "Atlas", "Google", "Netflix"]
    with (root / "votes.jsonl").open("w", encoding="utf-8") as handle:
        for position, row in enumerate(rows):
            handle.write(json.dumps({
                "document": row["document"], "index": row["index"],
                "annotator": "alice", "primary": row["primary"],
                "secondaries": [t for t in row["themes"] if t != row["primary"]],
            }) + "\n")
            if row["document"] not in multi_docs:
                continue
            primary = "PREAMBLE_SCOPE" if position % 4 == 0 else row["primary"]
            secondaries = [t for t in row["themes"] if t != row["primary"]]
            if position % 5 == 0 and "FEEDBACK" not in secondaries and primary != "FEEDBACK":
                secondaries = [*secondaries, "FEEDBACK"]
            handle.write(json.dumps({
                "document": row["document"], "index": row["index"],
                "annotator": "bob", "primary": primary,
                "secondaries": sorted(secondaries),
            }) + "\n")
            if row["document"] == "Atlas":
                handle.write(json.dumps({
                    "document": row["document"], "index": row["index"],
                    "annotator": "carol", "primary": row["primary"],
                    "secondaries": [],
                }) + "\n")

    # Cascade gold (matière de M2) sur Atlas : 4 unanimes, 2 majorité, 1 arbitrage qui
    # CONTREDIT la pluralité, 1 conflit non tranché. Rien de finalisé (comme en prod).
    atlas = [row for row in rows if row["document"] == "Atlas"]
    with (root / "gold.jsonl").open("w", encoding="utf-8") as handle:
        for index, row in enumerate(atlas):
            if index < 4:
                tier, decided, primary = "auto_1click", True, row["primary"]
            elif index < 6:
                tier, decided, primary = "auto", True, row["primary"]
            elif index == 6:
                tier, decided, primary = "manual", True, "ARBITRATION_DISPUTES"
            else:
                tier, decided, primary = "manual", False, ""
            handle.write(json.dumps({
                "document": "Atlas", "index": row["index"],
                "agreement_class": {"auto_1click": "strict", "auto": "majority",
                                    "manual": "divergence"}[tier],
                "auto_level": tier, "risk_band": "low",
                "proposed_primary": row["primary"], "proposed_secondaries": [],
                "decided": decided, "auto_resolved": tier != "manual",
                "decided_primary": primary, "decided_secondaries": [],
                "tally": {}, "confidence": 0.8, "finalized": False,
            }) + "\n")
    (root / "splits.json").write_text(
        json.dumps(
            {
                "scheme": "group_kfold_document", "k": k, "seed": 42, "folds": folds,
                "foldSizes": [sum(DOCUMENTS[d] for d in fold) for fold in folds],
                "foldDocumentCounts": [len(fold) for fold in folds],
                "rationale": "groupement par document",
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    (root / "labels.json").write_text(
        json.dumps([{"code": t, "support_primary": 0, "support_secondary": 0} for t in THEMES]),
        encoding="utf-8",
    )
    (root / "manifest.json").write_text(
        json.dumps(
            {
                "contractVersion": 1, "project": "toy", "fingerprint": "toy-fingerprint",
                "criteria": {"maturity": "complete", "aggregation": "consensus", "seed": 42},
                "nDocuments": len(DOCUMENTS), "nSentences": len(rows),
                "nAnnotations": len(DOCUMENTS) * n_annotators, "nLabels": len(THEMES),
                "multiLabelRate": 0.14, "excluded": [], "excludedSummary": {},
                "labelDistribution": {}, "coverage": {},
                "judges": ["fable", "claude", "codex", "mistral"], "nUnfairSentences": 0,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    return root


@pytest.fixture
def toy_dataset(tmp_path):
    return build_toy_dataset(tmp_path / "dataset")


@pytest.fixture
def base_config():
    return {
        "version": 1,
        "task": "T1_primary",
        "seed": 42,
        "preprocess": {"detokenize": "regex_rules", "case": "lower", "max_length": 64},
        "model": {"family": "tfidf_linear", "ngram_max": 1, "min_df": 1},
        "evaluation": {
            "split": {"scheme": "group_kfold_document", "k": 5},
            "bootstrap": {"enabled": False},
            "human_ceiling": True,
            "error_analysis": True,
        },
    }

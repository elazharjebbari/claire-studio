"""Chargement d'un dataset et application des plis figés."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Sentence:
    document: str
    index: int
    text: str
    text_detok: str
    doc_position: float
    n_sentences: int
    primary: str
    themes: list[str]
    boundary: bool
    n_annotators: int
    agreement: str
    unfair: list[str] = field(default_factory=list)
    soft: dict[str, float] = field(default_factory=dict)

    @property
    def key(self) -> tuple[str, int]:
        return (self.document, self.index)


@dataclass
class Dataset:
    root: Path
    manifest: dict
    splits: dict
    sentences: list[Sentence]
    labels: list[str]
    judges: dict[tuple[str, int], dict[str, str]]

    @property
    def documents(self) -> list[str]:
        return sorted({s.document for s in self.sentences})

    @property
    def folds(self) -> list[list[str]]:
        return self.splits["folds"]

    def fold_indices(self, fold: int) -> tuple[list[int], list[int]]:
        """(indices d'entraînement, indices de test) pour le pli `fold`.

        Le test est l'ensemble des phrases des documents du pli — c'est le groupement par
        document, appliqué tel que le dataset l'a figé. Rien n'est recalculé ici : deux
        modèles ne sont comparables que sur des plis identiques.
        """
        test_documents = set(self.folds[fold])
        train, test = [], []
        for position, sentence in enumerate(self.sentences):
            (test if sentence.document in test_documents else train).append(position)
        return train, test

    def subsample_documents(
        self, n: int, *, seed: int = 0, pool: list[str] | None = None
    ) -> list[str]:
        """Sous-échantillon reproductible de documents — support de la courbe
        d'apprentissage. Le tirage passe par SHA-256 et non `random`, pour rester stable
        d'une machine et d'une version de Python à l'autre.

        `pool` restreint le tirage à un sous-ensemble de documents (typiquement les
        documents d'ENTRAÎNEMENT d'un pli donné) — sans lui, une courbe d'apprentissage
        pourrait piocher des documents qui appartiennent au pli de TEST courant, une
        fuite entre train et test que `fold_indices` existe justement pour empêcher."""
        documents = pool if pool is not None else self.documents
        ordered = sorted(
            documents,
            key=lambda d: hashlib.sha256(f"{seed}:{d}".encode()).hexdigest(),
        )
        return sorted(ordered[: max(1, min(n, len(documents)))])


def load_dataset(root: str | Path) -> Dataset:
    """Charge un dossier de dataset et vérifie sa cohérence.

    La validation des plis se fait au CHARGEMENT et non seulement à la construction : un
    dataset corrompu ou tronqué pendant un transfert vers Grid'5000 doit être détecté
    avant l'entraînement, pas après quatre heures de GPU.
    """
    root = Path(root)
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    splits = json.loads((root / "splits.json").read_text(encoding="utf-8"))
    labels = [row["code"] for row in json.loads((root / "labels.json").read_text("utf-8"))]

    sentences: list[Sentence] = []
    with (root / "sentences.jsonl").open(encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            row = json.loads(line)
            sentences.append(
                Sentence(
                    document=row["document"],
                    index=row["index"],
                    text=row["text"],
                    text_detok=row.get("text_detok", row["text"]),
                    doc_position=row.get("doc_position", 0.0),
                    n_sentences=row.get("n_sentences", 0),
                    primary=row["primary"],
                    themes=row["themes"],
                    boundary=bool(row.get("boundary")),
                    n_annotators=row.get("n_annotators", 1),
                    agreement=row.get("agreement", ""),
                    unfair=row.get("unfair", []),
                    soft=row.get("soft", {}),
                )
            )

    judges: dict[tuple[str, int], dict[str, str]] = {}
    judges_path = root / "judges.jsonl"
    if judges_path.exists():
        with judges_path.open(encoding="utf-8") as handle:
            for line in handle:
                if not line.strip():
                    continue
                row = json.loads(line)
                judges.setdefault((row["document"], row["index"]), {})[row["judge"]] = row["theme"]

    dataset = Dataset(
        root=root, manifest=manifest, splits=splits,
        sentences=sentences, labels=labels, judges=judges,
    )
    _validate(dataset)
    return dataset


def load_votes(root: str | Path) -> list[dict]:
    """Votes bruts par annotateur (`votes.jsonl`) — matière des mesures d'accord (M1).

    Une ligne = {document, index, annotator, primary, secondaries}. Fichier absent →
    liste vide (les datasets construits avant l'export des votes restent chargeables ;
    c'est la tâche M1 qui refuse alors de tourner, avec un message explicite — jamais
    un résultat silencieusement vide).
    """
    path = Path(root) / "votes.jsonl"
    if not path.exists():
        return []
    rows: list[dict] = []
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            if line.strip():
                rows.append(json.loads(line))
    return rows


def load_gold(root: str | Path) -> list[dict]:
    """État de la cascade gold par phrase (`gold.jsonl`) — matière de M2.

    Exporté y compris NON finalisé : l'aperçu doit montrer « 0 résolution finalisée »,
    pas le masquer. Fichier absent → liste vide (datasets antérieurs).
    """
    path = Path(root) / "gold.jsonl"
    if not path.exists():
        return []
    rows: list[dict] = []
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            if line.strip():
                rows.append(json.loads(line))
    return rows


def _validate(dataset: Dataset) -> None:
    if not dataset.sentences:
        raise ValueError("dataset vide")
    if dataset.splits.get("scheme") != "group_kfold_document":
        raise ValueError(
            f"schéma de découpage inattendu : {dataset.splits.get('scheme')!r}. "
            "Seul le groupement par document est admis (sinon fuite entre train et test)."
        )
    documents = set(dataset.documents)
    seen: set[str] = set()
    for fold in dataset.folds:
        for document in fold:
            if document in seen:
                raise ValueError(f"document présent dans deux plis : {document}")
            seen.add(document)
    if seen != documents:
        raise ValueError(
            f"plis incohérents avec les données "
            f"(manquants={sorted(documents - seen)}, en trop={sorted(seen - documents)})"
        )

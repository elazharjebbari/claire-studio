"""Chargement d'un dataset, application des plis figés, et PROJECTION DE TAXONOMIE.

Les taxonomies fusionnées (T14/T11/T10) ne sont jamais des données : elles sont appliquées
ICI, au chargement, sur un dataset dont les fichiers restent en T20 canonique. Conséquences
voulues : les plis ne bougent pas (donc toute comparaison inter-taxonomies est APPARIÉE par
construction), l'empreinte du dataset reste la même, et aucun export n'est réécrit.

La projection touche les QUATRE sources de thèmes d'un dataset — phrases agrégées,
vocabulaire (`labels.json`), votes bruts et état gold — avec le MÊME mapping. Un remap
partiel produirait des chiffres faux sans lever d'erreur (par exemple des juges restés en
T20 comparés à des annotateurs projetés).
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from pathlib import Path

from .taxonomy import canonical_id, project_primary_and_secondaries, project_theme


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
    #: Taxonomie appliquée au chargement ("T20" = canonique, aucune projection).
    taxonomy: str = "T20"

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

    def restricted_to(self, documents: set[str]) -> "Dataset":
        """Copie restreinte à une population de documents (filtre `data.population`).

        Les plis sont INTERSECTÉS, jamais recalculés : un pli vidé disparaît, les autres
        gardent leur composition — deux runs sur la même population restent appariés."""
        keep = set(documents)
        sentences = [s for s in self.sentences if s.document in keep]
        folds = [[d for d in fold if d in keep] for fold in self.folds]
        folds = [fold for fold in folds if fold]
        return Dataset(
            root=self.root, manifest=self.manifest, splits={**self.splits, "folds": folds},
            sentences=sentences, labels=self.labels,
            judges={k: v for k, v in self.judges.items() if k[0] in keep},
            taxonomy=self.taxonomy,
        )

    def with_holdout_fold(self, holdout: set[str]) -> "Dataset":
        """Découpage `design_holdout` : UN pli dont le test est la population figée
        `holdout` et l'entraînement tout le reste (la population de conception).

        Le hold-out n'a servi ni à concevoir les fusions ni à régler quoi que ce soit ;
        ce découpage est celui des baselines texte-seul du programme Legal KG."""
        present = set(self.documents)
        test = sorted(holdout & present)
        train = sorted(present - holdout)
        if not test or not train:
            raise ValueError(
                "design_holdout : il faut des documents des deux côtés "
                f"(train={len(train)}, test={len(test)}) — ne pas combiner avec "
                "data.population='holdout'"
            )
        return Dataset(
            root=self.root, manifest=self.manifest,
            splits={**self.splits, "scheme": "design_holdout", "k": 1, "folds": [test],
                    "train_documents": train},
            sentences=self.sentences, labels=self.labels, judges=self.judges,
            taxonomy=self.taxonomy,
        )

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


def load_dataset(root: str | Path, taxonomy: str = "T20") -> Dataset:
    """Charge un dossier de dataset, vérifie sa cohérence, et projette la taxonomie.

    La validation des plis se fait au CHARGEMENT et non seulement à la construction : un
    dataset corrompu ou tronqué pendant un transfert vers Grid'5000 doit être détecté
    avant l'entraînement, pas après quatre heures de GPU.

    `taxonomy` != "T20" projette les thèmes à la volée (les fichiers restent intacts).
    """
    root = Path(root)
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    splits = json.loads((root / "splits.json").read_text(encoding="utf-8"))
    labels = [row["code"] for row in json.loads((root / "labels.json").read_text("utf-8"))]
    if taxonomy != canonical_id():
        # Vocabulaire projeté et DÉDOUBLONNÉ : sans cela, la boucle « par thème » des
        # mesures compterait plusieurs fois la même classe fusionnée.
        seen: set = set()
        projected_labels = []
        for code in labels:
            projected = project_theme(code, taxonomy)
            if projected not in seen:
                seen.add(projected)
                projected_labels.append(projected)
        labels = projected_labels

    sentences: list[Sentence] = []
    with (root / "sentences.jsonl").open(encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            row = json.loads(line)
            primary, secondaries = project_primary_and_secondaries(
                row["primary"], [t for t in row["themes"] if t != row["primary"]], taxonomy
            )
            sentences.append(
                Sentence(
                    document=row["document"],
                    index=row["index"],
                    text=row["text"],
                    text_detok=row.get("text_detok", row["text"]),
                    doc_position=row.get("doc_position", 0.0),
                    n_sentences=row.get("n_sentences", 0),
                    primary=primary,
                    themes=[primary, *secondaries],
                    boundary=bool(row.get("boundary")),
                    n_annotators=row.get("n_annotators", 1),
                    agreement=row.get("agreement", ""),
                    unfair=row.get("unfair", []),
                    soft=row.get("soft", {}),
                )
            )

    # FRONTIÈRES RECALCULÉES après projection. Le drapeau du dataset a été calculé sur les
    # jeux de thèmes T20 : après fusion, deux phrases voisines peuvent porter le MÊME jeu et
    # la frontière disparaît. Conserver le drapeau d'origine mesurerait une segmentation qui
    # n'existe plus dans cette taxonomie — c'est le piège le plus discret de la projection.
    if taxonomy != canonical_id():
        previous: dict[str, tuple] = {}
        for sentence in sentences:
            current = (sentence.primary, tuple(sentence.themes[1:]))
            sentence.boundary = previous.get(sentence.document) != current
            previous[sentence.document] = current

    judges: dict[tuple[str, int], dict[str, str]] = {}
    judges_path = root / "judges.jsonl"
    if judges_path.exists():
        with judges_path.open(encoding="utf-8") as handle:
            for line in handle:
                if not line.strip():
                    continue
                row = json.loads(line)
                judges.setdefault((row["document"], row["index"]), {})[row["judge"]] = (
                    project_theme(row["theme"], taxonomy)
                )

    dataset = Dataset(
        root=root, manifest=manifest, splits=splits,
        sentences=sentences, labels=labels, judges=judges, taxonomy=taxonomy,
    )
    _validate(dataset)
    return dataset


def load_votes(root: str | Path, taxonomy: str = "T20") -> list[dict]:
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
            if not line.strip():
                continue
            row = json.loads(line)
            if taxonomy != canonical_id():
                row = dict(row)
                row["primary"], row["secondaries"] = project_primary_and_secondaries(
                    row.get("primary"), row.get("secondaries") or [], taxonomy
                )
            rows.append(row)
    return rows


def load_gold(root: str | Path, taxonomy: str = "T20") -> list[dict]:
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
            if not line.strip():
                continue
            row = json.loads(line)
            if taxonomy != canonical_id():
                row = dict(row)
                # La PROPOSITION du moteur et la DÉCISION humaine sont projetées toutes les
                # deux (elles se comparent), ainsi que le décompte `tally` dont les clés sont
                # des thèmes : deux thèmes fusionnés voient leurs masses S'ADDITIONNER.
                row["proposed_primary"], row["proposed_secondaries"] = (
                    project_primary_and_secondaries(
                        row.get("proposed_primary"), row.get("proposed_secondaries") or [],
                        taxonomy,
                    )
                )
                row["decided_primary"], row["decided_secondaries"] = (
                    project_primary_and_secondaries(
                        row.get("decided_primary"), row.get("decided_secondaries") or [],
                        taxonomy,
                    )
                )
                tally: dict = {}
                for code, mass in (row.get("tally") or {}).items():
                    projected = project_theme(code, taxonomy)
                    tally[projected] = tally.get(projected, 0.0) + mass
                row["tally"] = tally
            rows.append(row)
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

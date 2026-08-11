"""Découpage en plis — module PUR (aucune dépendance Django, ni scikit-learn).

**Invariant non négociable : le groupe est le DOCUMENT.** Les phrases d'un même contrat
partagent vocabulaire, structure et style ; un découpage aléatoire par phrase placerait
des phrases du même ToS des deux côtés et gonflerait les scores de plusieurs points.
C'est le genre de fuite qu'un relecteur repère immédiatement et qui invalide un article.
La fonction ne propose donc PAS de découpage par phrase — l'absence d'option est la
garantie.

Réimplémenté ici plutôt qu'importé de scikit-learn pour deux raisons : le backend ne doit
embarquer aucune dépendance scientifique lourde, et l'équilibrage par masse de phrases
(et non par nombre de documents) n'existe pas tel quel dans `GroupKFold`.
"""

from __future__ import annotations

import hashlib


class TooFewGroups(ValueError):
    """Moins de documents que de plis demandés — on refuse plutôt que de produire des
    plis vides qui feraient échouer l'entraînement bien plus loin."""


def _stable_order(documents: list[str], seed: int) -> list[str]:
    """Ordre pseudo-aléatoire mais REPRODUCTIBLE, sans `random`.

    L'empreinte d'un dataset doit être stable d'une machine à l'autre et d'une version
    de Python à l'autre : `hash()` est randomisé par processus, `random.shuffle` dépend
    de l'implémentation. Un SHA-256 du couple (graine, identifiant) ne dépend de rien.
    """
    def key(document: str) -> str:
        return hashlib.sha256(f"{seed}:{document}".encode("utf-8")).hexdigest()

    return sorted(documents, key=key)


def group_kfold(
    document_sizes: dict[str, int],
    *,
    k: int = 5,
    seed: int = 42,
) -> list[list[str]]:
    """Répartit les documents en `k` plis d'effectifs de PHRASES comparables.

    `document_sizes` : identifiant externe → nombre de phrases.

    Équilibrer par nombre de phrases (et non de documents) importe beaucoup ici : le
    corpus va de 60 phrases (Atlas) à 548 (Microsoft). Un découpage équilibré en nombre
    de documents produirait des plis dont la taille varie d'un facteur trois, et donc
    des scores de test non comparables entre plis.

    Algorithme glouton : on place les documents du plus grand au plus petit dans le pli
    le moins chargé. Simple, déterministe, et suffisant à cette échelle.
    """
    if k < 2:
        raise ValueError("k doit valoir au moins 2")
    documents = list(document_sizes)
    if len(documents) < k:
        raise TooFewGroups(
            f"{len(documents)} document(s) pour {k} plis : découpage impossible. "
            "Réduire k ou élargir les critères de sélection."
        )

    # Le pré-mélange déterministe évite qu'un ordre alphabétique corrèle avec la taille
    # ou la source ; le tri par taille qui suit reste stable grâce à cet ordre.
    ordered = _stable_order(documents, seed)
    ordered.sort(key=lambda d: -document_sizes[d])

    folds: list[list[str]] = [[] for _ in range(k)]
    loads = [0] * k
    for document in ordered:
        # Glouton : le pli le moins chargé. Les ex-aequo sont départagés par une clé
        # DÉPENDANT DE LA GRAINE, et non par l'indice du pli — sans cela la graine
        # n'aurait aucun effet dès que les tailles sont distinctes (le tri par taille
        # écrase le pré-mélange), et deux validations croisées « indépendantes »
        # tomberaient sur exactement la même partition.
        target = min(range(k), key=lambda i: (loads[i], _tiebreak(seed, document, i)))
        folds[target].append(document)
        loads[target] += document_sizes[document]

    return [sorted(fold) for fold in folds]


def _tiebreak(seed: int, document: str, fold_index: int) -> str:
    """Départage déterministe entre plis de charge égale."""
    return hashlib.sha256(f"{seed}:{document}:{fold_index}".encode("utf-8")).hexdigest()


def split_manifest(
    document_sizes: dict[str, int], *, k: int = 5, seed: int = 42
) -> dict:
    """Descripteur complet des plis, tel qu'écrit dans `splits.json`.

    Figé avec le dataset : deux modèles ne sont comparables que s'ils ont été évalués
    sur les MÊMES plis. C'est ce que vérifie l'endpoint de comparaison.
    """
    folds = group_kfold(document_sizes, k=k, seed=seed)
    return {
        "scheme": "group_kfold_document",
        "k": k,
        "seed": seed,
        "folds": folds,
        "foldSizes": [sum(document_sizes[d] for d in fold) for fold in folds],
        "foldDocumentCounts": [len(fold) for fold in folds],
        "rationale": (
            "Groupement par document : un découpage par phrase ferait fuir des phrases "
            "du même contrat entre entraînement et test."
        ),
    }


def validate_folds(folds: list[list[str]], documents: set[str]) -> None:
    """Vérifie la partition. Appelé à la construction ET au chargement : un dataset
    corrompu doit être détecté avant l'entraînement, pas après."""
    seen: set[str] = set()
    for fold in folds:
        for document in fold:
            if document in seen:
                raise ValueError(f"document dans deux plis : {document}")
            seen.add(document)
    if seen != documents:
        missing = documents - seen
        extra = seen - documents
        raise ValueError(f"partition incomplète (manquants={missing}, en trop={extra})")

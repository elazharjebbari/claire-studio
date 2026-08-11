"""Sélection des annotations par MATURITÉ — module PUR (aucune dépendance Django).

Répond à la question opérationnelle « je veux les documents FINIS, pas seulement ceux
qui ont été soumis ». Le workflow de Pactiva distingue le *statut* (draft/submitted/…)
de l'*achèvement réel* du travail : au 11/08/2026, dix annotations validées à 99,9 %
dormaient en `draft` et restaient donc **invisibles** à tous les calculs d'IAA, qui ne
retiennent que les statuts soumis. Ces dix annotations représentaient le passage de
1 à 3 paires d'annotateurs mesurables — soit la différence entre « une compatibilité
entre deux personnes » et « une fiabilité inter-annotateurs ».

Quatre niveaux, du plus permissif au plus strict :

    any        toute annotation existante                     (exploration seulement)
    complete   TOUTES les phrases portent une clause validée  ← le niveau utile
    submitted  statut ∈ {submitted, in_review, approved}      (conforme au workflow)
    gold       phrase issue d'une GoldResolution finalisée    (l'étalon final)

Les niveaux sont **cumulatifs par inclusion** : une annotation `submitted` dont toutes
les phrases sont validées est aussi `complete`. `annotation_maturity` renvoie le niveau
le plus fort atteint, et `satisfies` teste l'appartenance à un niveau demandé.

INVARIANT CENTRAL — aucune exclusion silencieuse. `select_annotations` renvoie toujours
le couple (retenus, exclus), et tout candidat écarté porte un motif explicite. Un jeu de
données qui perd douze documents sans le dire produit un article faux ; c'est le genre
d'erreur qu'on ne détecte qu'à la relecture par les pairs, quand il est trop tard.

Pur : entrées et sorties sont des dictionnaires simples, pas des instances de modèles.
Cela rend la logique testable sans base de données, et réutilisable par le builder de
jeux de données comme par le rapport de préfiguration (`preflight`).
"""

from __future__ import annotations

# Statuts considérés comme « soumis » au sens du workflow d'annotation. Volontairement
# aligné sur `claire.projects.iaa` et `claire.gold` : une divergence entre ces listes
# produirait des effectifs différents selon l'écran, et donc des chiffres incohérents
# entre le tableau de bord et l'article.
SUBMITTED_STATUSES = ("submitted", "in_review", "approved")

# Ordre de force croissante. Sert à la fois à `satisfies` et à la validation d'entrée.
MATURITY_LEVELS = ("any", "complete", "submitted", "gold")

# Motifs d'exclusion — énumérés pour que l'UI puisse les traduire et les regrouper
# plutôt que d'afficher une chaîne libre.
REASON_PARTIAL = "partial_annotation"
REASON_MATURITY = "below_maturity"
REASON_NOT_IN_SCOPE = "not_in_scope"
REASON_MIN_ANNOTATORS = "below_min_annotators"
REASON_EMPTY = "no_clause"

# Part de phrases validées exigée pour qu'une annotation soit dite « complète ».
# Strict par défaut : un assouplissement doit être demandé, pas subi.
DEFAULT_COMPLETENESS_THRESHOLD = 1.0


class UnknownMaturity(ValueError):
    """Niveau de maturité inconnu — on refuse plutôt que de retomber silencieusement."""


def completeness_ratio(n_sentences: int, n_validated: int) -> float:
    """Part du document effectivement validée, bornée à 1.0.

    Bornée parce que `n_validated` peut dépasser `n_sentences` sur des données héritées
    (clauses orphelines) : sans borne, un tel cas passerait tous les seuils.
    """
    if n_sentences <= 0:
        return 0.0
    return min(1.0, n_validated / n_sentences)


def annotation_maturity(
    *,
    n_sentences: int,
    n_clauses: int,
    n_validated: int,
    status: str,
    has_finalized_gold: bool = False,
    completeness_threshold: float = DEFAULT_COMPLETENESS_THRESHOLD,
) -> str:
    """Niveau de maturité le plus fort atteint par une annotation.

    `n_sentences` est le nombre de phrases du DOCUMENT (pas de l'annotation) : une
    annotation n'est complète que si elle couvre tout le document. C'est ce qui écarte
    le cas Endomondo (59 phrases annotées sur 498) — une annotation partielle entrant
    dans un calcul d'accord le fausserait massivement.

    `n_validated` compte les clauses explicitement validées par l'annotateur. On ne se
    fie pas au simple nombre de clauses : le pré-remplissage d'un modèle en crée une par
    phrase, donc `n_clauses == n_sentences` peut ne refléter aucun travail humain.

    `completeness_threshold` existe parce que le tout-ou-rien est trop brutal en
    pratique : sur la prod, une annotation à **192 phrases validées sur 193** était
    écartée comme « incomplète » alors qu'il s'agissait d'un clic oublié, pas d'un
    travail inachevé. Le défaut reste strict (1.0) — la tolérance doit être un choix
    explicite et tracé, jamais un adoucissement implicite.
    """
    if has_finalized_gold:
        return "gold"
    is_submitted = status in SUBMITTED_STATUSES
    # Un document sans phrase ne peut pas être « complet » : le déclarer tel ferait
    # entrer un document vide dans le corpus d'entraînement.
    is_complete = n_sentences > 0 and completeness_ratio(n_sentences, n_validated) >= completeness_threshold
    if is_submitted:
        # `submitted` est plus fort que `complete` dans l'ordre du workflow, mais une
        # annotation soumise et incomplète existe (soumission forcée) : on la classe
        # tout de même `submitted`, et c'est `satisfies` qui tranchera l'usage.
        return "submitted"
    if is_complete:
        return "complete"
    return "any"


def satisfies(maturity: str, required: str) -> bool:
    """`maturity` atteint-elle le niveau `required` ?

    La relation n'est pas un simple ordre total : `complete` (travail fini) et
    `submitted` (workflow validé) sont deux exigences DIFFÉRENTES, et c'est précisément
    la confusion des deux qui rendait invisibles les brouillons achevés.

        required=any        → tout passe
        required=complete   → complete, submitted (si complet), gold
        required=submitted  → submitted, gold
        required=gold       → gold seulement
    """
    if required not in MATURITY_LEVELS:
        raise UnknownMaturity(f"maturité inconnue : {required!r} (attendu {MATURITY_LEVELS})")
    if required == "any":
        return True
    if required == "gold":
        return maturity == "gold"
    if required == "submitted":
        return maturity in ("submitted", "gold")
    # required == "complete"
    return maturity in ("complete", "submitted", "gold")


def _is_actually_complete(row: dict, threshold: float) -> bool:
    """Complétude RÉELLE, indépendante du statut.

    Nécessaire parce qu'une annotation `submitted` peut être partielle : le statut dit
    que l'annotateur a cliqué « soumettre », pas que le document est couvert.
    """
    n_sentences = int(row.get("n_sentences") or 0)
    n_validated = int(row.get("n_validated") or 0)
    return n_sentences > 0 and completeness_ratio(n_sentences, n_validated) >= threshold


def select_annotations(
    rows: list[dict],
    *,
    maturity: str = "complete",
    scope: dict | None = None,
) -> tuple[list[dict], list[dict]]:
    """Partitionne les candidats en (retenus, exclus-avec-motif).

    `rows` : dicts portant au moins ``document``, ``annotator``, ``status``,
    ``n_sentences``, ``n_clauses``, ``n_validated`` ; éventuellement
    ``has_finalized_gold``.

    `scope` (optionnel) :
        documents               liste blanche d'identifiants externes
        annotators              liste blanche d'annotateurs
        min_annotators          nombre minimal d'annotateurs RETENUS par document
        exclude_partial         écarte les annotations ne couvrant pas tout le document
                                (défaut True — une annotation partielle fausse tout accord)
        completeness_threshold  part de phrases validées exigée (défaut 1.0, strict)

    Renvoie toujours une partition exacte : ``len(retenus) + len(exclus) == len(rows)``.
    C'est l'invariant testé, et la raison d'être de cette signature à deux valeurs.
    """
    if maturity not in MATURITY_LEVELS:
        raise UnknownMaturity(f"maturité inconnue : {maturity!r} (attendu {MATURITY_LEVELS})")

    scope = scope or {}
    wanted_docs = set(scope.get("documents") or ())
    wanted_annotators = set(scope.get("annotators") or ())
    min_annotators = int(scope.get("min_annotators") or 0)
    exclude_partial = bool(scope.get("exclude_partial", True))
    threshold = float(
        scope.get("completeness_threshold", DEFAULT_COMPLETENESS_THRESHOLD)
    )

    kept: list[dict] = []
    excluded: list[dict] = []

    def drop(row: dict, reason: str, detail: str) -> None:
        excluded.append(
            {
                "document": row.get("document"),
                "annotator": row.get("annotator"),
                "reason": reason,
                "detail": detail,
            }
        )

    for row in rows:
        document = row.get("document")
        annotator = row.get("annotator")

        if wanted_docs and document not in wanted_docs:
            drop(row, REASON_NOT_IN_SCOPE, "document hors périmètre demandé")
            continue
        if wanted_annotators and annotator not in wanted_annotators:
            drop(row, REASON_NOT_IN_SCOPE, "annotateur hors périmètre demandé")
            continue

        n_sentences = int(row.get("n_sentences") or 0)
        n_validated = int(row.get("n_validated") or 0)
        n_clauses = int(row.get("n_clauses") or 0)

        if n_clauses == 0:
            drop(row, REASON_EMPTY, "aucune clause")
            continue

        level = annotation_maturity(
            n_sentences=n_sentences,
            n_clauses=n_clauses,
            n_validated=n_validated,
            status=str(row.get("status") or ""),
            has_finalized_gold=bool(row.get("has_finalized_gold")),
            completeness_threshold=threshold,
        )
        if not satisfies(level, maturity):
            # Le motif porte les CHIFFRES : « maturité any < complete requis » ne
            # permet pas de distinguer une annotation à peine commencée (0/128) d'une
            # annotation finie à un clic près (192/193) — or la première est à écarter
            # et la seconde à récupérer.
            drop(
                row,
                REASON_MATURITY,
                f"maturité {level} < {maturity} requis "
                f"({n_validated}/{n_sentences} phrases validées, "
                f"{100 * completeness_ratio(n_sentences, n_validated):.1f} %)",
            )
            continue

        # Contrôle de complétude INDÉPENDANT du statut : une annotation soumise mais
        # partielle est écartée ici, alors qu'elle satisfait `maturity=submitted`.
        if exclude_partial and not _is_actually_complete(row, threshold):
            drop(
                row,
                REASON_PARTIAL,
                f"{n_validated}/{n_sentences} phrases validées "
                f"({100 * completeness_ratio(n_sentences, n_validated):.1f} %)",
            )
            continue

        kept.append(
            {
                **row,
                "maturity": level,
                "completeness": completeness_ratio(n_sentences, n_validated),
            }
        )

    if min_annotators > 1:
        # Second passage : le seuil porte sur le nombre d'annotateurs RETENUS, donc il
        # ne peut être évalué qu'une fois le premier filtrage terminé.
        per_document: dict[str, int] = {}
        for row in kept:
            per_document[row["document"]] = per_document.get(row["document"], 0) + 1
        survivors: list[dict] = []
        for row in kept:
            if per_document.get(row["document"], 0) >= min_annotators:
                survivors.append(row)
            else:
                drop(
                    row,
                    REASON_MIN_ANNOTATORS,
                    f"{per_document.get(row['document'], 0)} annotateur(s) < {min_annotators} requis",
                )
        kept = survivors

    return kept, excluded


def summarize_exclusions(excluded: list[dict]) -> dict[str, int]:
    """Comptage des motifs d'exclusion — pour l'affichage du rapport de préfiguration."""
    counts: dict[str, int] = {}
    for row in excluded:
        reason = row.get("reason", "unknown")
        counts[reason] = counts.get(reason, 0) + 1
    return counts


def coverage_by_document(kept: list[dict]) -> dict[str, list[str]]:
    """Annotateurs retenus par document — base du décompte multi-annoté."""
    coverage: dict[str, list[str]] = {}
    for row in kept:
        coverage.setdefault(row["document"], []).append(row["annotator"])
    return {doc: sorted(names) for doc, names in coverage.items()}

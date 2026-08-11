"""Métriques de qualité scientifique — module PUR (aucune dépendance Django).

Calcule, à partir du seul `payload` d'un `AnalysisSnapshot`, les indicateurs dont
l'article a besoin. Écrit ici plutôt que directement dans `analysis/metrics.py` pour
rester testable sans base de données et rejouable sur un export hors ligne.

**Le correctif majeur : `boundary_agreement`.** L'indicateur `boundaryKappa` exposé
aujourd'hui par `projects.iaa` vaut **1,000 par construction** : le pré-remplissage d'un
modèle est déplié PAR PHRASE, donc chaque phrase porte une ancre de clause chez tous les
annotateurs, et l'accord sur « y a-t-il une ancre ici ? » est trivialement parfait. Ce
n'est pas une mesure, c'est un artefact — et le publier serait une erreur factuelle.

La vraie unité de segmentation est le **segment reconstruit** : une plage maximale de
phrases consécutives portant le même ensemble de thèmes. Mesuré ainsi, l'accord tombe à
un Jaccard de 0,39–0,63 sur la production — et cet écart est un résultat en soi : la
frontière est bien plus difficile à s'accorder que le thème (κ 0,77).
"""

from __future__ import annotations

from collections import Counter, defaultdict
from itertools import combinations

# En deçà, un thème ne permet ni d'entraîner ni d'évaluer sérieusement.
RARE_THEME_THRESHOLD = 50

# Seuils de Passonneau pour l'α de Krippendorff, cités tels quels dans l'article.
ALPHA_ACCEPTABLE = 0.667
ALPHA_RELIABLE = 0.800


# --------------------------------------------------------------------------- #
# Segments reconstruits
# --------------------------------------------------------------------------- #

def theme_sets_by_sentence(clauses: list[dict], n_sentences: int) -> list[frozenset[str]]:
    """Ensemble de thèmes porté par chaque phrase (projection par bloc).

    Une ancre couvre jusqu'à l'ancre suivante — c'est la convention déjà retenue par
    `analysis.metrics._theme_vectors`, reprise ici pour que les deux modules ne puissent
    pas diverger sur la définition de « le thème de la phrase i ».
    """
    by_anchor = {row["anchorIndex"]: row for row in clauses}
    out: list[frozenset[str]] = []
    current: dict | None = None
    for index in range(n_sentences):
        current = by_anchor.get(index, current)
        if current is None:
            out.append(frozenset())
        else:
            out.append(
                frozenset({current["primaryTheme"], *current.get("secondaryThemes", [])})
            )
    return out


def segment_starts(theme_sets: list[frozenset[str]]) -> set[int]:
    """Index de début de chaque segment reconstruit.

    Un segment commence là où l'ensemble de thèmes CHANGE. C'est ce qui distingue la
    mesure de l'artefact : les ancres de clause sont partout, les changements de thème
    ne le sont pas.
    """
    starts: set[int] = set()
    previous: frozenset[str] | None = None
    for index, current in enumerate(theme_sets):
        if current and current != previous:
            starts.add(index)
        previous = current
    return starts


def jaccard(a: set[int], b: set[int]) -> float:
    """Jaccard de deux ensembles de frontières. Deux vides = accord parfait."""
    union = a | b
    if not union:
        return 1.0
    return len(a & b) / len(union)


def window_diff(ref: set[int], hyp: set[int], n: int, k: int | None = None) -> float:
    """WindowDiff (Pevzner & Hearst) — 0 = parfait, 1 = maximalement discordant.

    Compte, sur une fenêtre glissante, les endroits où les deux segmentations ne
    s'accordent pas sur le NOMBRE de frontières. Plus juste que l'exactitude brute :
    une frontière décalée d'une phrase est pénalisée moins qu'une frontière absente.
    """
    if n <= 1:
        return 0.0
    if k is None:
        # Convention usuelle : la moitié de la longueur moyenne de segment de référence.
        k = max(2, int(round(n / (2 * max(1, len(ref))))))
    k = min(k, n - 1)
    errors = 0
    windows = 0
    for i in range(n - k):
        window = range(i, i + k)
        errors += abs(
            sum(1 for x in window if x in ref) - sum(1 for x in window if x in hyp)
        ) > 0
        windows += 1
    return errors / windows if windows else 0.0


def pk_metric(ref: set[int], hyp: set[int], n: int, k: int | None = None) -> float:
    """Pk (Beeferman) — probabilité que deux phrases distantes de k soient classées
    différemment quant à leur appartenance au même segment."""
    if n <= 1:
        return 0.0
    if k is None:
        k = max(2, int(round(n / (2 * max(1, len(ref))))))
    k = min(k, n - 1)

    def same_segment(starts: set[int], i: int, j: int) -> bool:
        return not any(i < s <= j for s in starts)

    errors = 0
    pairs = 0
    for i in range(n - k):
        j = i + k
        if same_segment(ref, i, j) != same_segment(hyp, i, j):
            errors += 1
        pairs += 1
    return errors / pairs if pairs else 0.0


def boundary_agreement(payload: dict) -> dict:
    """Accord de segmentation sur les frontières RECONSTRUITES.

    Remplace `boundaryKappa` (artefact à 1,000). Renvoie le détail par document — c'est
    la granularité utile : la dispersion entre documents est elle-même un résultat.
    """
    documents = {row["id"]: row for row in payload.get("documents", [])}
    by_document: dict[int, list[tuple[str, set[int]]]] = defaultdict(list)
    for annotation in payload.get("annotations", []):
        doc = documents.get(annotation["documentId"])
        if not doc:
            continue
        n = doc.get("nSentences", 0)
        sets = theme_sets_by_sentence(annotation.get("clauses", []), n)
        by_document[annotation["documentId"]].append(
            (annotation["actorKey"], segment_starts(sets))
        )

    rows = []
    jaccards: list[float] = []
    for document_id, actors in sorted(by_document.items()):
        if len(actors) < 2:
            continue
        n = documents[document_id].get("nSentences", 0)
        pair_scores, wd_scores, pk_scores = [], [], []
        for (_, a), (_, b) in combinations(actors, 2):
            pair_scores.append(jaccard(a, b))
            wd_scores.append(window_diff(a, b, n))
            pk_scores.append(pk_metric(a, b, n))
        mean_j = sum(pair_scores) / len(pair_scores)
        jaccards.append(mean_j)
        rows.append(
            {
                "documentId": document_id,
                "nSentences": n,
                "annotators": len(actors),
                "segmentsPerAnnotator": [len(s) for _, s in actors],
                "jaccard": round(mean_j, 4),
                "windowDiff": round(sum(wd_scores) / len(wd_scores), 4),
                "pk": round(sum(pk_scores) / len(pk_scores), 4),
            }
        )

    return {
        "perDocument": rows,
        "meanJaccard": round(sum(jaccards) / len(jaccards), 4) if jaccards else None,
        "documentsCompared": len(rows),
        "definition": "segment = plage maximale de phrases au même ensemble de thèmes",
        "replaces": "boundary_kappa (artefact : vaut 1.0 car chaque phrase porte une ancre)",
        "warnings": ["insufficient_support"] if len(rows) < 2 else [],
    }


# --------------------------------------------------------------------------- #
# Distribution des étiquettes
# --------------------------------------------------------------------------- #

def label_distribution(payload: dict) -> dict:
    """Longue traîne des thèmes — et son entropie.

    Croisée avec l'accord par thème, elle porte le message : les thèmes rares sont aussi
    les moins fiables, ce qui explique visuellement l'écart micro/macro-F1.
    """
    primary: Counter = Counter()
    secondary: Counter = Counter()
    for annotation in payload.get("annotations", []):
        for clause in annotation.get("clauses", []):
            primary[clause["primaryTheme"]] += 1
            for code in clause.get("secondaryThemes", []):
                secondary[code] += 1

    total_primary = sum(primary.values())
    codes = sorted(set(primary) | set(secondary))
    rows = [
        {
            "code": code,
            "primary": primary.get(code, 0),
            "secondary": secondary.get(code, 0),
            "total": primary.get(code, 0) + secondary.get(code, 0),
            "share": round(primary.get(code, 0) / total_primary, 6) if total_primary else 0.0,
        }
        for code in codes
    ]
    rows.sort(key=lambda r: -r["primary"])

    # Entropie de Shannon normalisée : 1 = distribution uniforme, 0 = tout sur un thème.
    entropy = 0.0
    if total_primary and len(primary) > 1:
        import math

        for count in primary.values():
            p = count / total_primary
            if p > 0:
                entropy -= p * math.log(p)
        entropy /= math.log(len(primary))

    rare = [r["code"] for r in rows if r["total"] < RARE_THEME_THRESHOLD]
    counts = [r["primary"] for r in rows if r["primary"] > 0]
    return {
        "themes": rows,
        "nThemes": len(rows),
        "totalPrimary": total_primary,
        "normalizedEntropy": round(entropy, 4),
        "rareThemes": rare,
        "rareThreshold": RARE_THEME_THRESHOLD,
        "imbalanceRatio": round(max(counts) / min(counts), 2) if len(counts) > 1 else None,
        "warnings": ["rare_themes_below_threshold"] if rare else [],
    }


# --------------------------------------------------------------------------- #
# Co-occurrence et lift d'abusivité — pont vers l'objectif B
# --------------------------------------------------------------------------- #

def cooccurrence(payload: dict, unfair_index: dict | None = None) -> dict:
    """Matrice de co-occurrence des thèmes, et lift d'abusivité par paire.

    Résultat mesuré le 11/08/2026 qui justifie ce calcul : le multi-label BRUT ne prédit
    presque rien (lift 1,09× entre clauses mono et multi-thèmes), alors que certaines
    PAIRES précises montent à 7,4× (LICENSE_IP+TERMINATION à 77 % d'abusivité). Ce n'est
    donc pas la cardinalité qui porte le signal mais l'identité de la combinaison — et
    c'est ce qui oriente l'objectif B vers la co-occurrence plutôt que l'hypergraphe.

    `unfair_index` : {(documentId, index): [catégories]} — optionnel. Sans lui, la
    matrice est calculée sans lift.
    """
    unfair_index = unfair_index or {}
    documents = {row["id"]: row for row in payload.get("documents", [])}

    pair_total: Counter = Counter()
    pair_unfair: Counter = Counter()
    combo_total: Counter = Counter()
    combo_unfair: Counter = Counter()
    n_mono = n_mono_unfair = n_multi = n_multi_unfair = 0

    for annotation in payload.get("annotations", []):
        document_id = annotation["documentId"]
        n = documents.get(document_id, {}).get("nSentences", 0)
        sets = theme_sets_by_sentence(annotation.get("clauses", []), n)
        for index, themes in enumerate(sets):
            if not themes:
                continue
            is_unfair = bool(unfair_index.get((document_id, index)))
            combo = tuple(sorted(themes))
            combo_total[combo] += 1
            if is_unfair:
                combo_unfair[combo] += 1
            if len(themes) >= 2:
                n_multi += 1
                n_multi_unfair += is_unfair
                for a, b in combinations(sorted(themes), 2):
                    pair_total[(a, b)] += 1
                    if is_unfair:
                        pair_unfair[(a, b)] += 1
            else:
                n_mono += 1
                n_mono_unfair += is_unfair

    total = n_mono + n_multi
    base_rate = (n_mono_unfair + n_multi_unfair) / total if total else 0.0

    def lift(count: int, unfair: int) -> float | None:
        if not count or not base_rate:
            return None
        return round((unfair / count) / base_rate, 3)

    pairs = [
        {
            "themes": list(pair),
            "count": count,
            "unfair": pair_unfair.get(pair, 0),
            "unfairRate": round(pair_unfair.get(pair, 0) / count, 4),
            "lift": lift(count, pair_unfair.get(pair, 0)),
        }
        for pair, count in pair_total.items()
    ]
    pairs.sort(key=lambda r: (-(r["lift"] or 0), -r["count"]))

    hapax = [combo for combo, count in combo_total.items() if count == 1]
    mono_rate = n_mono_unfair / n_mono if n_mono else 0.0
    multi_rate = n_multi_unfair / n_multi if n_multi else 0.0
    return {
        "pairs": pairs,
        "nPairs": len(pairs),
        "nCombinations": len(combo_total),
        "nHapaxCombinations": len(hapax),
        "baseUnfairRate": round(base_rate, 6),
        "monoLabel": {"count": n_mono, "unfair": n_mono_unfair, "rate": round(mono_rate, 4)},
        "multiLabel": {"count": n_multi, "unfair": n_multi_unfair, "rate": round(multi_rate, 4)},
        # Le contre-résultat à ne PAS oublier de rapporter : la cardinalité seule
        # n'explique presque rien (≈1,09× sur la prod).
        "cardinalityLift": round(multi_rate / mono_rate, 3) if mono_rate else None,
        "warnings": [] if unfair_index else ["no_reference_labels"],
    }


# --------------------------------------------------------------------------- #
# Prêt pour la science
# --------------------------------------------------------------------------- #

def campaign_readiness(payload: dict, *, targets: dict | None = None) -> dict:
    """Tableau de bord « qu'est-ce qui bloque l'article ? ».

    Remplace les requêtes SQL manuelles qui ont servi à préparer les dossiers de
    recherche. Le champ `completeButNotSubmitted` est le plus important : il compte le
    travail FINI mais invisible aux calculs standard — 10 annotations au 11/08/2026.
    """
    targets = targets or {"multiAnnotated": 12, "tripleAnnotated": 5, "goldFinalized": 3}
    documents = {row["id"]: row for row in payload.get("documents", [])}

    submitted_statuses = {"submitted", "in_review", "approved"}
    by_document: dict[int, list[dict]] = defaultdict(list)
    complete_not_submitted = []
    for annotation in payload.get("annotations", []):
        clauses = annotation.get("clauses", [])
        n = documents.get(annotation["documentId"], {}).get("nSentences", 0)
        n_validated = sum(1 for c in clauses if c.get("validated"))
        is_complete = n > 0 and n_validated >= n
        is_submitted = annotation.get("status") in submitted_statuses
        by_document[annotation["documentId"]].append(
            {"actorKey": annotation["actorKey"], "submitted": is_submitted, "complete": is_complete}
        )
        if is_complete and not is_submitted:
            complete_not_submitted.append(
                {
                    "documentId": annotation["documentId"],
                    "actorKey": annotation["actorKey"],
                    "validated": n_validated,
                    "nSentences": n,
                }
            )

    submitted_counts = Counter(
        sum(1 for a in actors if a["submitted"]) for actors in by_document.values()
    )
    complete_counts = Counter(
        sum(1 for a in actors if a["complete"]) for actors in by_document.values()
    )

    def at_least(counter: Counter, k: int) -> int:
        return sum(count for size, count in counter.items() if size >= k)

    gold_docs = {
        row["documentId"] for row in payload.get("goldSentences", []) if row.get("decided")
    }

    multi = at_least(complete_counts, 2)
    triple = at_least(complete_counts, 3)
    blockers = []
    if multi < targets["multiAnnotated"]:
        blockers.append(
            {
                "code": "multi_annotated_below_target",
                "message": f"{multi}/{targets['multiAnnotated']} documents à ≥2 annotateurs",
                "severity": "high",
            }
        )
    if triple < targets["tripleAnnotated"]:
        blockers.append(
            {
                "code": "triple_annotated_below_target",
                "message": f"{triple}/{targets['tripleAnnotated']} documents à ≥3 annotateurs",
                "severity": "medium",
            }
        )
    if complete_not_submitted:
        blockers.append(
            {
                "code": "complete_but_not_submitted",
                "message": (
                    f"{len(complete_not_submitted)} annotation(s) terminée(s) mais non "
                    "soumise(s) : invisibles aux calculs standard"
                ),
                "severity": "high",
            }
        )
    if not gold_docs:
        blockers.append(
            {
                "code": "no_gold_finalized",
                "message": "aucune résolution gold décidée",
                "severity": "medium",
            }
        )

    return {
        "documentsTotal": len(documents),
        "documentsAnnotated": len(by_document),
        "documentsMultiAnnotatedSubmitted": at_least(submitted_counts, 2),
        "documentsMultiAnnotatedComplete": multi,
        "documentsTripleAnnotated": triple,
        "documentsWithGold": len(gold_docs),
        "completeButNotSubmitted": complete_not_submitted,
        "targets": targets,
        "blockers": sorted(blockers, key=lambda b: b["severity"] != "high"),
    }

"""Registre de métriques versionnées calculées uniquement sur un snapshot."""

from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass
from typing import Callable

from claire.projects.iaa import cohen_kappa


@dataclass(frozen=True)
class MetricDefinition:
    code: str
    version: str
    label: str
    calculator: Callable[[dict], dict]
    unit: str = "observation"
    min_support: int = 1
    modes: tuple[str, ...] = ()


class MetricRegistry:
    def __init__(self):
        self._metrics: dict[str, MetricDefinition] = {}

    def register(self, definition: MetricDefinition) -> None:
        if definition.code in self._metrics:
            raise ValueError(f"duplicate metric: {definition.code}")
        self._metrics[definition.code] = definition

    def get(self, code: str) -> MetricDefinition:
        try:
            return self._metrics[code]
        except KeyError as exc:
            raise ValueError(f"unknown metric: {code}") from exc

    def catalog(self) -> list[dict]:
        return [
            {
                "code": item.code,
                "version": item.version,
                "label": item.label,
                "unit": item.unit,
                "minSupport": item.min_support,
                "modes": item.modes,
            }
            for item in self._metrics.values()
        ]

    def definitions(self) -> tuple[MetricDefinition, ...]:
        return tuple(self._metrics.values())


registry = MetricRegistry()


def _actor_profiles(payload: dict) -> dict:
    documents = {row["id"]: row for row in payload.get("documents", [])}
    profiles = defaultdict(
        lambda: {
            "assignedDocuments": 0,
            "annotations": 0,
            "draftAnnotations": 0,
            "publishedAnnotations": 0,
            "clauses": 0,
            "validatedClauses": 0,
            "eligibleSentences": 0,
            "coveredSentences": 0,
            "certainty": Counter(),
            "themes": Counter(),
        }
    )
    assigned_pairs = set()
    for assignment in payload.get("assignments", []):
        pair = (assignment["actorKey"], assignment["documentId"])
        if pair in assigned_pairs:
            continue
        assigned_pairs.add(pair)
        profile = profiles[assignment["actorKey"]]
        profile["assignedDocuments"] += 1
        profile["eligibleSentences"] += documents.get(assignment["documentId"], {}).get(
            "nSentences", 0
        )

    for annotation in payload.get("annotations", []):
        profile = profiles[annotation["actorKey"]]
        profile["annotations"] += 1
        if annotation["status"] == "draft":
            profile["draftAnnotations"] += 1
        else:
            profile["publishedAnnotations"] += 1
        clauses = annotation.get("clauses", [])
        profile["clauses"] += len(clauses)
        profile["validatedClauses"] += sum(bool(row["validated"]) for row in clauses)
        for clause in clauses:
            if clause["certainty"] is not None:
                profile["certainty"][str(clause["certainty"])] += 1
            profile["themes"][clause["primaryTheme"]] += 1
        if clauses:
            n_sentences = documents.get(annotation["documentId"], {}).get("nSentences", 0)
            first_anchor = min(row["anchorIndex"] for row in clauses)
            profile["coveredSentences"] += max(0, n_sentences - first_anchor)
            if (annotation["actorKey"], annotation["documentId"]) not in assigned_pairs:
                profile["eligibleSentences"] += n_sentences

    actors = payload.get("actors", {})
    result = []
    for actor_key in sorted(profiles):
        profile = profiles[actor_key]
        eligible = profile["eligibleSentences"]
        clauses = profile["clauses"]
        result.append(
            {
                "actorKey": actor_key,
                "pseudonym": actors.get(actor_key.split(":", 1)[-1], {}).get(
                    "pseudonym", actor_key
                ),
                **{key: value for key, value in profile.items() if not isinstance(value, Counter)},
                "coverageRate": (
                    round(profile["coveredSentences"] / eligible, 6) if eligible else None
                ),
                "validationRate": (
                    round(profile["validatedClauses"] / clauses, 6) if clauses else None
                ),
                "certaintyDistribution": dict(sorted(profile["certainty"].items())),
                "themeDistribution": [
                    {"theme": theme, "count": count}
                    for theme, count in profile["themes"].most_common()
                ],
            }
        )
    return {"actors": result}


def _overview(payload: dict) -> dict:
    statuses = Counter(row["status"] for row in payload.get("annotations", []))
    profiles = _actor_profiles(payload)["actors"]
    eligible = sum(row["eligibleSentences"] for row in profiles)
    covered = sum(row["coveredSentences"] for row in profiles)
    return {
        "documents": len(payload.get("documents", [])),
        "humanActors": len(profiles),
        "llmActors": len({row["actorKey"] for row in payload.get("llmAnnotations", [])}),
        "annotations": len(payload.get("annotations", [])),
        "draftAnnotations": statuses.get("draft", 0),
        "publishedAnnotations": sum(
            count for status, count in statuses.items() if status != "draft"
        ),
        "statusDistribution": dict(sorted(statuses.items())),
        "eligibleSentences": eligible,
        "coveredSentences": covered,
        "coverageRate": round(covered / eligible, 6) if eligible else None,
        "goldDecisions": sum(row.get("decided", True) for row in payload.get("goldSentences", [])),
    }


def _theme_vectors(
    clauses: list[dict], n_sentences: int
) -> tuple[list[str | None], list[set[str]]]:
    """Projection par bloc : une ancre couvre jusqu'à l'ancre suivante."""

    by_anchor = {row["anchorIndex"]: row for row in clauses}
    primary: list[str | None] = []
    multilabel: list[set[str]] = []
    current: dict | None = None
    for index in range(n_sentences):
        current = by_anchor.get(index, current)
        if current is None:
            primary.append(None)
            multilabel.append(set())
        else:
            primary.append(current["primaryTheme"])
            multilabel.append({current["primaryTheme"], *current.get("secondaryThemes", [])})
    return primary, multilabel


def _actor_label(payload: dict, actor_key: str) -> str:
    if actor_key.startswith("human:"):
        actor = payload.get("actors", {}).get(actor_key.split(":", 1)[1], {})
        return actor.get("pseudonym", actor_key)
    return actor_key.removeprefix("llm:")


def _quality(payload: dict) -> dict:
    clauses = [
        clause
        for annotation in payload.get("annotations", [])
        for clause in annotation.get("clauses", [])
    ]
    certainty = Counter(
        "missing" if row.get("certainty") is None else str(row["certainty"]) for row in clauses
    )
    multilabel = sum(bool(row.get("secondaryThemes")) for row in clauses)
    validated = sum(bool(row.get("validated")) for row in clauses)
    return {
        "clauses": len(clauses),
        "multilabelClauses": multilabel,
        "multilabelRate": round(multilabel / len(clauses), 6) if clauses else None,
        "validatedClauses": validated,
        "validationRate": round(validated / len(clauses), 6) if clauses else None,
        "certaintyDistribution": dict(sorted(certainty.items())),
        "warnings": ["insufficient_support"] if len(clauses) < 10 else [],
    }


def _pairwise_agreement(payload: dict) -> dict:
    documents = {row["id"]: row for row in payload.get("documents", [])}
    actors_by_doc: dict[int, list[dict]] = defaultdict(list)
    for annotation in payload.get("annotations", []):
        actors_by_doc[annotation["documentId"]].append(
            {"actorKey": annotation["actorKey"], "clauses": annotation.get("clauses", [])}
        )
    for annotation in payload.get("llmAnnotations", []):
        actors_by_doc[annotation["documentId"]].append(
            {"actorKey": annotation["actorKey"], "clauses": annotation.get("clauses", [])}
        )

    pairs = []
    cases = []
    for document_id, actors in actors_by_doc.items():
        n_sentences = documents.get(document_id, {}).get("nSentences", 0)
        vectors = {
            row["actorKey"]: (*_theme_vectors(row["clauses"], n_sentences), row["clauses"])
            for row in actors
        }
        keys = sorted(vectors)
        for left_index, left in enumerate(keys):
            for right in keys[left_index + 1 :]:
                left_primary, left_sets, left_clauses = vectors[left]
                right_primary, right_sets, right_clauses = vectors[right]
                included = [
                    i
                    for i, (a, b) in enumerate(zip(left_primary, right_primary))
                    if a is not None and b is not None
                ]
                if not included:
                    continue
                a_labels = [left_primary[i] for i in included]
                b_labels = [right_primary[i] for i in included]
                matches = sum(a == b for a, b in zip(a_labels, b_labels))
                jaccards = []
                for i in included:
                    union = left_sets[i] | right_sets[i]
                    jaccards.append(
                        len(left_sets[i] & right_sets[i]) / len(union) if union else 1.0
                    )
                    if left_primary[i] != right_primary[i] and len(cases) < 500:
                        cases.append(
                            {
                                "documentId": document_id,
                                "sentenceIndex": i,
                                "actorA": _actor_label(payload, left),
                                "actorB": _actor_label(payload, right),
                                "themeA": left_primary[i],
                                "themeB": right_primary[i],
                            }
                        )
                left_boundaries = {row["anchorIndex"] for row in left_clauses}
                right_boundaries = {row["anchorIndex"] for row in right_clauses}
                true_positive = len(left_boundaries & right_boundaries)
                precision = true_positive / len(left_boundaries) if left_boundaries else 0
                recall = true_positive / len(right_boundaries) if right_boundaries else 0
                boundary_f1 = (
                    2 * precision * recall / (precision + recall) if precision + recall else 0
                )
                mode = (
                    "inter_human"
                    if left.startswith("human:") and right.startswith("human:")
                    else "inter_llm"
                    if left.startswith("llm:") and right.startswith("llm:")
                    else "human_llm"
                )
                pairs.append(
                    {
                        "documentId": document_id,
                        "mode": mode,
                        "actorA": _actor_label(payload, left),
                        "actorB": _actor_label(payload, right),
                        "support": len(included),
                        "matches": matches,
                        "rawAgreement": round(matches / len(included), 6),
                        "cohenKappa": round(cohen_kappa(a_labels, b_labels), 6),
                        "jaccardMultilabel": round(sum(jaccards) / len(jaccards), 6),
                        "boundaryF1": round(boundary_f1, 6),
                    }
                )
    supported = [row for row in pairs if row["support"] >= 20]
    return {
        "pairs": pairs,
        "cases": cases,
        "caseCount": sum(row["support"] - row["matches"] for row in pairs),
        "supportedPairCount": len(supported),
        "meanKappa": (
            round(sum(row["cohenKappa"] for row in supported) / len(supported), 6)
            if supported
            else None
        ),
        "warnings": ["insufficient_support"] if pairs and not supported else [],
    }


def _intra_annotator(payload: dict) -> dict:
    documents = {row["id"]: row for row in payload.get("documents", [])}
    grouped: dict[int, list[dict]] = defaultdict(list)
    for version in payload.get("annotationVersions", []):
        grouped[version["annotationId"]].append(version)
    comparisons = []
    for versions in grouped.values():
        versions.sort(key=lambda row: row["number"])
        for before, after in zip(versions, versions[1:]):
            n = documents.get(before["documentId"], {}).get("nSentences", 0)
            left, _ = _theme_vectors(before.get("clauses", []), n)
            right, _ = _theme_vectors(after.get("clauses", []), n)
            included = [i for i, pair in enumerate(zip(left, right)) if None not in pair]
            if not included:
                continue
            a = [left[i] for i in included]
            b = [right[i] for i in included]
            matches = sum(x == y for x, y in zip(a, b))
            comparisons.append(
                {
                    "actor": _actor_label(payload, before["actorKey"]),
                    "documentId": before["documentId"],
                    "fromVersion": before["number"],
                    "toVersion": after["number"],
                    "support": len(included),
                    "stability": round(matches / len(included), 6),
                    "cohenKappa": round(cohen_kappa(a, b), 6),
                    "changedUnits": len(included) - matches,
                }
            )
    return {
        "comparisons": comparisons,
        "meanStability": (
            round(sum(row["stability"] for row in comparisons) / len(comparisons), 6)
            if comparisons
            else None
        ),
    }


def _gold_analysis(payload: dict) -> dict:
    documents = {row["id"]: row for row in payload.get("documents", [])}
    gold_by_doc: dict[int, dict[int, dict]] = defaultdict(dict)
    for row in payload.get("goldSentences", []):
        gold_by_doc[row["documentId"]][row["index"]] = row
    decided = [row for rows in gold_by_doc.values() for row in rows.values() if row.get("decided")]
    total = sum(len(rows) for rows in gold_by_doc.values())
    actor_scores = []
    for annotation in [*payload.get("annotations", []), *payload.get("llmAnnotations", [])]:
        gold = gold_by_doc.get(annotation["documentId"], {})
        if not gold:
            continue
        n = documents.get(annotation["documentId"], {}).get("nSentences", 0)
        vector, _ = _theme_vectors(annotation.get("clauses", []), n)
        comparable = [index for index, row in gold.items() if row.get("decided") and vector[index]]
        if comparable:
            matches = sum(vector[index] == gold[index].get("primaryTheme") for index in comparable)
            actor_scores.append(
                {
                    "documentId": annotation["documentId"],
                    "actor": _actor_label(payload, annotation["actorKey"]),
                    "actorType": "human" if annotation["actorKey"].startswith("human:") else "llm",
                    "support": len(comparable),
                    "matches": matches,
                    "proximity": round(matches / len(comparable), 6),
                }
            )
    return {
        "goldUnits": total,
        "decidedUnits": len(decided),
        "readinessRate": round(len(decided) / total, 6) if total else None,
        "agreementClassDistribution": dict(
            Counter(
                row.get("agreementClass", "unknown")
                for rows in gold_by_doc.values()
                for row in rows.values()
            )
        ),
        "riskDistribution": dict(
            Counter(
                row.get("riskBand", "unknown")
                for rows in gold_by_doc.values()
                for row in rows.values()
            )
        ),
        "actorScores": actor_scores,
    }


def _taxonomy(payload: dict) -> dict:
    primary = Counter()
    secondary = Counter()
    cooccurrence = Counter()
    for annotation in payload.get("annotations", []):
        for clause in annotation.get("clauses", []):
            theme = clause["primaryTheme"]
            primary[theme] += 1
            for other in clause.get("secondaryThemes", []):
                secondary[other] += 1
                cooccurrence[tuple(sorted((theme, other)))] += 1
    return {
        "primaryThemes": [{"theme": key, "count": value} for key, value in primary.most_common()],
        "secondaryThemes": [
            {"theme": key, "count": value} for key, value in secondary.most_common()
        ],
        "rareThemes": sorted(key for key, value in primary.items() if value < 5),
        "cooccurrences": [
            {"themeA": pair[0], "themeB": pair[1], "count": count}
            for pair, count in cooccurrence.most_common()
        ],
    }


registry.register(MetricDefinition("overview", "1", "Vue d'ensemble", _overview))
registry.register(
    MetricDefinition("actor_profiles", "1", "Profils des annotateurs", _actor_profiles)
)
registry.register(
    MetricDefinition(
        "quality", "1", "Qualité des observations", _quality, unit="clause", min_support=10
    )
)
registry.register(
    MetricDefinition(
        "pairwise_agreement",
        "1",
        "Accords multi-annotations",
        _pairwise_agreement,
        unit="phrase",
        min_support=20,
        modes=("inter_human", "human_llm", "inter_llm"),
    )
)
registry.register(
    MetricDefinition(
        "intra_annotator",
        "1",
        "Stabilité intra-annotateur",
        _intra_annotator,
        unit="phrase",
        min_support=1,
        modes=("intra_human",),
    )
)
registry.register(
    MetricDefinition(
        "gold_analysis",
        "1",
        "Proximité et readiness Gold",
        _gold_analysis,
        unit="phrase",
        modes=("gold",),
    )
)
registry.register(MetricDefinition("taxonomy", "1", "Atlas de la taxonomie", _taxonomy))


# --------------------------------------------------------------------------- #
# Métriques du Lab (chantier `docs/pactiva-lab/`)
#
# Calculées par `claire.lab.quality` et `claire.lab.agreement` — modules PURS, sans
# Django, donc testables hors base et rejouables sur un export. Ici on ne fait que les
# ENREGISTRER : le registre reste la seule porte d'entrée, et le versionnement garantit
# qu'un rapport produit avant cet ajout reste lisible.
# --------------------------------------------------------------------------- #

from claire.imports.models import Judge  # noqa: E402
from claire.lab import agreement as _lab_agreement  # noqa: E402
from claire.lab import quality as _lab_quality  # noqa: E402


def _boundary_agreement(payload: dict) -> dict:
    """⚠ Remplace `boundaryKappa`, qui vaut 1,0 PAR CONSTRUCTION (chaque phrase porte
    une ancre de clause). Mesure ici les frontières RECONSTRUITES."""
    return _lab_quality.boundary_agreement(payload)


def _label_distribution(payload: dict) -> dict:
    return _lab_quality.label_distribution(payload)


def _cooccurrence(payload: dict) -> dict:
    # `unfairIndex` est injecté dans le payload par le snapshot quand les labels
    # CLAUDETTE sont disponibles ; sans lui la matrice est calculée sans lift.
    raw = payload.get("unfairIndex") or {}
    index = {}
    for key, categories in raw.items():
        document_id, _, sentence_index = str(key).partition(":")
        if sentence_index.isdigit():
            index[(int(document_id), int(sentence_index))] = categories
    return _lab_quality.cooccurrence(payload, index)


def _campaign_readiness(payload: dict) -> dict:
    return _lab_quality.campaign_readiness(payload)


def _alpha_masi(payload: dict) -> dict:
    return _lab_agreement.alpha_masi_report(payload)


def _human_llm_matrix(payload: dict) -> dict:
    # Ordre d'affichage DÉRIVÉ de la source unique — jamais une liste écrite ici.
    return _lab_agreement.human_llm_matrix(payload, list(Judge.import_judges()))


def _annotator_audit(payload: dict) -> dict:
    return _lab_agreement.annotator_audit(payload)


def _gold_progress(payload: dict) -> dict:
    return _lab_agreement.gold_progress(payload)


registry.register(
    MetricDefinition(
        "alpha_masi", "1", "α de Krippendorff (MASI) multi-label", _alpha_masi,
        unit="phrase", min_support=20, modes=("inter_human",),
    )
)
registry.register(
    MetricDefinition(
        "boundary_agreement", "1", "Accord de segmentation (frontières reconstruites)",
        _boundary_agreement, unit="document", min_support=2, modes=("inter_human",),
    )
)
registry.register(
    MetricDefinition(
        "label_distribution", "1", "Distribution des thèmes (longue traîne)",
        _label_distribution, unit="clause",
    )
)
registry.register(
    MetricDefinition(
        "cooccurrence", "1", "Co-occurrence des thèmes et lift d'abusivité",
        _cooccurrence, unit="clause", min_support=5,
    )
)
registry.register(
    MetricDefinition(
        "human_llm_matrix", "1", "Matrice d'accord humains × LLM", _human_llm_matrix,
        unit="phrase", min_support=20, modes=("inter_human", "human_llm", "inter_llm"),
    )
)
registry.register(
    MetricDefinition(
        "annotator_audit", "1", "Audit des annotateurs", _annotator_audit,
        unit="clause", min_support=50,
    )
)
registry.register(
    MetricDefinition(
        "gold_progress", "1", "Avancement de la résolution gold", _gold_progress,
        unit="phrase", modes=("gold",),
    )
)
registry.register(
    MetricDefinition(
        "campaign_readiness", "1", "Prêt pour la science", _campaign_readiness,
        unit="document",
    )
)

"""Tâches de MESURE — M1 (accords, E1–E4) et M2 (cascade gold, E5).

Pas de modèle, pas de plis : ces tâches lisent la matière brute du dataset daté
(`votes.jsonl`, `judges.jsonl`, `gold.jsonl`) et écrivent un `results.json` du même
contrat que le runner (metrics + volets + environnement + `_SENTINEL`). C'est ce qui
rend chaque chiffre d'accord des papiers reproductible sur export figé — la règle des
deux dossiers stratégiques (aucun chiffre issu d'une requête ad hoc).

Périmètre assumé de l'aperçu (docs/pactiva-experiences-papiers/01 §3) :
* la divergence « au seed » est mesurée contre le juge LE PLUS PROCHE — borne inférieure
  de l'édition réelle, car le juge de pré-remplissage n'est pas persisté (V1.2) ;
* M2 exporte l'état de la cascade Y COMPRIS non finalisé — « 0 résolution finalisée »
  est un fait à montrer, pas à masquer.
"""

from __future__ import annotations

import json
import time
from collections import Counter, defaultdict
from pathlib import Path

from .data import load_dataset, load_gold, load_votes
from .taxonomy import (
    filter_population,
    population_of,
    spec_fingerprint,
    taxonomy_of,
)
from .env import capture_environment
from .evaluation.agreement import (
    alpha_masi_vs_nominal,
    alpha_set_ci,
    gwet_ac1_binary,
    krippendorff_alpha_set,
    masi_distance,
    nominal_set_distance,
)
from .evaluation.metrics import cohen_kappa

_PROGRESS_PHASES = 6


def _write_progress(progress_path, step: int, label: str) -> None:
    if not progress_path:
        return
    payload = {
        "percent": int(100 * step / _PROGRESS_PHASES),
        "fold": step,
        "folds": _PROGRESS_PHASES,
        "phase": label,
    }
    Path(progress_path).write_text(json.dumps(payload), encoding="utf-8")


def _check_cancel(should_cancel, where: str) -> None:
    if should_cancel and should_cancel():
        from .runner import Cancelled

        raise Cancelled(f"annulé pendant {where}")


def _finalize(out_dir: Path, result: dict) -> dict:
    (out_dir / "results.json").write_text(
        json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    (out_dir / "environment.json").write_text(
        json.dumps(result["environment"], indent=2), encoding="utf-8"
    )
    (out_dir / "_SENTINEL").write_text("DONE\n", encoding="utf-8")
    return result


def _theme_set(row: dict) -> frozenset:
    return frozenset([row["primary"], *row.get("secondaries", [])])


# =========================================================================== #
# M1 — accords (E1 coût du multi-label · E2 matrice 7×7 · E3 frontières ·
#      E4 divergence aux juges)
# =========================================================================== #

def run_agreement(
    config: dict,
    data_dir: str | Path,
    out_dir: str | Path,
    *,
    progress_path=None,
    should_cancel=None,
) -> dict:
    started = time.time()
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    taxonomy = taxonomy_of(config)
    population = population_of(config)
    dataset = load_dataset(data_dir, taxonomy=taxonomy)
    votes = filter_population(load_votes(data_dir, taxonomy=taxonomy), population)
    if not votes:
        raise ValueError(
            "votes_missing : ce dataset ne contient pas votes.jsonl — reconstruisez-le "
            "(les datasets antérieurs au 16 août 2026 n'exportaient pas les votes bruts)."
        )
    seed = int(config.get("seed", 42))
    evaluation = config.get("evaluation") or {}
    n_resamples = int((evaluation.get("bootstrap") or {}).get("n_resamples", 1000))

    # Index des votes : (document, index) → {annotateur: (primaire, ensemble)}.
    by_sentence: dict[tuple, dict[str, tuple[str, frozenset]]] = defaultdict(dict)
    for row in votes:
        by_sentence[(row["document"], row["index"])][row["annotator"]] = (
            row["primary"], _theme_set(row)
        )
    annotators = sorted({row["annotator"] for row in votes})
    judges = sorted({j for judged in dataset.judges.values() for j in judged})

    multi = {key: raters for key, raters in by_sentence.items() if len(raters) >= 2}
    # Deux vues APPARIÉES des mêmes unités : les ensembles complets (tâche multi-label,
    # distance MASI) et la projection mono-label sur le thème primaire (le contrôle
    # nominal 0,701 de la campagne est défini ainsi).
    units_by_doc: dict[str, list] = defaultdict(list)
    primary_units_by_doc: dict[str, list] = defaultdict(list)
    for (document, _index), raters in sorted(multi.items()):
        ordered = [raters[name] for name in sorted(raters)]
        units_by_doc[document].append([theme_set for _p, theme_set in ordered])
        primary_units_by_doc[document].append(
            [frozenset([primary]) for primary, _s in ordered]
        )

    # ---- E1 : le coût du multi-label -------------------------------------- #
    _check_cancel(should_cancel, "E1 (α-MASI vs nominal)")
    e1 = alpha_masi_vs_nominal(
        units_by_doc, primary_units_by_doc, n_resamples=n_resamples, seed=seed
    )
    e1["ciMasi"] = alpha_set_ci(
        units_by_doc, distance=masi_distance,
        n_resamples=n_resamples, seed=seed, tag="alpha-masi",
    )
    e1["ciNominal"] = alpha_set_ci(
        primary_units_by_doc, distance=nominal_set_distance,
        n_resamples=n_resamples, seed=seed, tag="alpha-nominal",
    )
    e1["nUnits"] = sum(len(u) for u in units_by_doc.values())
    _write_progress(progress_path, 1, "E1 — α-MASI vs α nominal")

    # ---- Par thème : α binaire présence/absence + Gwet AC1 ---------------- #
    _check_cancel(should_cancel, "l'accord par thème")
    all_units = [unit for units in units_by_doc.values() for unit in units]
    per_theme = []
    for theme in dataset.labels:
        binary_units = [
            [frozenset(["1"]) if theme in s else frozenset() for s in unit]
            for unit in all_units
        ]
        support = sum(
            1 for unit in all_units if any(theme in s for s in unit)
        )
        observed = (
            sum(1 for unit in binary_units if len(set(unit)) == 1) / len(binary_units)
            if binary_units else None
        )
        per_theme.append(
            {
                "theme": theme,
                "support": support,
                "alphaBinary": _round6(krippendorff_alpha_set(
                    binary_units, distance=nominal_set_distance
                )),
                "gwetAc1": gwet_ac1_binary(
                    [[theme in s for s in unit] for unit in all_units]
                ),
                "observedAgreement": _round6(observed),
            }
        )
    _write_progress(progress_path, 2, "accord par thème")

    # ---- Paires d'annotateurs --------------------------------------------- #
    _check_cancel(should_cancel, "les paires d'annotateurs")
    pairs = []
    for i in range(len(annotators)):
        for j in range(i + 1, len(annotators)):
            a, b = annotators[i], annotators[j]
            primaries_a, primaries_b, jaccards, documents = [], [], [], set()
            for (document, _index), raters in multi.items():
                if a in raters and b in raters:
                    primaries_a.append(raters[a][0])
                    primaries_b.append(raters[b][0])
                    jaccards.append(_jaccard(raters[a][1], raters[b][1]))
                    documents.add(document)
            if not primaries_a:
                continue
            agree = sum(1 for x, y in zip(primaries_a, primaries_b) if x == y)
            pairs.append(
                {
                    "a": a,
                    "b": b,
                    "kappa": _round6(cohen_kappa(primaries_a, primaries_b)),
                    "rawAgreement": _round6(agree / len(primaries_a)),
                    "jaccardMean": _round6(sum(jaccards) / len(jaccards)),
                    "nUnits": len(primaries_a),
                    "nDocuments": len(documents),
                }
            )
    _write_progress(progress_path, 3, "paires d'annotateurs")

    # ---- E2 : la matrice annotateurs ∪ juges ------------------------------ #
    # Accord sur le thème PRIMAIRE (les juges ne produisent qu'un thème par phrase) —
    # limite déclarée dans l'article, pas une approximation silencieuse. Listes
    # alignées, jamais de dict à clés libres (la camelisation DRF transformerait
    # les noms de juges/annotateurs).
    _check_cancel(should_cancel, "la matrice E2")
    raters = [(name, "annotator") for name in annotators] + [
        (name, "judge") for name in judges
    ]

    def _primary_of(name: str, kind: str, key: tuple) -> str | None:
        if kind == "annotator":
            entry = by_sentence.get(key, {}).get(name)
            return entry[0] if entry else None
        return dataset.judges.get(key, {}).get(name)

    n = len(raters)
    agreement_matrix = [[None] * n for _ in range(n)]
    kappa_matrix = [[None] * n for _ in range(n)]
    common_matrix = [[0] * n for _ in range(n)]
    keys = sorted(set(by_sentence) | set(dataset.judges))
    for i in range(n):
        agreement_matrix[i][i] = 1.0
        kappa_matrix[i][i] = 1.0
        for j in range(i + 1, n):
            name_i, kind_i = raters[i]
            name_j, kind_j = raters[j]
            series_i, series_j = [], []
            for key in keys:
                p_i = _primary_of(name_i, kind_i, key)
                p_j = _primary_of(name_j, kind_j, key)
                if p_i is not None and p_j is not None:
                    series_i.append(p_i)
                    series_j.append(p_j)
            common_matrix[i][j] = common_matrix[j][i] = len(series_i)
            if series_i:
                agree = sum(1 for x, y in zip(series_i, series_j) if x == y)
                agreement_matrix[i][j] = agreement_matrix[j][i] = _round6(
                    agree / len(series_i)
                )
                kappa_matrix[i][j] = kappa_matrix[j][i] = _round6(
                    cohen_kappa(series_i, series_j)
                )
    matrix = {
        "raters": [name for name, _ in raters],
        "kinds": [kind for _, kind in raters],
        "agreement": agreement_matrix,
        "kappa": kappa_matrix,
        "nCommon": common_matrix,
    }
    _write_progress(progress_path, 4, "matrice annotateurs × juges")

    # ---- E3 : frontières reconstruites ------------------------------------ #
    # Jamais le κ d'ancres (= 1,0 par construction, indicateur plateforme à corriger).
    _check_cancel(should_cancel, "les frontières (E3)")
    boundaries = _boundary_agreement(by_sentence, annotators)
    _write_progress(progress_path, 5, "frontières reconstruites")

    # ---- E4 (aperçu) : divergence aux juges ------------------------------- #
    _check_cancel(should_cancel, "la divergence aux juges (E4)")
    divergence = _judge_divergence(by_sentence, dataset.judges, annotators, judges)
    _write_progress(progress_path, 6, "divergence aux juges")

    best_pair = max(pairs, key=lambda p: p["nUnits"], default=None)
    boundary_values = [p["jaccardMean"] for p in boundaries["pairs"]]
    metrics = {
        "alpha_masi": e1.get("alphaMasi"),
        "alpha_nominal": e1.get("alphaNominal"),
        "alpha_diff": e1.get("diff"),
        "kappa_best_pair": best_pair["kappa"] if best_pair else None,
        "raw_agreement_best_pair": best_pair["rawAgreement"] if best_pair else None,
        "boundary_jaccard_mean": _round6(
            sum(boundary_values) / len(boundary_values)
        ) if boundary_values else None,
        "divergence_closest_mean": divergence.get("closestRateMean"),
        "n_units_multi": e1["nUnits"],
        "n_pairs": len(pairs),
        "n_documents_multi": len(units_by_doc),
    }

    result = {
        "task": "M1_agreement",
        "config": config,
        "dataset": {
            "fingerprint": dataset.manifest.get("fingerprint"),
            "nDocuments": dataset.manifest.get("nDocuments"),
            "nSentences": len(dataset.sentences),
            # Traçabilité de PROJECTION : sans ces trois champs, un chiffre est ambigu
            # (« α-MASI 0,72 » ne veut rien dire sans dire en quelle taxonomie, sur quelle
            # population, et avec quelle version de mappings).
            "taxonomy": dataset.taxonomy,
            "population": population or "all",
            "taxonomySpec": spec_fingerprint()[:16],
        },
        "metrics": metrics,
        "agreement": {
            "global": e1,
            "perTheme": per_theme,
            "pairs": pairs,
            "matrix": matrix,
            "boundaries": boundaries,
            "divergence": divergence,
        },
        "environment": capture_environment(started),
    }
    return _finalize(out_dir, result)


def _jaccard(a: frozenset, b: frozenset) -> float:
    union = a | b
    if not union:
        return 1.0
    return len(a & b) / len(union)


def _round6(value):
    return round(value, 6) if isinstance(value, float) else value


def _boundary_sets(
    by_sentence: dict[tuple, dict[str, tuple[str, frozenset]]], annotator: str
) -> dict[str, tuple[set[int], int]]:
    """Par document : (positions ouvrant un segment, nombre de phrases annotées).

    Reconstruction du builder, côté vote : une phrase ouvre un segment si la précédente
    n'est pas annotée par CET annotateur ou si son jeu de thèmes change.
    """
    per_document: dict[str, dict[int, frozenset]] = defaultdict(dict)
    for (document, index), raters in by_sentence.items():
        if annotator in raters:
            per_document[document][index] = raters[annotator][1]
    out: dict[str, tuple[set[int], int]] = {}
    for document, sentences in per_document.items():
        starts: set[int] = set()
        previous_index: int | None = None
        previous_set: frozenset | None = None
        for index in sorted(sentences):
            if previous_index != index - 1 or sentences[index] != previous_set:
                starts.add(index)
            previous_index = index
            previous_set = sentences[index]
        out[document] = (starts, len(sentences))
    return out


def _boundary_agreement(by_sentence, annotators: list[str]) -> dict:
    sets = {name: _boundary_sets(by_sentence, name) for name in annotators}
    pair_rows = []
    for i in range(len(annotators)):
        for j in range(i + 1, len(annotators)):
            a, b = annotators[i], annotators[j]
            documents = sorted(set(sets[a]) & set(sets[b]))
            doc_rows = []
            for document in documents:
                bounds_a, n_a = sets[a][document]
                bounds_b, n_b = sets[b][document]
                # Les frontières ne se comparent que sur la couverture COMMUNE : un
                # document annoté partiellement par l'un fausserait le Jaccard.
                if n_a == 0 or n_b == 0:
                    continue
                union = bounds_a | bounds_b
                jaccard = len(bounds_a & bounds_b) / len(union) if union else 1.0
                doc_rows.append(
                    {
                        "document": document,
                        "jaccard": _round6(jaccard),
                        "nBoundariesA": len(bounds_a),
                        "nBoundariesB": len(bounds_b),
                    }
                )
            if not doc_rows:
                continue
            pair_rows.append(
                {
                    "a": a,
                    "b": b,
                    "jaccardMean": _round6(
                        sum(r["jaccard"] for r in doc_rows) / len(doc_rows)
                    ),
                    "documents": doc_rows,
                }
            )
    # Liste et non dict : un nom d'annotateur en clé serait transformé par la
    # camelisation DRF (règle établie le 15 août 2026 sur la matrice des juges).
    segments = [
        {
            "annotator": name,
            "nSegments": sum(len(starts) for starts, _n in sets[name].values()),
            "nSentences": sum(n for _s, n in sets[name].values()),
        }
        for name in annotators
    ]
    return {"pairs": pair_rows, "segments": segments}


def _judge_divergence(by_sentence, judges_index, annotators, judges) -> dict:
    rows = []
    closest_rates = []
    for annotator in annotators:
        by_judge = []
        for judge in judges:
            n_common = 0
            n_diff_primary = 0
            n_diff_set = 0
            for key, raters in by_sentence.items():
                if annotator not in raters:
                    continue
                judged = judges_index.get(key, {}).get(judge)
                if judged is None:
                    continue
                primary, theme_set = raters[annotator]
                n_common += 1
                if primary != judged:
                    n_diff_primary += 1
                if theme_set != frozenset([judged]):
                    n_diff_set += 1
            if n_common:
                by_judge.append(
                    {
                        "judge": judge,
                        "nCommon": n_common,
                        "divergencePrimary": _round6(n_diff_primary / n_common),
                        "divergenceSet": _round6(n_diff_set / n_common),
                    }
                )
        if not by_judge:
            continue
        closest = min(by_judge, key=lambda r: r["divergencePrimary"])
        closest_rates.append(closest["divergencePrimary"])

        per_theme_counter: Counter = Counter()
        per_theme_diff: Counter = Counter()
        for key, raters in by_sentence.items():
            if annotator not in raters:
                continue
            judged = judges_index.get(key, {}).get(closest["judge"])
            if judged is None:
                continue
            primary = raters[annotator][0]
            per_theme_counter[primary] += 1
            if primary != judged:
                per_theme_diff[primary] += 1
        per_theme = [
            {
                "theme": theme,
                "support": per_theme_counter[theme],
                "divergence": _round6(per_theme_diff[theme] / per_theme_counter[theme]),
            }
            for theme in sorted(
                per_theme_counter, key=lambda t: -per_theme_counter[t]
            )
        ]
        rows.append(
            {
                "annotator": annotator,
                "nSentences": max(r["nCommon"] for r in by_judge),
                "byJudge": by_judge,
                "closestJudge": closest["judge"],
                "closestDivergence": closest["divergencePrimary"],
                "perTheme": per_theme,
            }
        )
    return {
        "annotators": rows,
        "closestRateMean": _round6(
            sum(closest_rates) / len(closest_rates)
        ) if closest_rates else None,
        "note": (
            "Divergence au juge le plus proche = borne INFÉRIEURE de l'édition réelle "
            "(le juge de pré-remplissage n'est pas persisté — correctif V1.2)."
        ),
    }


# =========================================================================== #
# M2 — cascade gold (E5)
# =========================================================================== #

def run_gold_cascade(
    config: dict,
    data_dir: str | Path,
    out_dir: str | Path,
    *,
    progress_path=None,
    should_cancel=None,
) -> dict:
    started = time.time()
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    taxonomy = taxonomy_of(config)
    population = population_of(config)
    dataset = load_dataset(data_dir, taxonomy=taxonomy)
    gold = filter_population(load_gold(data_dir, taxonomy=taxonomy), population)
    if not gold:
        raise ValueError(
            "gold_missing : aucune phrase de résolution gold dans ce dataset — créez au "
            "moins une résolution (module Gold) puis reconstruisez le dataset."
        )
    votes = load_votes(data_dir)
    by_sentence: dict[tuple, list[str]] = defaultdict(list)
    for row in votes:
        by_sentence[(row["document"], row["index"])].append(row["primary"])

    _check_cancel(should_cancel, "la cascade gold")
    tiers = Counter(row["auto_level"] for row in gold)
    classes = Counter(row["agreement_class"] for row in gold)
    total = len(gold)
    decided = [row for row in gold if row["decided"]]
    finalized_documents = sorted({row["document"] for row in gold if row["finalized"]})

    # Ce que l'arbitrage CHANGE : parmi les décisions humaines (tier manual, décidées),
    # combien contredisent la pluralité des votes ? C'est l'argument « le comité ne fait
    # pas que ratifier un vote 2-1 » — ou son contraire, mesuré.
    changed, confirmed, no_plurality = 0, 0, 0
    for row in decided:
        if row["auto_level"] != "manual" or not row["decided_primary"]:
            continue
        primaries = by_sentence.get((row["document"], row["index"]), [])
        counts = Counter(primaries).most_common()
        if not counts or (len(counts) > 1 and counts[0][1] == counts[1][1]):
            no_plurality += 1
        elif counts[0][0] == row["decided_primary"]:
            confirmed += 1
        else:
            changed += 1

    manual_total = tiers.get("manual", 0)
    manual_decided = sum(
        1 for row in decided if row["auto_level"] == "manual"
    )
    metrics = {
        "n_gold_sentences": total,
        "share_auto_1click": _round6(tiers.get("auto_1click", 0) / total),
        "share_auto": _round6(tiers.get("auto", 0) / total),
        "share_manual": _round6(manual_total / total),
        "pct_decided": _round6(len(decided) / total),
        "manual_changed_by_arbitration": changed,
        "manual_confirmed": confirmed,
        "manual_no_plurality": no_plurality,
        "residual_ambiguity": manual_total - manual_decided,
        "n_finalized_documents": len(finalized_documents),
    }
    _write_progress(progress_path, _PROGRESS_PHASES, "cascade gold")

    result = {
        "task": "M2_gold_cascade",
        "config": config,
        "dataset": {
            "fingerprint": dataset.manifest.get("fingerprint"),
            "nDocuments": dataset.manifest.get("nDocuments"),
            "nSentences": len(dataset.sentences),
            # Traçabilité de PROJECTION : sans ces trois champs, un chiffre est ambigu
            # (« α-MASI 0,72 » ne veut rien dire sans dire en quelle taxonomie, sur quelle
            # population, et avec quelle version de mappings).
            "taxonomy": dataset.taxonomy,
            "population": population or "all",
            "taxonomySpec": spec_fingerprint()[:16],
        },
        "metrics": metrics,
        "gold": {
            "tiers": [
                {"tier": tier, "count": tiers.get(tier, 0),
                 "share": _round6(tiers.get(tier, 0) / total)}
                for tier in ("auto_1click", "auto", "manual")
            ],
            "agreementClasses": [
                {"agreementClass": name, "count": count}
                for name, count in sorted(classes.items())
            ],
            "arbitration": {
                "changed": changed,
                "confirmed": confirmed,
                "noPlurality": no_plurality,
                "manualTotal": manual_total,
                "manualDecided": manual_decided,
            },
            "finalizedDocuments": finalized_documents,
            "coverage": _round6(total / max(1, len(dataset.sentences))),
            "note": (
                "État de la cascade tel qu'exporté — les chiffres définitifs d'E5 "
                "exigent des résolutions FINALISÉES (plan opérationnel V2)."
            ),
        },
        "environment": capture_environment(started),
    }
    return _finalize(out_dir, result)

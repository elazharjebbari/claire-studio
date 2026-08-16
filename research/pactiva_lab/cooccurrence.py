"""G2 — anomalie de co-occurrence de thèmes ↔ abusivité CLAUDETTE (papier long, §5).

Hypothèse reformulée par les données (docs/pactiva-anomalies-graphe/04 §4) : ce n'est ni
le NOMBRE de thèmes (lift 1,09×) ni la rareté brute (max 1,76×) qui prédit l'abusivité,
c'est l'IDENTITÉ de la combinaison (jusqu'à 76,9 % d'abusives sur LICENSE_IP+TERMINATION).
Cette tâche transforme ce sondage ad hoc en expérience versionnée : scores d'anomalie
NON SUPERVISÉS évalués CONTRE les labels (rare ≠ abusif), validation croisée par document
sur les plis figés du dataset, contrôles négatifs rapportés à côté des détecteurs.

Choix assumés, à écrire dans l'article :
* l'unité est le SEGMENT reconstruit (plage de phrases contiguës au même jeu de thèmes) —
  l'unité annotée reste la phrase, la « clause » est dérivée ;
* `npmi_min` ne score que les segments multi-thèmes (les mono reçoivent 0, rang le moins
  anormal) : le détecteur cible la co-occurrence, pas la rareté marginale ;
* `combo_identity` (P(abusif | combinaison) estimé sur train) est une référence
  SUPERVISÉE — la borne haute de ce que l'identité de combinaison peut donner, jamais
  présentée comme détecteur non supervisé ;
* la couche déontique est un PROXY à règles (modaux), déclaré comme tel — l'ablation D1
  mesure le coût/bénéfice d'une couche prédite bruitée, pas la déontique elle-même.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
import time
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path

from .data import Dataset, load_dataset
from .env import capture_environment

PRECISION_AT_DEFAULT = (10, 20, 50)

# Détecteurs non supervisés, contrôles négatifs, référence supervisée — l'appartenance
# est portée par le résultat pour que l'UI ne puisse pas les confondre.
SCORER_KINDS = {
    "rarity": "unsupervised",
    "npmi_min": "unsupervised",
    "lof": "unsupervised",
    "iforest": "unsupervised",
    "ocsvm": "unsupervised",
    "cardinality": "control",
    "combo_identity": "supervised_reference",
}


@dataclass
class Segment:
    document: str
    start: int
    end: int  # inclus
    themes: frozenset
    n_sentences: int
    unfair_categories: list[str]
    excerpt: str
    # Couche d'origine quand source=votes : le nom de l'annotateur. Vide en agrégé.
    layer: str = ""
    deontic: str = ""
    noisy_themes: frozenset | None = None

    @property
    def unfair(self) -> bool:
        return bool(self.unfair_categories)

    @property
    def key(self) -> tuple:
        return (self.document, self.layer, self.start)

    def combo(self, *, with_deontic: bool) -> tuple:
        themes = self.noisy_themes if self.noisy_themes is not None else self.themes
        key = tuple(sorted(themes))
        return (key, self.deontic) if with_deontic else (key, "")


# --------------------------------------------------------------------------- #
# Construction des unités
# --------------------------------------------------------------------------- #

def build_segments(dataset: Dataset) -> list[Segment]:
    """Segments reconstruits : phrases CONTIGUËS d'un même document portant le même jeu
    de thèmes. Une rupture d'index (phrase non annotée) ouvre un segment — même règle
    que la reconstruction des frontières de M1."""
    by_document: dict[str, list] = defaultdict(list)
    for sentence in dataset.sentences:
        by_document[sentence.document].append(sentence)
    segments: list[Segment] = []
    for document in sorted(by_document):
        sentences = sorted(by_document[document], key=lambda s: s.index)
        current: list = []
        for sentence in sentences:
            themes = frozenset(sentence.themes)
            if current and (
                sentence.index != current[-1].index + 1
                or frozenset(current[-1].themes) != themes
            ):
                segments.append(_close_segment(document, current))
                current = []
            current.append(sentence)
        if current:
            segments.append(_close_segment(document, current))
    return segments


def _close_segment(document: str, sentences: list) -> Segment:
    categories = sorted({c for s in sentences for c in s.unfair})
    excerpt = sentences[0].text_detok or sentences[0].text
    return Segment(
        document=document,
        start=sentences[0].index,
        end=sentences[-1].index,
        themes=frozenset(sentences[0].themes),
        n_sentences=len(sentences),
        unfair_categories=categories,
        excerpt=excerpt[:200],
    )


def build_segments_from_votes(dataset: Dataset, votes: list[dict]) -> list[Segment]:
    """Segments reconstruits À PARTIR DES VOTES BRUTS : une couche PAR ANNOTATEUR.

    C'est le protocole de l'aperçu pré-gold (docs/pactiva-anomalies-graphe/04 §4) :
    l'agrégation consensus APLATIT les secondaires des documents mono-annotateur
    (plancher ≥ 2 votes), donc la couche agrégée ne porte presque plus de multi-label
    (3,9 % vs ~30 % en brut) — l'hypothèse de co-occurrence n'y est pas testable.
    Les documents multi-annotés contribuent une couche par annotateur ; la validation
    croisée reste PAR DOCUMENT (toutes les couches d'un document tombent dans le même
    pli — aucune fuite).
    """
    unfair_by_key = {(s.document, s.index): s.unfair for s in dataset.sentences}
    text_by_key = {
        (s.document, s.index): (s.text_detok or s.text) for s in dataset.sentences
    }
    layers: dict[tuple[str, str], dict[int, frozenset]] = defaultdict(dict)
    for row in votes:
        layers[(row["document"], row["annotator"])][row["index"]] = frozenset(
            [row["primary"], *row.get("secondaries", [])]
        )

    segments: list[Segment] = []

    def close(document: str, annotator: str, indices: list[int],
              themes: frozenset) -> None:
        categories = sorted(
            {c for i in indices for c in unfair_by_key.get((document, i), [])}
        )
        segments.append(
            Segment(
                document=document,
                start=indices[0],
                end=indices[-1],
                themes=themes,
                n_sentences=len(indices),
                unfair_categories=categories,
                excerpt=(text_by_key.get((document, indices[0]), "") or "")[:200],
                layer=annotator,
            )
        )

    for (document, annotator) in sorted(layers):
        sets = layers[(document, annotator)]
        current: list[int] = []
        for index in sorted(sets):
            if current and (
                index != current[-1] + 1 or sets[index] != sets[current[0]]
            ):
                close(document, annotator, current, sets[current[0]])
                current = []
            current.append(index)
        if current:
            close(document, annotator, current, sets[current[0]])
    return segments


# --------------------------------------------------------------------------- #
# Couche déontique — proxy à règles (ablation D1)
# --------------------------------------------------------------------------- #

_DEONTIC_RULES = [
    ("prohibition", re.compile(
        r"\b(shall not|must not|may not|is not permitted|are not permitted|"
        r"prohibited|forbidden)\b", re.IGNORECASE)),
    ("obligation", re.compile(
        r"\b(shall|must|is required to|are required to|obligated|agree to)\b",
        re.IGNORECASE)),
    ("permission", re.compile(
        r"\b(may|is entitled to|are entitled to|reserves? the right)\b",
        re.IGNORECASE)),
]


def deontic_tag(text: str) -> str:
    """Étiquette déontique par règles de modaux — proxy DÉCLARÉ d'un classifieur
    LexDeMod-style (macro-F1 ~0,6) ; la priorité interdiction > obligation > permission
    suit la spécificité des marqueurs."""
    for tag, pattern in _DEONTIC_RULES:
        if pattern.search(text):
            return tag
    return "statement"


def _attach_deontic(segments: list[Segment], dataset: Dataset) -> None:
    text_by_key = {(s.document, s.index): (s.text_detok or s.text)
                   for s in dataset.sentences}
    for segment in segments:
        text = " ".join(
            text_by_key.get((segment.document, i), "")
            for i in range(segment.start, segment.end + 1)
        )
        segment.deontic = deontic_tag(text)


# --------------------------------------------------------------------------- #
# Bruit d'étiquettes (ablation G5, versant détection) — TRAIN seulement
# --------------------------------------------------------------------------- #

def corrupt_segments(segments: list[Segment], labels: list[str], *,
                     rate: float, seed: int, fold: int) -> None:
    """Remplace un thème du jeu de `rate` des segments (rang de hachage SHA-256, même
    famille que `runner._corrupt_labels`) — simule un classifieur amont dégradé. Écrit
    `noisy_themes`, ne touche jamais `themes` (le TEST reste propre par construction)."""
    if rate <= 0 or len(labels) < 2:
        return
    n_corrupt = round(rate * len(segments))
    if n_corrupt <= 0:
        return
    ranked = sorted(
        range(len(segments)),
        key=lambda i: hashlib.sha256(
            f"{seed}:g2-noise:{fold}:{segments[i].document}:{segments[i].layer}:"
            f"{segments[i].start}".encode()
        ).hexdigest(),
    )
    for i in ranked[:n_corrupt]:
        segment = segments[i]
        themes = sorted(segment.themes)
        victim = themes[0]
        position = labels.index(victim) if victim in labels else -1
        replacement = labels[(position + 1) % len(labels)]
        replaced = (set(segment.themes) - {victim}) | {replacement}
        segment.noisy_themes = frozenset(replaced)


# --------------------------------------------------------------------------- #
# Statistiques de normalité (apprises sur TRAIN) et scorers
# --------------------------------------------------------------------------- #

@dataclass
class TrainStats:
    n_segments: int = 0
    combo_counts: Counter = field(default_factory=Counter)
    combo_unfair: Counter = field(default_factory=Counter)
    theme_counts: Counter = field(default_factory=Counter)
    pair_counts: Counter = field(default_factory=Counter)
    base_rate: float = 0.0


def fit_stats(train: list[Segment], *, with_deontic: bool) -> TrainStats:
    stats = TrainStats()
    stats.n_segments = len(train)
    n_unfair = 0
    for segment in train:
        combo = segment.combo(with_deontic=with_deontic)
        stats.combo_counts[combo] += 1
        if segment.unfair:
            stats.combo_unfair[combo] += 1
            n_unfair += 1
        themes = segment.noisy_themes if segment.noisy_themes is not None else segment.themes
        ordered = sorted(themes)
        for theme in ordered:
            stats.theme_counts[theme] += 1
        for a in range(len(ordered)):
            for b in range(a + 1, len(ordered)):
                stats.pair_counts[(ordered[a], ordered[b])] += 1
    stats.base_rate = n_unfair / stats.n_segments if stats.n_segments else 0.0
    return stats


def score_rarity(segment: Segment, stats: TrainStats, *, with_deontic: bool,
                 smoothing: float = 1.0) -> float:
    count = stats.combo_counts.get(segment.combo(with_deontic=with_deontic), 0)
    vocabulary = len(stats.combo_counts) + 1
    probability = (count + smoothing) / (stats.n_segments + smoothing * vocabulary)
    return -math.log(probability)


def score_npmi_min(segment: Segment, stats: TrainStats) -> float:
    """−min(NPMI) des paires internes : la paire la plus atypique du segment. Les
    segments mono-thème reçoivent 0 (rang le moins anormal) — voir docstring module."""
    themes = sorted(segment.themes)
    if len(themes) < 2 or stats.n_segments == 0:
        return 0.0
    n = stats.n_segments
    worst = None
    for a in range(len(themes)):
        for b in range(a + 1, len(themes)):
            p_a = (stats.theme_counts.get(themes[a], 0) + 0.5) / (n + 1)
            p_b = (stats.theme_counts.get(themes[b], 0) + 0.5) / (n + 1)
            p_ab = (stats.pair_counts.get((themes[a], themes[b]), 0) + 0.5) / (n + 1)
            pmi = math.log(p_ab / (p_a * p_b))
            npmi = pmi / (-math.log(p_ab))
            worst = npmi if worst is None else min(worst, npmi)
    return -(worst if worst is not None else 0.0)


def score_combo_identity(segment: Segment, stats: TrainStats, *, with_deontic: bool,
                         smoothing: float = 2.0) -> float:
    """Référence SUPERVISÉE : P(abusif | combinaison) lissé vers le taux de base.
    Une combinaison jamais vue au train retombe sur le taux de base."""
    combo = segment.combo(with_deontic=with_deontic)
    count = stats.combo_counts.get(combo, 0)
    unfair = stats.combo_unfair.get(combo, 0)
    return (unfair + smoothing * stats.base_rate) / (count + smoothing)


def _multi_hot(segments: list[Segment], labels: list[str], *,
               with_deontic: bool) -> "object":
    import numpy

    deontic_tags = ["prohibition", "obligation", "permission", "statement"]
    width = len(labels) + (len(deontic_tags) if with_deontic else 0)
    matrix = numpy.zeros((len(segments), width))
    index = {label: i for i, label in enumerate(labels)}
    for row, segment in enumerate(segments):
        themes = segment.noisy_themes if segment.noisy_themes is not None else segment.themes
        for theme in themes:
            if theme in index:
                matrix[row, index[theme]] = 1.0
        if with_deontic and segment.deontic in deontic_tags:
            matrix[row, len(labels) + deontic_tags.index(segment.deontic)] = 1.0
    return matrix


# --------------------------------------------------------------------------- #
# Boucle d'expérience
# --------------------------------------------------------------------------- #

def run_cooccurrence(
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

    dataset = load_dataset(data_dir)
    model_config = config.get("model") or {}
    evaluation = config.get("evaluation") or {}
    seed = int(config.get("seed", 42))
    unit = model_config.get("unit", "segment")
    with_deontic = model_config.get("deontic", "none") == "rule_based"
    smoothing = float(model_config.get("smoothing", 1.0))
    label_noise = float(evaluation.get("label_noise") or 0.0)
    precision_at = [int(k) for k in evaluation.get("precision_at", PRECISION_AT_DEFAULT)]

    source = model_config.get("source", "aggregated")
    if source == "votes":
        from .data import load_votes

        votes = load_votes(data_dir)
        if not votes:
            raise ValueError(
                "votes_missing : source=votes exige votes.jsonl — reconstruisez le "
                "dataset (constructions antérieures au 16 août 2026)."
            )
        segments = build_segments_from_votes(dataset, votes)
    elif unit == "sentence":
        segments = [
            Segment(
                document=s.document, start=s.index, end=s.index,
                themes=frozenset(s.themes), n_sentences=1,
                unfair_categories=sorted(s.unfair),
                excerpt=(s.text_detok or s.text)[:200],
            )
            for s in dataset.sentences
        ]
    else:
        segments = build_segments(dataset)
    if with_deontic:
        _attach_deontic(segments, dataset)

    by_document: dict[str, list[Segment]] = defaultdict(list)
    for segment in segments:
        by_document[segment.document].append(segment)

    n_folds = len(dataset.folds)
    scored: dict[str, list[tuple[Segment, float]]] = defaultdict(list)
    skipped_scorers: set[str] = set()
    for fold in range(n_folds):
        if should_cancel and should_cancel():
            from .runner import Cancelled

            raise Cancelled(f"annulé au pli {fold + 1}/{n_folds}")
        test_documents = set(dataset.folds[fold])
        train = [s for s in segments if s.document not in test_documents]
        test = [s for s in segments if s.document in test_documents]
        if not train or not test:
            continue

        for segment in train:
            segment.noisy_themes = None
        if label_noise > 0:
            corrupt_segments(train, dataset.labels, rate=label_noise,
                             seed=seed, fold=fold)

        stats = fit_stats(train, with_deontic=with_deontic)
        for segment in test:
            scored["rarity"].append((segment, score_rarity(
                segment, stats, with_deontic=with_deontic, smoothing=smoothing)))
            scored["npmi_min"].append((segment, score_npmi_min(segment, stats)))
            scored["cardinality"].append((segment, float(len(segment.themes))))
            scored["combo_identity"].append((segment, score_combo_identity(
                segment, stats, with_deontic=with_deontic)))
        skipped_scorers.update(_sklearn_scores(
            scored, train, test, dataset.labels,
            with_deontic=with_deontic, seed=seed,
        ))
        # Le bruit ne doit jamais fuir d'un pli à l'autre.
        for segment in train:
            segment.noisy_themes = None

        if progress_path:
            Path(progress_path).write_text(json.dumps({
                "percent": int(100 * (fold + 1) / n_folds),
                "fold": fold + 1, "folds": n_folds,
            }), encoding="utf-8")

    base_rate = (
        sum(1 for s in segments if s.unfair) / len(segments) if segments else 0.0
    )
    scorers_out = []
    for name in sorted(scored):
        rows = scored[name]
        entry = {
            "scorer": name,
            "kind": SCORER_KINDS.get(name, "unsupervised"),
            "aucPr": _average_precision(rows),
            "aucPrCi": _auc_pr_ci(
                rows, n_resamples=int((evaluation.get("bootstrap") or {})
                                      .get("n_resamples", 1000)),
                seed=seed, tag=f"g2-{name}",
            ),
            "rocAuc": _roc_auc(rows),
            "precisionAt": [],
        }
        ranking = sorted(rows, key=lambda r: (-r[1], r[0].document, r[0].layer, r[0].start))
        for k in precision_at:
            top = ranking[:k]
            if not top:
                continue
            precision = sum(1 for segment, _ in top if segment.unfair) / len(top)
            entry["precisionAt"].append({
                "k": k,
                "precision": round(precision, 6),
                "lift": round(precision / base_rate, 6) if base_rate else None,
            })
        scorers_out.append(entry)

    combinations = _combination_table(segments, base_rate)
    per_category = _per_category(scored, segments)
    structure = {
        "nSegments": len(segments),
        "nSentences": len(dataset.sentences),
        "compression": round(len(dataset.sentences) / len(segments), 6) if segments else None,
        "nCombinations": len({tuple(sorted(s.themes)) for s in segments}),
        "nHapax": sum(
            1 for _combo, count in Counter(
                tuple(sorted(s.themes)) for s in segments
            ).items() if count == 1
        ),
        "multiThemeRate": round(
            sum(1 for s in segments if len(s.themes) > 1) / len(segments), 6
        ) if segments else None,
        "baseRate": round(base_rate, 6),
    }

    best_unsupervised = max(
        (s for s in scorers_out if s["kind"] == "unsupervised"),
        key=lambda s: s["aucPr"] or 0.0, default=None,
    )
    metrics = {
        "auc_pr_best_unsupervised": best_unsupervised["aucPr"] if best_unsupervised else None,
        "best_unsupervised_scorer": best_unsupervised["scorer"] if best_unsupervised else None,
        "auc_pr_rarity": next(
            (s["aucPr"] for s in scorers_out if s["scorer"] == "rarity"), None),
        "auc_pr_combo_identity": next(
            (s["aucPr"] for s in scorers_out if s["scorer"] == "combo_identity"), None),
        "base_rate": round(base_rate, 6),
        "n_segments": len(segments),
    }

    result = {
        "task": "G2_cooccurrence",
        "config": config,
        "dataset": {
            "fingerprint": dataset.manifest.get("fingerprint"),
            "nDocuments": dataset.manifest.get("nDocuments"),
            "nSentences": len(dataset.sentences),
        },
        "metrics": metrics,
        "cooccurrence": {
            "structure": structure,
            "scorers": scorers_out,
            "combinations": combinations,
            "perCategory": per_category,
            "unit": unit,
            "source": source,
            "nLayers": len({(s.document, s.layer) for s in segments}),
            "deontic": model_config.get("deontic", "none"),
            "labelNoise": label_noise,
            # JAMAIS silencieux : un environnement sans sklearn saute LOF/IF/OCSVM et
            # le résultat le dit.
            "skippedScorers": sorted(skipped_scorers),
            "note": (
                "Aperçu sur annotations majoritairement mono-annotateur : une "
                "combinaison reflète aussi le style d'un annotateur — à rejouer sur le "
                "gold arbitré."
            ),
        },
        "environment": capture_environment(started),
    }

    (out_dir / "results.json").write_text(
        json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    _write_hypergraph(out_dir, by_document, with_deontic)
    with (out_dir / "segments.jsonl").open("w", encoding="utf-8") as handle:
        score_index: dict[tuple, dict[str, float]] = defaultdict(dict)
        for name, rows in scored.items():
            for segment, value in rows:
                score_index[segment.key][name] = round(value, 6)
        for segment in segments:
            handle.write(json.dumps({
                "document": segment.document,
                "annotator": segment.layer,
                "start": segment.start,
                "end": segment.end,
                "themes": sorted(segment.themes),
                "deontic": segment.deontic,
                "unfair": segment.unfair_categories,
                "scores": score_index.get(segment.key, {}),
            }, ensure_ascii=False) + "\n")
    (out_dir / "environment.json").write_text(
        json.dumps(result["environment"], indent=2), encoding="utf-8"
    )
    (out_dir / "_SENTINEL").write_text("DONE\n", encoding="utf-8")
    return result


def _sklearn_scores(scored, train, test, labels, *, with_deontic: bool,
                    seed: int) -> list[str]:
    """Détecteurs peu profonds (LOF / IsolationForest / OCSVM) — OPTIONNELS.

    Le socle du package doit tourner sans environnement scientifique (invariant
    testé : une frontale Grid'5000 nue exécute les baselines). Sans sklearn, ces
    trois scorers sont ABSENTS DU RÉSULTAT et listés dans `skippedScorers` — jamais
    des zéros silencieux. Renvoie la liste des scorers sautés.
    """
    try:
        from sklearn.ensemble import IsolationForest
        from sklearn.neighbors import LocalOutlierFactor
        from sklearn.svm import OneClassSVM
    except ModuleNotFoundError:
        return ["lof", "iforest", "ocsvm"]

    train_matrix = _multi_hot(train, labels, with_deontic=with_deontic)
    test_matrix = _multi_hot(test, labels, with_deontic=with_deontic)

    lof = LocalOutlierFactor(n_neighbors=min(20, max(2, len(train) - 1)), novelty=True)
    lof.fit(train_matrix)
    for segment, value in zip(test, (-lof.score_samples(test_matrix)).tolist()):
        scored["lof"].append((segment, value))

    forest = IsolationForest(random_state=seed, n_estimators=200)
    forest.fit(train_matrix)
    for segment, value in zip(test, (-forest.score_samples(test_matrix)).tolist()):
        scored["iforest"].append((segment, value))

    svm = OneClassSVM(kernel="rbf", gamma="scale", nu=0.1)
    svm.fit(train_matrix)
    for segment, value in zip(test, (-svm.score_samples(test_matrix)).tolist()):
        scored["ocsvm"].append((segment, value))
    return []


def _ap_from_pairs(pairs: list[tuple[int, float]]) -> float | None:
    """Average precision PURE (sans sklearn), ex æquo groupés par seuil — même
    définition que `average_precision_score` : AP = Σ (R_n − R_{n−1}) · P_n."""
    total_positive = sum(truth for truth, _ in pairs)
    if not pairs or total_positive == 0:
        return None
    ordered = sorted(pairs, key=lambda p: -p[1])
    ap = 0.0
    tp = 0
    seen = 0
    i = 0
    while i < len(ordered):
        j = i
        group_tp = 0
        while j < len(ordered) and ordered[j][1] == ordered[i][1]:
            group_tp += ordered[j][0]
            j += 1
        tp += group_tp
        seen += j - i
        precision = tp / seen
        ap += precision * (group_tp / total_positive)
        i = j
    return round(ap, 6)


def _average_precision(rows: list[tuple[Segment, float]]) -> float | None:
    return _ap_from_pairs([(1 if s.unfair else 0, v) for s, v in rows])


def _roc_auc(rows: list[tuple[Segment, float]]) -> float | None:
    """AUC-ROC PURE par rangs (Mann-Whitney U, rangs moyens pour les ex æquo)."""
    truths = [1 if segment.unfair else 0 for segment, _ in rows]
    n_positive = sum(truths)
    n_negative = len(truths) - n_positive
    if n_positive == 0 or n_negative == 0:
        return None
    ordered = sorted(zip(truths, (v for _, v in rows)), key=lambda p: p[1])
    rank_sum_positive = 0.0
    i = 0
    while i < len(ordered):
        j = i
        while j < len(ordered) and ordered[j][1] == ordered[i][1]:
            j += 1
        mean_rank = (i + 1 + j) / 2.0  # rangs 1-based, moyenne du groupe d'ex æquo
        rank_sum_positive += mean_rank * sum(t for t, _ in ordered[i:j])
        i = j
    u = rank_sum_positive - n_positive * (n_positive + 1) / 2.0
    return round(u / (n_positive * n_negative), 6)


def _auc_pr_ci(rows, *, n_resamples: int, seed: int, tag: str,
               confidence: float = 0.95) -> dict:
    """IC bootstrap PAR DOCUMENT de l'AUC-PR — les segments d'un ToS ne sont pas
    indépendants, exactement comme les phrases (règle du cadre statistique)."""
    by_document: dict[str, list] = defaultdict(list)
    for segment, value in rows:
        by_document[segment.document].append((segment, value))
    documents = sorted(by_document)
    if len(documents) < 2:
        return {"low": None, "high": None, "nResamples": 0,
                "warning": "insufficient_groups"}
    values = []
    counter = 0
    for _ in range(n_resamples):
        draw: list[int] = []
        while len(draw) < len(documents):
            digest = hashlib.sha256(f"{seed}:{tag}:{counter}".encode()).digest()
            counter += 1
            for i in range(0, len(digest), 4):
                if len(draw) >= len(documents):
                    break
                draw.append(int.from_bytes(digest[i:i + 4], "big") % len(documents))
        sample = [row for i in draw for row in by_document[documents[i]]]
        ap = _average_precision(sample)
        if ap is not None:
            values.append(ap)
    if not values:
        return {"low": None, "high": None, "nResamples": 0,
                "warning": "insufficient_groups"}
    values.sort()
    alpha = (1.0 - confidence) / 2.0
    return {
        "low": round(values[max(0, int(alpha * len(values)))], 6),
        "high": round(values[min(len(values) - 1, int((1 - alpha) * len(values)))], 6),
        "nResamples": len(values),
        "unit": "document",
    }


def _combination_table(segments: list[Segment], base_rate: float,
                       *, min_support: int = 3, top: int = 20) -> dict:
    """Descriptif SUR TOUT le corpus (pas de CV — c'est une table d'illustration, pas
    une mesure de généralisation ; la mesure honnête est dans `scorers`)."""
    by_combo: dict[tuple, list[Segment]] = defaultdict(list)
    for segment in segments:
        if len(segment.themes) > 1:
            by_combo[tuple(sorted(segment.themes))].append(segment)
    rows = []
    for combo, members in by_combo.items():
        if len(members) < min_support:
            continue
        unfair = sum(1 for s in members if s.unfair)
        rate = unfair / len(members)
        example = max(members, key=lambda s: (s.unfair, -s.start))
        rows.append({
            "themes": list(combo),
            "support": len(members),
            "nUnfair": unfair,
            "unfairRate": round(rate, 6),
            "lift": round(rate / base_rate, 6) if base_rate else None,
            "example": {
                "document": example.document,
                "start": example.start,
                "excerpt": example.excerpt,
            },
        })
    rows.sort(key=lambda r: (-(r["lift"] or 0.0), -r["support"]))
    return {"top": rows[:top], "bottom": rows[-5:] if len(rows) > 5 else [],
            "minSupport": min_support}


def _per_category(scored, segments: list[Segment], *, min_positive: int = 10) -> list[dict]:
    categories = sorted({c for s in segments for c in s.unfair_categories})
    out = []
    for category in categories:
        n_positive = sum(1 for s in segments if category in s.unfair_categories)
        if n_positive < min_positive:
            continue
        entry = {"category": category, "nPositive": n_positive, "aucPrByScorer": []}
        for name in sorted(scored):
            pairs = [
                (1 if category in segment.unfair_categories else 0, value)
                for segment, value in scored[name]
            ]
            ap = _ap_from_pairs(pairs)
            if ap is None or all(truth for truth, _ in pairs):
                continue
            entry["aucPrByScorer"].append({"scorer": name, "aucPr": ap})
        out.append(entry)
    return out


def _write_hypergraph(out_dir: Path, by_document: dict[str, list[Segment]],
                      with_deontic: bool) -> None:
    """L'artefact d'entrée de l'objectif « graphe » (04 §6.3) : par document, chaque
    segment (hyperarc) relié à ses thèmes, avec l'abusivité alignée."""
    payload = {
        "kind": "clause-theme-hypergraph",
        "unit": "reconstructed_segment",
        "documents": [
            {
                "document": document,
                "segments": [
                    {
                        "start": s.start,
                        "end": s.end,
                        "themes": sorted(s.themes),
                        **({"annotator": s.layer} if s.layer else {}),
                        **({"deontic": s.deontic} if with_deontic else {}),
                        "unfair": s.unfair_categories,
                    }
                    for s in sorted(segments, key=lambda x: (x.layer, x.start))
                ],
            }
            for document, segments in sorted(by_document.items())
        ],
    }
    (out_dir / "hypergraph.json").write_text(
        json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8"
    )

"""Métriques d'évaluation — bibliothèque standard uniquement.

Réécrites plutôt qu'importées de scikit-learn pour que le socle tourne partout (y compris
sur une frontale Grid'5000 sans environnement scientifique), et pour que chaque formule
soit lisible et testable. Les implémentations sont vérifiées contre des cas connus dans
`research/tests/`.

Rappel du plan scientifique : **micro-F1 et macro-F1 sont toujours rapportés ensemble**.
La distribution est à longue traîne (de 12,7 % pour `PREAMBLE_SCOPE` à 0,34 % pour
`FEEDBACK`) : le micro sera flatteur, le macro sévère, et c'est leur écart qui informe.
"""

from __future__ import annotations

from collections import Counter


# --------------------------------------------------------------------------- #
# T1 — mono-label
# --------------------------------------------------------------------------- #

def accuracy(y_true: list[str], y_pred: list[str]) -> float:
    if not y_true:
        return 0.0
    return sum(1 for a, b in zip(y_true, y_pred) if a == b) / len(y_true)


def per_class_prf(y_true: list[str], y_pred: list[str]) -> dict[str, dict[str, float]]:
    """Précision, rappel, F1 et support pour chaque classe.

    Le support est rapporté systématiquement : une F1 de 0,4 sur une classe à 31
    occurrences n'a pas le même statut qu'une F1 de 0,4 sur une classe à 1 163.
    """
    labels = sorted(set(y_true) | set(y_pred))
    out: dict[str, dict[str, float]] = {}
    for label in labels:
        tp = sum(1 for a, b in zip(y_true, y_pred) if a == label and b == label)
        fp = sum(1 for a, b in zip(y_true, y_pred) if a != label and b == label)
        fn = sum(1 for a, b in zip(y_true, y_pred) if a == label and b != label)
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        out[label] = {
            "precision": round(precision, 6),
            "recall": round(recall, 6),
            "f1": round(f1, 6),
            "support": tp + fn,
        }
    return out


def macro_f1(y_true: list[str], y_pred: list[str]) -> float:
    """Moyenne non pondérée des F1 par classe — sévère sur la longue traîne.

    Les classes absentes de la vérité terrain ET des prédictions ne comptent pas ; celles
    présentes dans l'un des deux comptent, y compris avec une F1 nulle. C'est le
    comportement de scikit-learn, et c'est le plus honnête : une classe jamais prédite
    est un échec, pas une absence.
    """
    stats = per_class_prf(y_true, y_pred)
    if not stats:
        return 0.0
    return round(sum(s["f1"] for s in stats.values()) / len(stats), 6)


def micro_f1(y_true: list[str], y_pred: list[str]) -> float:
    """En mono-label, le micro-F1 égale l'exactitude — conservé pour l'homogénéité des
    tableaux entre T1 et T2."""
    return round(accuracy(y_true, y_pred), 6)


def confusion_matrix(y_true: list[str], y_pred: list[str]) -> dict:
    labels = sorted(set(y_true) | set(y_pred))
    counts: Counter = Counter(zip(y_true, y_pred))
    return {
        "labels": labels,
        "matrix": [[counts.get((a, b), 0) for b in labels] for a in labels],
    }


def cohen_kappa(y_true: list[str], y_pred: list[str]) -> float:
    """κ de Cohen — permet de comparer directement le modèle aux annotateurs humains
    (κ 0,769) et aux juges LLM, qui sont mesurés dans cette unité."""
    n = len(y_true)
    if n == 0:
        return 0.0
    po = accuracy(y_true, y_pred)
    count_true, count_pred = Counter(y_true), Counter(y_pred)
    pe = sum((count_true[c] / n) * (count_pred[c] / n) for c in set(count_true) | set(count_pred))
    if pe >= 1.0:
        return 1.0 if po >= 1.0 else 0.0
    return round((po - pe) / (1 - pe), 6)


def top_confusions(y_true: list[str], y_pred: list[str], limit: int = 10) -> list[dict]:
    """Paires les plus confondues — à croiser avec les paires où les humains divergent."""
    counts: Counter = Counter(
        (a, b) for a, b in zip(y_true, y_pred) if a != b
    )
    return [
        {"true": a, "pred": b, "count": n} for (a, b), n in counts.most_common(limit)
    ]


# --------------------------------------------------------------------------- #
# T2 — multi-label
# --------------------------------------------------------------------------- #

def multilabel_prf(
    y_true: list[set[str]], y_pred: list[set[str]]
) -> dict[str, float]:
    """Micro/macro-F1, Hamming et exactitude d'ensemble."""
    labels = sorted(set().union(*y_true, *y_pred)) if y_true else []
    tp = sum(len(a & b) for a, b in zip(y_true, y_pred))
    fp = sum(len(b - a) for a, b in zip(y_true, y_pred))
    fn = sum(len(a - b) for a, b in zip(y_true, y_pred))
    micro_p = tp / (tp + fp) if tp + fp else 0.0
    micro_r = tp / (tp + fn) if tp + fn else 0.0
    micro = 2 * micro_p * micro_r / (micro_p + micro_r) if micro_p + micro_r else 0.0

    per_label = {}
    for label in labels:
        ltp = sum(1 for a, b in zip(y_true, y_pred) if label in a and label in b)
        lfp = sum(1 for a, b in zip(y_true, y_pred) if label not in a and label in b)
        lfn = sum(1 for a, b in zip(y_true, y_pred) if label in a and label not in b)
        p = ltp / (ltp + lfp) if ltp + lfp else 0.0
        r = ltp / (ltp + lfn) if ltp + lfn else 0.0
        per_label[label] = {
            "f1": round(2 * p * r / (p + r), 6) if p + r else 0.0,
            "support": ltp + lfn,
        }
    macro = (
        round(sum(v["f1"] for v in per_label.values()) / len(per_label), 6)
        if per_label else 0.0
    )

    n = len(y_true) or 1
    hamming = sum(len(a ^ b) for a, b in zip(y_true, y_pred)) / (n * max(1, len(labels)))
    subset = sum(1 for a, b in zip(y_true, y_pred) if a == b) / n
    return {
        "micro_f1": round(micro, 6),
        "macro_f1": macro,
        "hamming_loss": round(hamming, 6),
        "subset_accuracy": round(subset, 6),
        "per_label": per_label,
    }


def lrap(y_true: list[set[str]], scores: list[dict[str, float]]) -> float:
    """Label Ranking Average Precision — mesure si les bonnes étiquettes sont BIEN
    CLASSÉES, indépendamment du seuil de décision. Utile quand le seuil n'est pas encore
    calibré."""
    if not y_true:
        return 0.0
    total = 0.0
    counted = 0
    for truth, score in zip(y_true, scores):
        if not truth:
            continue
        ranked = sorted(score, key=lambda label: -score[label])
        positions = {label: rank + 1 for rank, label in enumerate(ranked)}
        relevant = sorted(positions.get(label, len(ranked) + 1) for label in truth)
        precision = sum((i + 1) / rank for i, rank in enumerate(relevant)) / len(relevant)
        total += precision
        counted += 1
    return round(total / counted, 6) if counted else 0.0


# --------------------------------------------------------------------------- #
# T3 — segmentation
# --------------------------------------------------------------------------- #

def boundary_prf(y_true: list[bool], y_pred: list[bool]) -> dict[str, float]:
    tp = sum(1 for a, b in zip(y_true, y_pred) if a and b)
    fp = sum(1 for a, b in zip(y_true, y_pred) if not a and b)
    fn = sum(1 for a, b in zip(y_true, y_pred) if a and not b)
    p = tp / (tp + fp) if tp + fp else 0.0
    r = tp / (tp + fn) if tp + fn else 0.0
    return {
        "boundary_precision": round(p, 6),
        "boundary_recall": round(r, 6),
        "boundary_f1": round(2 * p * r / (p + r), 6) if p + r else 0.0,
    }


def window_diff(y_true: list[bool], y_pred: list[bool], k: int | None = None) -> float:
    """WindowDiff — pénalise moins une frontière décalée qu'une frontière absente."""
    n = len(y_true)
    if n <= 1:
        return 0.0
    if k is None:
        n_boundaries = max(1, sum(y_true))
        k = max(2, min(n - 1, round(n / (2 * n_boundaries))))
    errors = windows = 0
    for i in range(n - k):
        a = sum(y_true[i : i + k])
        b = sum(y_pred[i : i + k])
        errors += a != b
        windows += 1
    return round(errors / windows, 6) if windows else 0.0


# --------------------------------------------------------------------------- #
# Calibration
# --------------------------------------------------------------------------- #

def expected_calibration_error(
    confidences: list[float], correct: list[bool], bins: int = 10
) -> float:
    """ECE — écart moyen entre confiance annoncée et exactitude observée.

    Indispensable si le modèle doit un jour assister l'annotateur : une suggestion à
    « 95 % » qui n'a raison que 60 % du temps détruit la confiance dans l'outil.
    """
    if not confidences:
        return 0.0
    total = len(confidences)
    error = 0.0
    for b in range(bins):
        low, high = b / bins, (b + 1) / bins
        bucket = [
            (c, ok) for c, ok in zip(confidences, correct)
            if (low < c <= high) or (b == 0 and c == 0.0)
        ]
        if not bucket:
            continue
        mean_conf = sum(c for c, _ in bucket) / len(bucket)
        mean_acc = sum(1 for _, ok in bucket if ok) / len(bucket)
        error += (len(bucket) / total) * abs(mean_conf - mean_acc)
    return round(error, 6)


def reliability_curve(
    confidences: list[float], correct: list[bool], bins: int = 10
) -> list[dict]:
    out = []
    for b in range(bins):
        low, high = b / bins, (b + 1) / bins
        bucket = [
            (c, ok) for c, ok in zip(confidences, correct)
            if (low < c <= high) or (b == 0 and c == 0.0)
        ]
        if not bucket:
            continue
        out.append(
            {
                "bin": b,
                "meanConfidence": round(sum(c for c, _ in bucket) / len(bucket), 6),
                "accuracy": round(sum(1 for _, ok in bucket if ok) / len(bucket), 6),
                "count": len(bucket),
            }
        )
    return out


def positive_class_prf(y_true: list[str], y_pred: list[str], positive: str) -> dict[str, float]:
    """P/R/F1 de la classe positive d'une tâche binaire (U1 : `unfair`), avec support."""
    return per_class_prf(y_true, y_pred).get(
        positive, {"precision": 0.0, "recall": 0.0, "f1": 0.0, "support": 0}
    )


def average_precision(y_true: list[bool], scores: list[float]) -> float | None:
    """Average precision PURE (sans sklearn), ex æquo groupés par seuil — même définition
    que `average_precision_score` : AP = Σ (R_n − R_{n−1}) · P_n. None sans positif."""
    pairs = [(1 if t else 0, float(v)) for t, v in zip(y_true, scores)]
    total_positive = sum(t for t, _ in pairs)
    if not pairs or total_positive == 0:
        return None
    ordered = sorted(pairs, key=lambda p: -p[1])
    ap, tp, seen, i = 0.0, 0, 0, 0
    while i < len(ordered):
        j = i
        group_tp = 0
        while j < len(ordered) and ordered[j][1] == ordered[i][1]:
            group_tp += ordered[j][0]
            j += 1
        tp += group_tp
        seen += j - i
        ap += (tp / seen) * (group_tp / total_positive)
        i = j
    return round(ap, 6)

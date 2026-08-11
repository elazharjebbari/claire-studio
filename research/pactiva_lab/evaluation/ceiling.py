"""Plafond humain — la borne supérieure réaliste de toute tâche apprise sur ce gold.

Principe : sur les documents couverts par plusieurs annotateurs, on prend l'annotation
d'un annotateur comme *prédiction* de celle d'un autre, et on la mesure avec exactement
les mêmes métriques que le modèle. Le score obtenu est ce qu'un humain expert atteint
sur cette tâche, avec ces consignes, sur ce corpus.

Pourquoi c'est indispensable : l'accord inter-annotateurs est de α-MASI 0,635 et κ 0,769.
Un modèle qui atteint 0,72 de macro-F1 quand le plafond est à 0,74 est excellent ; le
même 0,72 présenté seul serait lu comme médiocre. Rapporter un score sans son plafond,
c'est rendre le résultat ininterprétable — et exposer l'article à une objection immédiate.

⚠️ Le plafond dépend de la TÂCHE : celui de T1 (κ 0,769) n'est pas celui de T2
(α-MASI 0,635) ni celui de T3 (Jaccard 0,39–0,63). Les mélanger serait pire que de ne
rien rapporter.
"""

from __future__ import annotations

from itertools import combinations

from .metrics import accuracy, cohen_kappa, macro_f1, multilabel_prf


def human_ceiling(
    per_annotator: dict[str, dict[tuple[str, int], dict]],
    *,
    task: str = "T1_primary",
) -> dict:
    """Plafond humain à partir des annotations individuelles.

    `per_annotator` : annotateur → {(document, index) → {"primary": …, "themes": [...],
    "boundary": bool}}. Seules les phrases couvertes par au moins deux annotateurs
    comptent.
    """
    annotators = sorted(per_annotator)
    if len(annotators) < 2:
        return {
            "value": None,
            "task": task,
            "pairs": 0,
            "warning": "insufficient_annotators",
            "note": "aucun plafond calculable : moins de deux annotateurs se recouvrent",
        }

    pair_scores: list[dict] = []
    for a, b in combinations(annotators, 2):
        shared = sorted(set(per_annotator[a]) & set(per_annotator[b]))
        if len(shared) < 20:
            # En dessous, la mesure serait trop bruitée pour servir de borne.
            continue

        if task == "T2_multilabel":
            y_a = [set(per_annotator[a][k]["themes"]) for k in shared]
            y_b = [set(per_annotator[b][k]["themes"]) for k in shared]
            stats = multilabel_prf(y_a, y_b)
            pair_scores.append(
                {
                    "a": a, "b": b, "n": len(shared),
                    "macro_f1": stats["macro_f1"], "micro_f1": stats["micro_f1"],
                }
            )
        elif task == "T3_boundary":
            y_a = [bool(per_annotator[a][k]["boundary"]) for k in shared]
            y_b = [bool(per_annotator[b][k]["boundary"]) for k in shared]
            tp = sum(1 for x, y in zip(y_a, y_b) if x and y)
            fp = sum(1 for x, y in zip(y_a, y_b) if not x and y)
            fn = sum(1 for x, y in zip(y_a, y_b) if x and not y)
            p = tp / (tp + fp) if tp + fp else 0.0
            r = tp / (tp + fn) if tp + fn else 0.0
            pair_scores.append(
                {
                    "a": a, "b": b, "n": len(shared),
                    "boundary_f1": round(2 * p * r / (p + r), 6) if p + r else 0.0,
                    "jaccard": round(tp / (tp + fp + fn), 6) if tp + fp + fn else 1.0,
                }
            )
        else:  # T1_primary
            y_a = [per_annotator[a][k]["primary"] for k in shared]
            y_b = [per_annotator[b][k]["primary"] for k in shared]
            pair_scores.append(
                {
                    "a": a, "b": b, "n": len(shared),
                    "accuracy": round(accuracy(y_a, y_b), 6),
                    "macro_f1": macro_f1(y_a, y_b),
                    "kappa": cohen_kappa(y_a, y_b),
                }
            )

    if not pair_scores:
        return {
            "value": None, "task": task, "pairs": 0,
            "warning": "insufficient_overlap",
            "note": "aucune paire d'annotateurs ne partage au moins 20 phrases",
        }

    key = {
        "T1_primary": "macro_f1",
        "T2_multilabel": "macro_f1",
        "T3_boundary": "boundary_f1",
    }[task]
    values = [score[key] for score in pair_scores]
    # Moyenne des paires, jamais concaténation des observations : concaténer compterait
    # chaque phrase autant de fois qu'elle a de paires, ce qui biaise dès trois
    # annotateurs (correction déjà appliquée côté `projects.iaa`).
    return {
        "value": round(sum(values) / len(values), 6),
        "metric": key,
        "task": task,
        "pairs": len(pair_scores),
        "perPair": pair_scores,
        "note": (
            "Borne supérieure réaliste : un annotateur pris comme prédiction d'un autre, "
            "avec les mêmes métriques que le modèle."
        ),
    }

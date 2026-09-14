"""Exporte les runs terminés vers des répertoires lisibles par la campagne d'expériences.

Les enveloppes de RQ4 (`research/experiments/rq4_models.py`) ne recalculent rien : elles
LISENT `<runs_dir>/<nom>/results.json`. Les runs Grid'5000, eux, atterrissent en base
(`ExperimentRun.metrics`). Ce script fait le pont, sans rien recalculer ni réécrire : le
contenu déposé est exactement celui qu'a produit le nœud.

Le nom du répertoire est DÉRIVÉ de la configuration (famille de modèle + taxonomie), jamais
saisi à la main : deux runs de configurations différentes ne peuvent pas se recouvrir, et
un même run réexporté écrase sa propre version antérieure plutôt que d'en créer une seconde.

Usage (sur le serveur de production) :
    python manage.py shell < scripts/export_g5k_runs.py
puis rapatrier `/tmp/pactiva-runs/` vers `research/runs/`.
"""

import json
from pathlib import Path

from claire.lab.models import ExperimentRun

OUT = Path("/tmp/pactiva-runs")

FAMILY_SLUG = {
    "tfidf_linear": "tfidf",
    "position_only": "position",
    "transformer_finetune": "legalbert",
    "embeddings_head": "embeddings",
    "sequence_labeling": "seqlab",
}


def run_slug(config: dict) -> str:
    family = (config.get("model") or {}).get("family", "inconnu")
    slug = FAMILY_SLUG.get(family, family)
    taxonomy = (config.get("data") or {}).get("taxonomy", "T20")
    task = config.get("task", "")
    # La tâche n'entre dans le nom que lorsqu'elle est distinctive : sinon `tfidf_T11`
    # deviendrait `tfidf_T1_primary_T11` et ne correspondrait plus à ce que lit RQ4.
    suffix = "_multilabel" if task == "T2_multilabel" else ""
    # Les points d'une courbe d'apprentissage partagent modèle et taxonomie : sans la
    # taille dans le nom, ils s'écraseraient tous entre eux. RQ4 les cherche sous `lc_<n>`.
    curve = ((config.get("evaluation") or {}).get("learning_curve") or {}).get("n_documents")
    if curve:
        return f"lc_{int(curve)}"
    return f"{slug}{suffix}_{taxonomy}"


# Empreinte du dataset FINAL de la campagne. Tout run calculé sur un autre dataset est
# écarté : la contrainte est explicite — ne jamais mélanger d'anciens runs avec la
# campagne finale sans marquage. Un run d'août reste consultable dans l'interface, il
# n'entre simplement pas dans les chiffres publiés.
FINAL_FINGERPRINT = "7116e627f528c5572457e79d9e53d2e71bfc21e3a20aacb43e9d3072cfb70e2e"

OUT.mkdir(parents=True, exist_ok=True)
candidates: dict[str, list] = {}
rejected = []

for run in ExperimentRun.objects.filter(status="succeeded").select_related("experiment"):
    metrics = run.metrics or {}
    if not metrics.get("metrics"):
        continue
    fingerprint = (metrics.get("dataset") or {}).get("fingerprint", "")
    if fingerprint != FINAL_FINGERPRINT:
        rejected.append({"run": str(run.id)[:8], "experiment": run.experiment.name[:45],
                         "raison": "dataset différent du dataset final",
                         "fingerprint": fingerprint[:16] or "absente"})
        continue
    candidates.setdefault(run_slug(run.config or metrics.get("config") or {}), []).append(run)

exported, collisions = [], []
for name, runs in sorted(candidates.items()):
    # Plusieurs runs peuvent viser le même répertoire (même famille, même taxonomie, mais
    # prétraitements différents). Écraser au hasard de l'ordre de lecture rendrait le
    # chiffre publié non reproductible : on retient le plus RÉCENT, explicitement, et on
    # nomme ceux qui ont été écartés.
    runs.sort(key=lambda r: r.completed_at or r.created_at, reverse=True)
    winner, losers = runs[0], runs[1:]
    metrics = winner.metrics or {}
    target = OUT / name
    target.mkdir(parents=True, exist_ok=True)
    (target / "results.json").write_text(
        json.dumps(metrics, ensure_ascii=False), encoding="utf-8"
    )
    if metrics.get("errors"):
        (target / "errors.json").write_text(
            json.dumps(metrics["errors"], ensure_ascii=False), encoding="utf-8"
        )
    # La provenance voyage AVEC les chiffres : un répertoire sans elle ne dit pas d'où il
    # sort, et c'est la première question d'un relecteur.
    (target / "_PROVENANCE.json").write_text(json.dumps({
        "runId": str(winner.id), "experiment": winner.experiment.name,
        "experimentId": str(winner.experiment_id),
        "completedAt": str(winner.completed_at or winner.created_at),
        "datasetFingerprint": FINAL_FINGERPRINT,
        "compute": (winner.config.get("compute") or {}).get("target"),
        "externalJobId": winner.external_job_id or None,
        "config": winner.config,
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    exported.append({
        "run": str(winner.id)[:8], "dir": name,
        "experiment": winner.experiment.name[:45],
        "macroF1": (metrics.get("metrics") or {}).get("macro_f1"),
        "nClasses": len(metrics.get("per_label") or []),
        "target": (winner.config.get("compute") or {}).get("target"),
    })
    for loser in losers:
        collisions.append({"dir": name, "ecarte": str(loser.id)[:8],
                           "experiment": loser.experiment.name[:45],
                           "raison": "plus ancien que le run retenu"})

print(json.dumps({"out": str(OUT), "exported": exported,
                  "collisions": collisions, "rejetes": len(rejected),
                  "rejetesDetail": rejected[:10]}, ensure_ascii=False, indent=1))

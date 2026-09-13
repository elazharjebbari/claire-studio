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
    return f"{slug}{suffix}_{taxonomy}"


OUT.mkdir(parents=True, exist_ok=True)
exported = []
for run in ExperimentRun.objects.filter(status="succeeded").select_related("experiment"):
    metrics = run.metrics or {}
    if not metrics.get("metrics"):
        continue
    name = run_slug(run.config or metrics.get("config") or {})
    target = OUT / name
    target.mkdir(parents=True, exist_ok=True)
    (target / "results.json").write_text(
        json.dumps(metrics, ensure_ascii=False), encoding="utf-8"
    )
    if metrics.get("errors"):
        (target / "errors.json").write_text(
            json.dumps(metrics["errors"], ensure_ascii=False), encoding="utf-8"
        )
    exported.append({
        "run": str(run.id)[:8], "dir": name,
        "experiment": run.experiment.name[:45],
        "macroF1": (metrics.get("metrics") or {}).get("macro_f1"),
        "nClasses": len(metrics.get("per_label") or []),
        "target": (run.config.get("compute") or {}).get("target"),
    })

print(json.dumps({"out": str(OUT), "exported": exported}, ensure_ascii=False, indent=1))

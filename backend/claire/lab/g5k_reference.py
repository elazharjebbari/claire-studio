"""Sélection informée de cluster GPU — pur, aucun appel réseau ici.

La Reference API de Grid'5000 expose `gpu_devices` par nœud (modèle, mémoire en
octets, `compute_capability`) — voir `docs/pactiva-g5k/research/03_API_REST.md` §3.3.
Ce module filtre un catalogue DÉJÀ récupéré (par `g5k_client.py` en production, ou par
une fixture de données réelles en test/dev — voir
`docs/pactiva-g5k/specs/g5k-clusters-gpu-sample.json`) pour ne proposer que les
clusters dont la VRAM convient au modèle qu'on veut fine-tuner.

Legal-BERT-base (~440 Mo, 110M paramètres) tient dans 8 Go de VRAM ; les presets de
`pipeline-presets.yaml` demandent explicitement des checkpoints de cette taille — voir
`docs/pactiva-g5k/06_ANALYSE_BESOIN_PACTIVA.md` §1. Inutile de cibler les clusters les
plus contendus (H100/H200/MI300X, réservés aux LLM) pour ce besoin.
"""

from __future__ import annotations

import json
import logging
from functools import lru_cache
from pathlib import Path

logger = logging.getLogger("claire.lab")

BYTES_PER_GB = 1024**3


def _gpus_of(node: dict) -> list[dict]:
    return list((node.get("gpu_devices") or {}).values())


def gpu_clusters_for(min_vram_gb: float, nodes: dict[str, dict]) -> list[dict]:
    """Filtre `nodes` (mapping `node_uid -> {"site", "cluster", "node": <JSON
    reference-repository>}`) : ne garde que les nœuds ayant au moins un GPU dont la
    mémoire est >= `min_vram_gb`. Trie par VRAM du meilleur GPU du nœud, croissante —
    le premier résultat est le plus petit cluster qui convient, pour ne pas
    monopoliser inutilement une ressource contendue.

    Un nœud sans `gpu_devices` (pas de GPU) est exclu silencieusement : ce n'est pas
    une exclusion à motiver comme pour une sélection d'annotations, juste un filtre
    matériel.
    """
    min_bytes = min_vram_gb * BYTES_PER_GB
    matches = []
    for entry in nodes.values():
        node = entry.get("node") or {}
        gpus = _gpus_of(node)
        if not gpus:
            continue
        best_gpu = max(gpus, key=lambda g: g.get("memory") or 0)
        if (best_gpu.get("memory") or 0) < min_bytes:
            continue
        matches.append(
            {
                "site": entry.get("site"),
                "cluster": entry.get("cluster"),
                "node": node.get("uid"),
                "gpuModel": best_gpu.get("model"),
                "gpuVramGb": round((best_gpu.get("memory") or 0) / BYTES_PER_GB, 1),
                "gpuCount": len(gpus),
            }
        )
    matches.sort(key=lambda m: m["gpuVramGb"])
    return matches


def catalogue_file() -> Path:
    """Chemin du catalogue statique de clusters GPU.

    STATIQUE et délibérément non exhaustif — voir le `_provenance` du fichier lui-même.
    La Reference API dynamique exige une authentification pour CHAQUE nœud (pas de
    format de collection vérifié empiriquement sans compte, voir
    `docs/pactiva-g5k/07_ARCHITECTURE.md` §Lot 3) : ce catalogue, construit à partir de
    la recherche documentaire (dont 3 clusters vérifiés empiriquement via le miroir
    public), est le compromis retenu tant qu'aucun compte réel n'existe.
    """
    from django.conf import settings

    configured = getattr(settings, "LAB_G5K_GPU_CATALOGUE", None)
    if configured:
        return Path(configured)
    return (
        Path(settings.BASE_DIR).parent
        / "docs" / "pactiva-g5k" / "specs" / "g5k-gpu-clusters-catalogue.json"
    )


@lru_cache(maxsize=1)
def _load_catalogue_cached(path: str) -> dict:
    try:
        raw = Path(path).read_text(encoding="utf-8")
    except OSError:
        logger.warning("lab_g5k_catalogue_missing path=%s", path)
        return {"clusters": []}
    return json.loads(raw)


def load_static_catalogue() -> dict[str, dict]:
    """Charge le catalogue statique et le transforme au format attendu par
    `gpu_clusters_for` (mêmes clés `gpu_devices`/`model`/`memory` que la Reference API
    réelle — un seul chemin de calcul pour les deux sources, testé une seule fois)."""
    data = _load_catalogue_cached(str(catalogue_file()))
    nodes: dict[str, dict] = {}
    for entry in data.get("clusters", []):
        vram_bytes = int(entry["gpu_vram_gb"] * BYTES_PER_GB)
        gpu_count = int(entry.get("gpu_count", 1))
        nodes[entry["cluster"]] = {
            "site": entry["site"],
            "cluster": entry["cluster"],
            "node": {
                "gpu_devices": {
                    f"gpu{i}": {"model": entry["gpu_model"], "memory": vram_bytes}
                    for i in range(gpu_count)
                }
            },
        }
    return nodes
